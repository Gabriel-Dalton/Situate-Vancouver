import json
from datetime import datetime, timezone

from app.openai_config import build_openai_client
from app.services.vancouver_api import VancouverAPIGetter
from app.services.drivebc import DriveBCGetter
from .schemas import Coordinates, DetectedIncident


class WatcherAgent:
    """
    Monitors live Vancouver data feeds and classifies incidents into
    structured map pins.

    For each watch() call it:
      1. Calls VancouverAPIGetter to pull real records for the incident type
      2. Passes those records + the raw input to the LLM for classification
      3. Returns a structured DetectedIncident
    """

    def __init__(self, model: str = "gpt-4o"):
        self.client = build_openai_client()
        self.model = model
        self.api_getter = VancouverAPIGetter()
        self.drivebc = DriveBCGetter()
        self.system_prompt = (
            "You are the Watcher agent for Situate Vancouver, a real-time city monitoring system. "
            "You receive live records from two sources: DriveBC (accidents, incidents, hazards) "
            "and Vancouver Open Data (road closures, construction, 311 requests).\n\n"
            "RULES:\n"
            "1. Set event_detected=true if ANY of the provided records mention the queried location "
            "in their description, headline, or project fields — even partial matches count "
            "(e.g. 'Knight Street' matches 'Knight Street Bridge').\n"
            "2. NOTE: DriveBC often labels roads as 'Other Roads' — always check the description "
            "field for the actual location name, not just the road name field.\n"
            "3. Set event_detected=false ONLY if no records mention the queried location at all.\n"
            "4. NEVER invent incidents. All values must come directly from the provided records.\n"
            "5. Use the record's description as raw_details and coordinates.lat/lng for the map pin.\n\n"
            "incident_type must be one of: traffic_incident | transit_delay | weather_disruption | emergency | public_safety\n"
            "severity: map DriveBC MAJOR→high, MODERATE→medium, MINOR→low, otherwise use judgement\n"
            "coordinates: use the record's coordinates field when available\n"
            "timestamp: ISO 8601 UTC"
        )

    def watch(
        self,
        feed_data: str,
        source: str = "unknown",
        incident_type: str = "general",
        location: str = "",
    ) -> DetectedIncident:
        """
        Analyze feed data enriched with live Vancouver Open Data records.

        Args:
            feed_data: Raw text — a feed entry, user query, or citizen report.
            source: Feed origin — 'drivebc' | 'translink' | 'weathercan' |
                    '911_dispatch' | 'public_safety' | 'user_report'
            incident_type: Used to select which Vancouver Open Data datasets to query.
                           One of: traffic | construction | transit | emergency |
                           public_safety | obstruction | weather | general
            location: Optional location string to filter Open Data results
                      e.g. "Burrard Bridge", "Downtown", "Knight Street"

        Returns:
            DetectedIncident ready for map pin creation.
        """
        # Step 1 — fetch from Vancouver Open Data (construction, closures, 311)
        van_data = self.api_getter.fetch(
            incident_type=incident_type,
            location=location,
            limit=10,
        )

        # Step 2 — fetch from DriveBC (live accidents, incidents, hazards)
        drivebc_events = self.drivebc.fetch(
            incident_type=incident_type,
            location=location,
            limit=20,
        )

        live_data = {
            "vancouver_open_data": van_data,
            "drivebc_events": drivebc_events,
        }
        # Expose for the Orchestrator to pass downstream to the Retriever
        self.last_live_data = live_data

        # Hard check — if both sources returned no usable records, skip the LLM
        # entirely and return event_detected=False immediately.
        drivebc_has_data = bool(drivebc_events) and not all(
            "error" in e for e in drivebc_events
        )
        van_has_data = any(
            records and not all("error" in r for r in records)
            for records in van_data.values()
        )
        if not drivebc_has_data and not van_has_data:
            return DetectedIncident(
                event_detected=False,
                incident_type="traffic_incident",
                location=location or "Vancouver",
                coordinates=Coordinates(lat=49.2827, lng=-123.1207),
                severity="low",
                summary="No live data found for this query.",
                raw_details="No matching records returned by DriveBC or Vancouver Open Data.",
                affects_transit=False,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )

        # Step 3 — build prompt with the combined real data
        user_message = (
            f"Feed source: {source}\n"
            f"Queried location: {location or 'unspecified'}\n"
            f"Incident type queried: {incident_type}\n\n"
            f"Live data from DriveBC (accidents, incidents, hazards):\n"
            f"{json.dumps(drivebc_events, indent=2)}\n\n"
            f"Live data from Vancouver Open Data (closures, construction, 311):\n"
            f"{json.dumps(van_data, indent=2)}"
        )

        response = self.client.beta.chat.completions.parse(
            model=self.model,
            response_format=DetectedIncident,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.parsed
