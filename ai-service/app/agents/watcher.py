import json

from app.openai_config import build_openai_client
from app.services.vancouver_api import VancouverAPIGetter
from .schemas import DetectedIncident


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
        self.system_prompt = (
            "You are the Watcher agent for Situate Vancouver, a real-time city monitoring system. "
            "You receive live records fetched from the Vancouver Open Data portal for a specific query.\n\n"
            "CRITICAL RULES — you MUST follow these exactly:\n"
            "1. Set event_detected=true ONLY if the live Open Data records contain entries that are "
            "directly relevant to the queried location and incident type.\n"
            "2. If the live records are empty, contain only errors, or do not match the queried "
            "location/type, you MUST set event_detected=false.\n"
            "3. NEVER invent, assume, or infer an incident from general knowledge or training data. "
            "Report ONLY what is explicitly present in the live data records.\n"
            "4. All field values (summary, location, raw_details) must come from the live records. "
            "Do not add details not present in the data.\n\n"
            "incident_type must be one of: traffic_incident | transit_delay | weather_disruption | emergency | public_safety\n"
            "severity must be one of: low | medium | high | critical\n"
            "coordinates: use geo_point_2d from the records when available, otherwise use the "
            "coordinates of the queried Vancouver location (~49.28°N, 123.12°W)\n"
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
        # Step 1 — fetch live records from Vancouver Open Data
        live_data = self.api_getter.fetch(
            incident_type=incident_type,
            location=location,
            limit=10,
        )
        # Expose for the Orchestrator to pass downstream to the Retriever
        self.last_live_data = live_data

        # Step 2 — build prompt with only the real API data
        user_message = (
            f"Feed source: {source}\n"
            f"Queried location: {location or 'unspecified'}\n"
            f"Incident type queried: {incident_type}\n\n"
            f"Live Vancouver Open Data records:\n"
            f"{json.dumps(live_data, indent=2)}"
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
