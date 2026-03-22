import httpx


# Bounding box covering Metro Vancouver and key routes (Sea-to-Sky, Fraser Valley)
METRO_VAN_BBOX = "-123.5,49.0,-122.5,49.5"

# Open511 event types
EVENT_TYPES = {
    "traffic":          "INCIDENT",
    "construction":     "CONSTRUCTION",
    "weather":          "WEATHER_CONDITION,ROAD_CONDITION",
    "obstruction":      "INCIDENT,SPECIAL_EVENT",
    "natural_disaster": "INCIDENT,WEATHER_CONDITION,ROAD_CONDITION",
    "emergency":        "INCIDENT",
    "general":          "INCIDENT,CONSTRUCTION,WEATHER_CONDITION,ROAD_CONDITION",
}


class DriveBCGetter:
    """
    Fetches live road events from the DriveBC Open511 API.
    Public API — no key required.

    Covers all active incidents (accidents, road closures, hazards)
    on BC roads within the Metro Vancouver bounding box.
    """

    BASE_URL = "https://api.open511.gov.bc.ca/events"

    def __init__(self):
        self.timeout = 10.0

    def fetch(
        self,
        incident_type: str = "traffic",
        location: str = "",
        limit: int = 20,
    ) -> list[dict]:
        """
        Fetch active road events from DriveBC for the given incident type.

        Args:
            incident_type: One of traffic | construction | weather | obstruction |
                           natural_disaster | emergency | general
            location: Optional location string for text filtering after fetch
            limit: Max events to return

        Returns:
            List of simplified event dicts with: id, headline, description,
            severity, event_type, coordinates, roads, status
        """
        event_type = EVENT_TYPES.get(incident_type, EVENT_TYPES["general"])

        params = {
            "status":     "ACTIVE",
            "event_type": event_type,
            "bbox":       METRO_VAN_BBOX,
            "limit":      limit,
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                events = response.json().get("events", [])
        except httpx.RequestError as e:
            return [{"error": str(e), "source": "drivebc"}]
        except httpx.HTTPStatusError as e:
            return [{"error": f"HTTP {e.response.status_code}", "source": "drivebc"}]

        simplified = [self._simplify(e) for e in events]

        # Filter by location string if provided
        if location:
            loc_lower = location.lower()
            simplified = [
                e for e in simplified
                if loc_lower in e.get("description", "").lower()
                or any(loc_lower in r.get("name", "").lower() for r in e.get("roads", []))
            ]

        return simplified

    def _simplify(self, event: dict) -> dict:
        geo = event.get("geography", {})
        coords = geo.get("coordinates", [None, None])
        return {
            "id":          event.get("id", ""),
            "headline":    event.get("headline", ""),
            "description": event.get("description", ""),
            "severity":    event.get("severity", ""),
            "event_type":  event.get("event_type", ""),
            "event_subtypes": event.get("event_subtypes", []),
            "status":      event.get("status", ""),
            "updated":     event.get("updated", ""),
            "coordinates": {"lng": coords[0], "lat": coords[1]},
            "roads":       event.get("roads", []),
            "areas":       [a.get("name", "") for a in event.get("areas", [])],
        }
