"""
Celery polling tasks — fetch live data from all upstream APIs and upsert
into the Incident table. Runs on a schedule via django-celery-beat.

Schedules (configured in Django admin or via data migration):
  poll_drivebc            — every 5 minutes
  poll_vancouver_opendata — every 30 minutes
  poll_surrey             — every 30 minutes
  poll_bchydro            — every 15 minutes
  expire_incidents        — every hour
"""

import logging
import time
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from datetime import timedelta

import httpx
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone as django_tz

from .models import Incident, OutageGeocode

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task lock — prevents overlapping runs of the same polling task
# ---------------------------------------------------------------------------

@contextmanager
def _task_lock(lock_key: str, timeout: int):
    """
    Acquire a Redis-backed lock for `timeout` seconds.
    Yields True if the lock was acquired, False if another instance is running.
    Always releases the lock on exit.
    """
    acquired = cache.add(lock_key, '1', timeout=timeout)
    try:
        yield acquired
    finally:
        if acquired:
            cache.delete(lock_key)


def _retry_after(response: httpx.Response) -> int:
    """Parse Retry-After header (seconds). Falls back to 60."""
    val = response.headers.get('Retry-After', '')
    try:
        return max(int(val), 10)
    except (ValueError, TypeError):
        return 60


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

@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def poll_drivebc(self):
    """Fetch active events from DriveBC Open511 and upsert into Incident table."""
    with _task_lock('lock:poll_drivebc', timeout=540) as acquired:
        if not acquired:
            logger.info('poll_drivebc: skipping — another instance is running')
            return {'skipped': True}

        url = "https://api.open511.gov.bc.ca/events"
        params = {
            "status": "ACTIVE",
            "bbox": "-123.6,49.0,-122.5,49.6",
            "limit": 500,
        }
        try:
            response = httpx.get(url, params=params, timeout=15)
            if response.status_code == 429:
                wait = _retry_after(response)
                logger.warning('poll_drivebc: 429 rate limited — retrying in %ds', wait)
                raise self.retry(exc=httpx.HTTPStatusError(
                    '429', request=response.request, response=response,
                ), countdown=wait)
            response.raise_for_status()
            events = response.json().get("events", [])
        except self.MaxRetriesExceededError:
            logger.error("poll_drivebc: max retries exceeded, giving up until next schedule")
            return {'error': 'max_retries'}
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                raise  # already handled above, let Celery manage the retry
            logger.error("poll_drivebc: HTTP error — %s", exc)
            raise self.retry(exc=exc, countdown=120)
        except Exception as exc:
            logger.error("poll_drivebc: fetch failed — %s", exc)
            raise self.retry(exc=exc, countdown=120)

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

@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def poll_vancouver_opendata(self):
    """Fetch road closures and active construction from Vancouver Open Data."""
    with _task_lock('lock:poll_vancouver_opendata', timeout=1800) as acquired:
        if not acquired:
            logger.info('poll_vancouver_opendata: skipping — another instance is running')
            return {'skipped': True}

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
                "expires_in_seconds": 86400,
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
                if response.status_code == 429:
                    wait = _retry_after(response)
                    logger.warning('poll_vancouver_opendata: 429 — retrying in %ds', wait)
                    raise self.retry(countdown=wait)
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

@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def poll_surrey(self):
    """Fetch active capital construction projects from Surrey ArcGIS API."""
    with _task_lock('lock:poll_surrey', timeout=1800) as acquired:
        if not acquired:
            logger.info('poll_surrey: skipping — another instance is running')
            return {'skipped': True}

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
            if response.status_code == 429:
                wait = _retry_after(response)
                logger.warning('poll_surrey: 429 — retrying in %ds', wait)
                raise self.retry(countdown=wait)
            response.raise_for_status()
            features = response.json().get("features", [])
        except Exception as exc:
            logger.error("poll_surrey: fetch failed — %s", exc)
            raise self.retry(exc=exc, countdown=120)

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
                source_api=Incident.SourceAPI.VANCOUVER_OPENDATA,
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
# BC Hydro power outage polling
# ---------------------------------------------------------------------------

_BCHYDRO_RSS_URL = 'https://www.bchydro.com/power-outages/app/outage-rss.xml'
_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
_NOMINATIM_USER_AGENT = 'SituateVancouver/1.0 (contact@situatevancouver.ca)'
# Retry failed geocodes after 7 days (Nominatim data improves over time)
_GEOCODE_RETRY_DAYS = 7


