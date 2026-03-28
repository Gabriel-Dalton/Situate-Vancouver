"""
Geocoding via OpenRouteService Geocode Search (Pelias).
Converts a human address string to lat/lng.
Falls back to Nominatim (OSM) if ORS returns no results.
"""

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

_AI_SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_AI_SERVICE_ROOT / '.env', override=False)
load_dotenv(_AI_SERVICE_ROOT.parent / '.env', override=False)

ORS_KEY = os.environ.get("OPENROUTER_API_KEY", "")
ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Bias results towards Metro Vancouver
METRO_VAN_FOCUS = {"focus.point.lat": 49.2827, "focus.point.lon": -123.1207}


def geocode(address: str) -> tuple[float, float]:
    """
    Convert an address string to (lat, lng).
    Raises ValueError if address cannot be resolved.
    """
    # Try ORS geocoder first
    if ORS_KEY:
        try:
            resp = httpx.get(
                ORS_GEOCODE_URL,
                params={
                    "api_key": ORS_KEY,
                    "text": address,
                    "size": 1,
                    "boundary.country": "CA",
                    **METRO_VAN_FOCUS,
                },
                timeout=10,
                headers={"User-Agent": "SituateVancouver/1.0"},
            )
            resp.raise_for_status()
            features = resp.json().get("features", [])
            if features:
                lng, lat = features[0]["geometry"]["coordinates"]
                return float(lat), float(lng)
        except Exception:
            pass  # fall through to Nominatim

    # Nominatim fallback
    resp = httpx.get(
        NOMINATIM_URL,
        params={
            "q": address,
            "format": "json",
            "limit": 1,
            "countrycodes": "ca",
            "viewbox": "-123.6,49.6,-122.5,49.0",
            "bounded": 1,
        },
        timeout=10,
        headers={"User-Agent": "SituateVancouver/1.0"},
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise ValueError(f"Could not geocode address: {address!r}")

    return float(results[0]["lat"]), float(results[0]["lon"])
