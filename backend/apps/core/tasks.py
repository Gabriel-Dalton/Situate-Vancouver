"""
Celery polling tasks — fetch live data from all upstream APIs and upsert
into the Incident table. Runs on a schedule via django-celery-beat.

Schedules (configured in Django admin or via data migration):
  poll_drivebc            — every 5 minutes
  poll_vancouver_opendata — every 30 minutes
  poll_surrey             — every 30 minutes
  expire_incidents        — every hour
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from celery import shared_task
from django.utils import timezone as django_tz

from .models import Incident

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _upsert_incident(
    *,
    source_api: str,
    external_id: str,
    incident_type: str,
    severity: str,
    title: str,
    description: str,
    location: str,
    lat: float | None,
    lng: float | None,
    cause: str = "",
    impact: str = "",
    estimated_duration: str = "",
    recommended_actions: list | None = None,
    expires_in_seconds: int | None = None,
) -> tuple[Incident, bool]:
    """
    Insert or update an incident by (source_api, external_id).
    Returns (incident, created).
    """
    expires_at = None
    if expires_in_seconds:
        expires_at = django_tz.now() + timedelta(seconds=expires_in_seconds)

    incident, created = Incident.objects.update_or_create(
        source_api=source_api,
        external_id=external_id,
        defaults=dict(
            source=Incident.Source.API,
            incident_type=incident_type,
            severity=severity,
            status=Incident.Status.ACTIVE,
            title=title,
            description=description,
            location=location,
            lat=lat,
            lng=lng,
            cause=cause,
            impact=impact,
            estimated_duration=estimated_duration,
            recommended_actions=recommended_actions or [],
            verified=True,
            expires_at=expires_at,
        ),
    )
    return incident, created


def _drivebc_severity(sev: str) -> str:
    mapping = {"MAJOR": "high", "MODERATE": "medium", "MINOR": "low"}
    return mapping.get(sev.upper(), "low")


def _drivebc_incident_type(subtypes: list[str]) -> str:
    subtype_str = " ".join(subtypes).upper()
    if "ACCIDENT" in subtype_str or "VEHICLE" in subtype_str:
        return Incident.IncidentType.ACCIDENT
    if "HAZARD" in subtype_str:
        return Incident.IncidentType.OBSTRUCTION
    if "CONSTRUCTION" in subtype_str:
        return Incident.IncidentType.CONSTRUCTION
    if "WEATHER" in subtype_str:
        return Incident.IncidentType.WEATHER
    return Incident.IncidentType.TRAFFIC


# ---------------------------------------------------------------------------
# DriveBC polling
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def poll_drivebc(self):
    """Fetch active events from DriveBC Open511 and upsert into Incident table."""
    url = "https://api.open511.gov.bc.ca/events"
    # Metro Vancouver bounding box
    params = {
        "status": "ACTIVE",
        "bbox": "-123.6,49.0,-122.5,49.6",  # Metro Vancouver incl. Surrey, Langley, North/West Van
        "limit": 500,
    }
    try:
        response = httpx.get(url, params=params, timeout=15)
        response.raise_for_status()
        events = response.json().get("events", [])
    except Exception as exc:
        logger.error("poll_drivebc: fetch failed — %s", exc)
        raise self.retry(exc=exc)

    created_count = updated_count = 0

    for event in events:
        event_id = event.get("id", "")
        if not event_id:
            continue

        geo = event.get("geography", {})
        geo_type = geo.get("type", "")
        coords = geo.get("coordinates", [])
        lat, lng = None, None
        if geo_type == "Point" and len(coords) >= 2:
            # Point: [lng, lat]
            lng, lat = float(coords[0]), float(coords[1])
        elif geo_type == "LineString" and coords:
            # LineString: [[lng, lat], ...] — use midpoint
            mid = coords[len(coords) // 2]
            lng, lat = float(mid[0]), float(mid[1])

        roads = event.get("roads", [])
        road_name = roads[0].get("name", "") if roads else ""
        road_from = roads[0].get("from", "") if roads else ""
        road_to = roads[0].get("to", "") if roads else ""
        location = road_name or "Metro Vancouver"
        if road_from and road_to:
            location = f"{road_name} between {road_from} and {road_to}"

        description = event.get("description", "")
        severity = _drivebc_severity(event.get("severity", "MINOR"))
        incident_type = _drivebc_incident_type(event.get("event_subtypes", []))

        _, created = _upsert_incident(
            source_api=Incident.SourceAPI.DRIVEBC,
            external_id=event_id,
            incident_type=incident_type,
            severity=severity,
            title=event.get("headline", description[:80]),
            description=description,
            location=location,
            lat=lat,
            lng=lng,
            expires_in_seconds=300,  # 5 minutes — re-poll refreshes it
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    logger.info("poll_drivebc: %d created, %d updated", created_count, updated_count)
    return {"created": created_count, "updated": updated_count}


# ---------------------------------------------------------------------------
# Vancouver Open Data polling
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def poll_vancouver_opendata(self):
    """Fetch road closures and active construction from Vancouver Open Data."""
    BASE = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets"

    datasets = [
        {
            "dataset_id": "road-ahead-current-road-closures",
            "incident_type": Incident.IncidentType.OBSTRUCTION,
            "severity": "medium",
            "source_prefix": "van_closure",
            "fields": "project,location,comp_date,geo_point_2d",
            "expires_in_seconds": 3600,
        },
        {
            "dataset_id": "road-ahead-projects-under-construction",
            "incident_type": Incident.IncidentType.CONSTRUCTION,
            "severity": "low",
            "source_prefix": "van_construction",
            "fields": "project,location,comp_date,geo_point_2d",
            "expires_in_seconds": 86400,  # 24 hours
        },
    ]

    created_total = updated_total = 0

    for ds in datasets:
        try:
            response = httpx.get(
                f"{BASE}/{ds['dataset_id']}/records",
                params={"limit": 100, "select": ds["fields"]},
                timeout=15,
            )
            response.raise_for_status()
            records = response.json().get("results", [])
        except Exception as exc:
            logger.error("poll_vancouver_opendata: %s failed — %s", ds["dataset_id"], exc)
            continue

        for i, record in enumerate(records):
            location = (record.get("location") or "").strip()
            if not location:
                continue

            project = (record.get("project") or location)[:255]
            geo = record.get("geo_point_2d") or {}
            lat = geo.get("lat")
            lng = geo.get("lon")
            external_id = f"{ds['source_prefix']}_{i}_{location[:40]}"

            _, created = _upsert_incident(
                source_api=Incident.SourceAPI.VANCOUVER_OPENDATA,
                external_id=external_id,
                incident_type=ds["incident_type"],
                severity=ds["severity"],
                title=project[:255],
                description=project,
                location=location,
                lat=lat,
                lng=lng,
                expires_in_seconds=ds["expires_in_seconds"],
            )
            if created:
                created_total += 1
            else:
                updated_total += 1

    logger.info(
        "poll_vancouver_opendata: %d created, %d updated", created_total, updated_total
    )
    return {"created": created_total, "updated": updated_total}


# ---------------------------------------------------------------------------
# Surrey Open Data polling
# ---------------------------------------------------------------------------

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def poll_surrey(self):
    """Fetch active capital construction projects from Surrey ArcGIS API."""
    url = (
        "https://gisservices.surrey.ca/arcgis/rest/services"
        "/CapitalConstructionProjectOperationsDashboard/MapServer/58/query"
    )
    params = {
        "where": "PROJECT_TYPE='Roads'",
        "outFields": "PROJECT_NAME,PROJECT_LOCATION,PROJECT_STATUS,PROJECT_TYPE,PLANNED_COMPLETION_DATE",
        "f": "json",
        "resultRecordCount": 100,
        "outSR": "4326",
        "returnGeometry": "true",
    }

    try:
        response = httpx.get(url, params=params, timeout=15)
        response.raise_for_status()
        features = response.json().get("features", [])
    except Exception as exc:
        logger.error("poll_surrey: fetch failed — %s", exc)
        raise self.retry(exc=exc)

    created_count = updated_count = 0

    for feature in features:
        attrs = feature.get("attributes", {})
        geometry = feature.get("geometry", {})

        location = (attrs.get("PROJECT_LOCATION") or "").strip()
        if not location:
            continue

        # Compute centroid from polygon rings
        lat, lng = None, None
        rings = geometry.get("rings", [])
        if rings and rings[0]:
            lngs = [pt[0] for pt in rings[0]]
            lats = [pt[1] for pt in rings[0]]
            lng = sum(lngs) / len(lngs)
            lat = sum(lats) / len(lats)

        name = (attrs.get("PROJECT_NAME") or location)[:255]
        status = attrs.get("PROJECT_STATUS", "")
        external_id = f"surrey_{name[:60]}_{location[:40]}"

        _, created = _upsert_incident(
            source_api=Incident.SourceAPI.VANCOUVER_OPENDATA,  # closest fit; add SURREY later
            external_id=external_id,
            incident_type=Incident.IncidentType.CONSTRUCTION,
            severity="low",
            title=name,
            description=f"{name} — {status}",
            location=f"{location}, Surrey",
            lat=lat,
            lng=lng,
            expires_in_seconds=86400,
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    logger.info("poll_surrey: %d created, %d updated", created_count, updated_count)
    return {"created": created_count, "updated": updated_count}


# ---------------------------------------------------------------------------
# Expiry / cleanup
# ---------------------------------------------------------------------------

@shared_task
def expire_incidents():
    """Mark incidents past their expires_at as resolved. Runs hourly."""
    now = django_tz.now()
    expired = Incident.objects.filter(
        status=Incident.Status.ACTIVE,
        expires_at__isnull=False,
        expires_at__lt=now,
    )
    count = expired.update(status=Incident.Status.RESOLVED)
    logger.info("expire_incidents: %d incidents marked resolved", count)
    return {"resolved": count}
