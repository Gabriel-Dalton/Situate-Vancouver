"""
Route finding via OpenRouteService Directions V2.
Accepts origin/destination coordinates and a list of incidents to avoid.
Returns up to 3 route options with geometry and summary.
"""

import math
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

_AI_SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_AI_SERVICE_ROOT / '.env', override=False)
load_dotenv(_AI_SERVICE_ROOT.parent / '.env', override=False)

ORS_KEY = os.environ.get("OPENROUTER_API_KEY", "")
ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/json"

# Radius in metres around each incident to avoid
AVOID_RADIUS_M = 150


def _circle_polygon(lat: float, lng: float, radius_m: float = AVOID_RADIUS_M) -> dict:
    """
    Build a GeoJSON Polygon approximating a circle around (lat, lng).
    Uses 16 points for a smooth enough approximation.
    """
    points = 16
    coords = []
    for i in range(points):
        angle = 2 * math.pi * i / points
        # Rough degree offsets (1 deg lat ≈ 111_000 m, 1 deg lng ≈ 111_000 * cos(lat) m)
        dlat = (radius_m / 111_000) * math.cos(angle)
        dlng = (radius_m / (111_000 * math.cos(math.radians(lat)))) * math.sin(angle)
        coords.append([lng + dlng, lat + dlat])
    coords.append(coords[0])  # close the ring
    return {"type": "Polygon", "coordinates": [coords]}


def find_routes(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    incidents: list[dict],
) -> dict[str, Any]:
    """
    Find driving routes from origin to destination, avoiding active incidents.

    Args:
        origin_lat/lng: Start coordinates
        dest_lat/lng: End coordinates
        incidents: List of dicts with keys: lat, lng, title, severity, incident_type

    Returns:
        Dict with keys: routes, incidents_avoided
    """
    # Build avoid polygons from high/medium severity incidents
    avoidable = [
        inc for inc in incidents
        if inc.get("lat") and inc.get("lng")
        and inc.get("severity") in ("high", "critical", "medium")
    ]

    avoid_polygons = None
    if avoidable:
        avoid_polygons = {
            "type": "MultiPolygon",
            "coordinates": [
                _circle_polygon(inc["lat"], inc["lng"])["coordinates"]
                for inc in avoidable
            ],
        }

    coords = [[origin_lng, origin_lat], [dest_lng, dest_lat]]
    headers = {
        "Authorization": f"Bearer {ORS_KEY}" if ORS_KEY and not ORS_KEY.startswith("Bearer ") else ORS_KEY,
        "Content-Type": "application/json",
    }

    # Try progressively simpler requests — some ORS tiers don't allow
    # avoid_polygons or alternative_routes.
    attempts: list[dict[str, Any]] = [
        {
            "coordinates": coords,
            "alternative_routes": {"target_count": 3, "weight_factor": 1.6},
            "instructions": False,
            "geometry": True,
            "units": "km",
            **({"options": {"avoid_polygons": avoid_polygons}} if avoid_polygons else {}),
        },
        # Without avoid_polygons
        {
            "coordinates": coords,
            "alternative_routes": {"target_count": 3, "weight_factor": 1.6},
            "instructions": False,
            "geometry": True,
            "units": "km",
        },
        # Minimal — single route, no extras
        {
            "coordinates": coords,
            "instructions": False,
            "geometry": True,
            "units": "km",
        },
    ]

    data: dict = {}
    for body in attempts:
        resp = httpx.post(ORS_DIRECTIONS_URL, json=body, headers=headers, timeout=15)
        if resp.status_code == 403:
            continue
        resp.raise_for_status()
        data = resp.json()
        # If this attempt dropped avoid_polygons, clear avoidable so the
        # response doesn't falsely claim incidents were avoided.
        if "options" not in body:
            avoidable = []
        break
    else:
        raise httpx.HTTPStatusError(
            "ORS returned 403 for all request variants",
            request=resp.request,
            response=resp,
        )

    routes = []
    for i, route in enumerate(data.get("routes", [])):
        summary = route.get("summary", {})
        routes.append({
            "index": i,
            "summary": _route_label(i, summary, avoidable),
            "distance_km": round(summary.get("distance", 0), 1),
            "duration_min": round(summary.get("duration", 0) / 60, 1),
            "geometry": route.get("geometry"),  # encoded polyline
            "is_recommended": i == 0,
        })

    return {
        "routes": routes,
        "incidents_avoided": [
            {
                "title": inc.get("title", "Incident"),
                "severity": inc.get("severity", "low"),
                "incident_type": inc.get("incident_type", "general"),
                "lat": inc["lat"],
                "lng": inc["lng"],
            }
            for inc in avoidable
        ],
    }


def _route_label(index: int, summary: dict, avoided: list[dict]) -> str:
    dist = round(summary.get("distance", 0), 1)
    mins = round(summary.get("duration", 0) / 60)
    base = f"{dist} km · {mins} min"
    if index == 0:
        return f"Recommended — {base}"
    if avoided and index == 1:
        return f"Alternate — {base} (avoids {len(avoided)} incident{'s' if len(avoided) > 1 else ''})"
    return f"Alternate {index + 1} — {base}"
