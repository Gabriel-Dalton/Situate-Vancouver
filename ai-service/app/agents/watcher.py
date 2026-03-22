import os
import json
from openai import OpenAI
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
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        self.model = model
        self.api_getter = VancouverAPIGetter()
        self.system_prompt = (
            "You are the Watcher agent for Situate Vancouver, a real-time city monitoring system. "
            "You receive raw feed data AND live records fetched from the Vancouver Open Data portal. "
            "Use both to classify the situation into a structured incident for display on a map.\n\n"
            "incident_type must be one of: traffic_incident | transit_delay | weather_disruption | emergency | public_safety\n"
            "severity must be one of: low | medium | high | critical\n"
            "coordinates: use geo_point_2d from the records when available, otherwise estimate "
            "for the Vancouver area (~49.28°N, 123.12°W)\n"
            "timestamp: ISO 8601 UTC\n\n"
            "Be specific about Vancouver geography — name exact streets, stations, and bridges."
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

        # Step 2 — build prompt with both the raw input and real data
        user_message = (
            f"Feed source: {source}\n\n"
            f"Raw feed data:\n{feed_data}\n\n"
            f"Live Vancouver Open Data records ({incident_type}):\n"
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
