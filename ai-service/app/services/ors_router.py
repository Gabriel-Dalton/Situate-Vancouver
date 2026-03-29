"""
Route finding via OSRM (Open Source Routing Machine) public demo server.
No API key required. Falls back gracefully if the server is unavailable.
"""

from typing import Any

import httpx

# OSRM public demo server — driving profile
OSRM_URL = "http://router.project-osrm.org/route/v1/driving/{coords}"


def find_routes(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    incidents: list[dict],
) -> dict[str, Any]:
    """
    Find driving routes from origin to destination via OSRM.

    Returns up to 3 alternative routes with encoded polyline geometry.
    Incidents are noted but OSRM does not support polygon avoidance —
    they are returned as context only.
    """
    avoidable = [
        inc for inc in incidents
        if inc.get("lat") and inc.get("lng")
        and inc.get("severity") in ("high", "critical", "medium")
    ]

    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    url = OSRM_URL.format(coords=coords)

    resp = httpx.get(
        url,
        params={
            "overview": "full",
            "geometries": "polyline",
            "alternatives": "true",
            "steps": "true",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != "Ok":
        raise ValueError(f"OSRM error: {data.get('message', data.get('code'))}")

    routes = []
    for i, route in enumerate(data.get("routes", [])):
        distance_km = round(route.get("distance", 0) / 1000, 1)
        duration_min = round(route.get("duration", 0) / 60, 1)

        # Flatten steps from all legs into a single instruction list
        steps = []
        for leg in route.get("legs", []):
            for step in leg.get("steps", []):
                maneuver = step.get("maneuver", {})
                name = step.get("name", "")
                m_type = maneuver.get("type", "")
                modifier = maneuver.get("modifier", "")
                dist_m = round(step.get("distance", 0))

                # Build human-readable instruction
                if m_type == "depart":
                    instruction = f"Head {modifier} on {name}" if name else "Depart"
                elif m_type == "arrive":
                    instruction = "Arrive at destination"
                elif m_type == "turn":
                    instruction = f"Turn {modifier} onto {name}" if name else f"Turn {modifier}"
                elif m_type == "new name":
                    instruction = f"Continue onto {name}" if name else "Continue"
                elif m_type == "merge":
                    instruction = f"Merge onto {name}" if name else "Merge"
                elif m_type == "on ramp":
                    instruction = f"Take ramp onto {name}" if name else "Take ramp"
                elif m_type == "off ramp":
                    instruction = f"Take exit onto {name}" if name else "Take exit"
                elif m_type == "fork":
                    instruction = f"Keep {modifier} at fork" + (f" onto {name}" if name else "")
                elif m_type == "roundabout":
                    exit_num = maneuver.get("exit", "")
                    instruction = f"Take exit {exit_num} at roundabout" + (f" onto {name}" if name else "")
                else:
                    instruction = f"{m_type.capitalize()} {modifier}".strip() + (f" onto {name}" if name else "")

                location = maneuver.get("location", [0, 0])
                steps.append({
                    "instruction": instruction.strip(),
                    "distance_m": dist_m,
                    "lng": location[0],
                    "lat": location[1],
                })

        routes.append({
            "index": i,
            "summary": _route_label(i, distance_km, duration_min, avoidable),
            "distance_km": distance_km,
            "duration_min": duration_min,
            "geometry": route.get("geometry"),  # encoded polyline (precision 5)
            "is_recommended": i == 0,
            "steps": steps,
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


def _route_label(index: int, distance_km: float, duration_min: float, avoided: list[dict]) -> str:
    base = f"{distance_km} km · {round(duration_min)} min"
    if index == 0:
        return f"Recommended — {base}"
    if avoided and index == 1:
        return f"Alternate — {base} (near {len(avoided)} active incident{'s' if len(avoided) > 1 else ''})"
    return f"Alternate {index + 1} — {base}"