def _nominatim_geocode(location: str) -> tuple[float, float] | None:
    """
    Geocode a location string using Nominatim (OpenStreetMap).
    Appends ", British Columbia, Canada" to bias results to BC.
    Returns (lat, lng) or None if no result.
    """
    query = f'{location}, British Columbia, Canada'
    try:
        resp = httpx.get(
            _NOMINATIM_URL,
            params={'q': query, 'format': 'json', 'limit': 1, 'countrycodes': 'ca'},
            headers={'User-Agent': _NOMINATIM_USER_AGENT},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return float(results[0]['lat']), float(results[0]['lon'])
    except Exception as exc:
        logger.warning('_nominatim_geocode failed for "%s": %s', location, exc)
    return None


def _get_or_geocode(location_key: str) -> tuple[float, float] | None:
    """
    Return cached (lat, lng) for a location_key, or geocode and cache it.
    Failed geocodes are cached too and retried after _GEOCODE_RETRY_DAYS.
    Adds a 1-second sleep between Nominatim calls to respect rate limits.
    """
    try:
        cached = OutageGeocode.objects.get(location_key=location_key)
        # Re-attempt failed geocodes after retry window
        if cached.failed:
            retry_after = cached.retried_at or cached.geocoded_at
            if django_tz.now() - retry_after < timedelta(days=_GEOCODE_RETRY_DAYS):
                return None
            # Time to retry — fall through to geocode below
        else:
            if cached.lat is not None and cached.lng is not None:
                return cached.lat, cached.lng
            return None
    except OutageGeocode.DoesNotExist:
        pass

    # Rate-limit: 1 req/s to Nominatim
    time.sleep(1)
    result = _nominatim_geocode(location_key)

    if result:
        lat, lng = result
        OutageGeocode.objects.update_or_create(
            location_key=location_key,
            defaults={'lat': lat, 'lng': lng, 'failed': False, 'retried_at': django_tz.now()},
        )
        return lat, lng
    else:
        OutageGeocode.objects.update_or_create(
            location_key=location_key,
            defaults={'lat': None, 'lng': None, 'failed': True, 'retried_at': django_tz.now()},
        )
        return None


def _parse_bchydro_rss(xml_text: str) -> list[dict]:
    """
    Parse BC Hydro outage RSS XML into a list of outage dicts.
    Each dict has: location, customers_affected, external_id, description.
    """
    outages = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        logger.error('_parse_bchydro_rss: XML parse error — %s', exc)
        return outages

    # Standard RSS: <rss><channel><item>...</item></channel></rss>
    items = root.findall('.//item')
    for item in items:
        title = (item.findtext('title') or '').strip()
        description = (item.findtext('description') or '').strip()
        guid = (item.findtext('guid') or title).strip()

        if not title:
            continue

        # Extract customer count from description if present
        # BC Hydro format: "Customers Affected: 142<br/>Crew Status: On-site"
        customers = 0
        desc_lower = description.lower()
        for marker in ('customers affected:', 'customers:', 'affected:'):
            idx = desc_lower.find(marker)
            if idx != -1:
                # Grab next token after marker
                rest = description[idx + len(marker):].strip()
                token = rest.split()[0].replace(',', '').replace('<', '') if rest else ''
                if token.isdigit():
                    customers = int(token)
                break

        # Severity based on customer count
        if customers >= 500:
            severity = 'high'
        elif customers >= 100:
            severity = 'medium'
        else:
            severity = 'low'

        outages.append({
            'location': title,
            'customers_affected': customers,
            'severity': severity,
            'external_id': guid[:255],
            'description': description or f'Power outage affecting {customers} customers in {title}.',
        })

    return outages


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def poll_bchydro(self):
    """
    Fetch BC Hydro outage RSS, geocode new locations, upsert into Incident table.
    Runs every 15 minutes to match BC Hydro's own update cadence.
    """
    with _task_lock('lock:poll_bchydro', timeout=840) as acquired:
        if not acquired:
            logger.info('poll_bchydro: skipping — another instance is running')
            return {'skipped': True}

        try:
            resp = httpx.get(
                _BCHYDRO_RSS_URL,
                headers={'User-Agent': _NOMINATIM_USER_AGENT},
                timeout=15,
                follow_redirects=True,
            )
            resp.raise_for_status()
        except Exception as exc:
            logger.error('poll_bchydro: RSS fetch failed — %s', exc)
            raise self.retry(exc=exc, countdown=120)

        outages = _parse_bchydro_rss(resp.text)
        if not outages:
            logger.info('poll_bchydro: no outages in feed (or parse failed)')
            return {'created': 0, 'updated': 0, 'skipped': 0}

        created_count = updated_count = skipped_count = 0

        for outage in outages:
            coords = _get_or_geocode(outage['location'])
            lat, lng = (coords[0], coords[1]) if coords else (None, None)

            if lat is None:
                skipped_count += 1
                # Still upsert — we can show a warning dot if coords arrive later
            customers = outage['customers_affected']
            title = (
                f'Power outage — {outage["location"]}'
                + (f' ({customers:,} customers affected)' if customers else '')
            )

            _, created = _upsert_incident(
                source_api=Incident.SourceAPI.BCHYDRO,
                external_id=outage['external_id'],
                incident_type=Incident.IncidentType.POWER_OUTAGE,
                severity=outage['severity'],
                title=title[:255],
                description=outage['description'],
                location=outage['location'],
                lat=lat,
                lng=lng,
                expires_in_seconds=900,  # 15 min — re-poll refreshes active outages
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        logger.info(
            'poll_bchydro: %d created, %d updated, %d without coords',
            created_count, updated_count, skipped_count,
        )
        return {'created': created_count, 'updated': updated_count, 'skipped': skipped_count}


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
