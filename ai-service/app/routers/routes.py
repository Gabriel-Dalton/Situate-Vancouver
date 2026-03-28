import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.services.geocoder import geocode
from app.services.ors_router import find_routes

router = APIRouter(prefix="/routes", tags=["routes"])

DJANGO_URL = os.environ.get("DJANGO_URL", "http://127.0.0.1:1111")
_BLOCKED = __import__("re").compile(r"[<>{}\[\]\\;`]")
_MAX_LEN = 200


class RouteFindRequest(BaseModel):
    origin: str
    destination: str

    @field_validator("origin", "destination")
    @classmethod
    def validate_address(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Address must not be empty")
        if len(v) > _MAX_LEN:
            raise ValueError(f"Address must be {_MAX_LEN} characters or fewer")
        if _BLOCKED.search(v):
            raise ValueError("Address contains invalid characters")
        return v


class RouteResponse(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    routes: list[dict[str, Any]]
    incidents_avoided: list[dict[str, Any]]


@router.post("/find", response_model=RouteResponse)
def find_route(body: RouteFindRequest) -> RouteResponse:
    """
    Find driving routes from origin to destination.
    Fetches active incidents from Django/Postgres and avoids them.

    Request:
        { "origin": "1234 Main St, Vancouver", "destination": "Waterfront Station" }
    """
    # 1 — Geocode both addresses
    try:
        origin_lat, origin_lng = geocode(body.origin)
    except Exception:
        raise HTTPException(status_code=422, detail=f"Could not geocode origin: {body.origin!r}")

    try:
        dest_lat, dest_lng = geocode(body.destination)
    except Exception:
        raise HTTPException(status_code=422, detail=f"Could not geocode destination: {body.destination!r}")

    # 2 — Fetch active incidents from Django API
    incidents: list[dict] = []
    try:
        resp = httpx.get(
            f"{DJANGO_URL}/api/incidents/",
            params={"status": "active", "limit": 200},
            timeout=5,
        )
        if resp.status_code == 200:
            data = resp.json()
            # DRF returns a list or paginated dict
            incidents = data if isinstance(data, list) else data.get("results", [])
    except Exception:
        pass  # no incidents available — route without avoidance

    # 3 — Find routes avoiding incidents
    try:
        result = find_routes(
            origin_lat=origin_lat,
            origin_lng=origin_lng,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
            incidents=incidents,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Routing service error: {e.response.status_code}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Routing failed: {str(e)}")

    return RouteResponse(
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
        **result,
    )
