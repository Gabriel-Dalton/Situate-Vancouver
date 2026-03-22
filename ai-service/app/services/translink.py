import os
import httpx
from google.transit import gtfs_realtime_pb2


# Map natural language terms → TransLink route IDs (GTFS route_id)
ROUTE_ALIASES: dict[str, list[str]] = {
    "canada line":      ["CAN"],
    "expo line":        ["EXP"],
    "millennium line":  ["MIL"],
    "skytrain":         ["CAN", "EXP", "MIL"],
    "seabus":           ["SB"],
    "west coast express": ["WCE"],
    "99 b-line":        ["099"],
    "b-line":           ["099"],
    "r4":               ["R4"],
    "r5":               ["R5"],
}

# Map station/location names → stop codes that appear in alert descriptions
LOCATION_KEYWORDS: dict[str, list[str]] = {
    "waterfront":           ["waterfront"],
    "burrard":              ["burrard"],
    "granville":            ["granville"],
    "stadium":              ["stadium", "chinatown"],
    "main street":          ["main street", "science world"],
    "broadway":             ["broadway", "city hall"],
    "commercial":           ["commercial", "broadway"],
    "metrotown":            ["metrotown"],
    "joyce":                ["joyce"],
    "surrey central":       ["surrey central"],
    "king george":          ["king george"],
    "vancouver city centre":["city centre", "city center"],
    "yaletown":             ["yaletown"],
    "olympic village":      ["olympic"],
    "marine drive":         ["marine drive"],
    "richmond":             ["richmond", "brighouse"],
    "airport":              ["airport", "yvr"],
    "lougheed":             ["lougheed"],
    "production way":       ["production way"],
    "lafarge":              ["lafarge"],
    "vcc clark":            ["vcc", "clark"],
}


class TransLinkGetter:
    """
    Fetches live service alerts from the TransLink GTFS-RT feed.
    Covers all modes: buses, Canada Line, Expo Line, Millennium Line,
    SeaBus, and West Coast Express.

    Requires TRANSLINK_API_KEY — free registration at developer.translink.ca
    """

    ALERTS_URL = "https://gtfs.translink.ca/v2/gtfsalerts"

    def __init__(self):
        self.api_key = os.environ.get("TRANSLINK_API") or os.environ.get("TRANSLINK_API_KEY", "")
        self.timeout = 10.0

    def fetch(
        self,
        location: str = "",
        route_name: str = "",
        limit: int = 20,
    ) -> list[dict]:
        """
        Fetch active service alerts, filtered by location or route name.

        Args:
            location: Station or area name e.g. "Waterfront", "Broadway"
            route_name: Line name e.g. "Canada Line", "Expo Line", "99 B-Line"
            limit: Max alerts to return

        Returns:
            List of alert dicts with: id, header, description, routes,
            affected_stops, effect, severity, cause
        """
        if not self.api_key:
            return [{"error": "TRANSLINK_API not set — register at developer.translink.ca"}]

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(
                    self.ALERTS_URL,
                    params={"apikey": self.api_key},
                )
                response.raise_for_status()
        except httpx.RequestError as e:
            return [{"error": str(e), "source": "translink"}]
        except httpx.HTTPStatusError as e:
            return [{"error": f"HTTP {e.response.status_code}", "source": "translink"}]

        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)

        alerts = []
        for entity in feed.entity:
            if not entity.HasField("alert"):
                continue
            alert = self._parse_alert(entity)
            alerts.append(alert)

        # Filter by route name if provided
        if route_name:
            route_ids = self._resolve_route_ids(route_name)
            if route_ids:
                alerts = [
                    a for a in alerts
                    if any(r in a.get("routes", []) for r in route_ids)
                    or any(
                        r.lower() in " ".join(a.get("routes", [])).lower()
                        for r in route_ids
                    )
                ]

        # Filter by location/station if provided
        if location:
            loc_keywords = self._resolve_location_keywords(location)
            filtered = []
            for a in alerts:
                text = (a.get("header", "") + " " + a.get("description", "")).lower()
                if any(kw in text for kw in loc_keywords):
                    filtered.append(a)
            if filtered:
                alerts = filtered

        return alerts[:limit]

    def _parse_alert(self, entity) -> dict:
        alert = entity.alert

        header = ""
        description = ""
        for t in alert.header_text.translation:
            if t.language in ("en", ""):
                header = t.text
                break
        for t in alert.description_text.translation:
            if t.language in ("en", ""):
                description = t.text
                break

        routes = []
        stops = []
        for informed in alert.informed_entity:
            if informed.route_id:
                routes.append(informed.route_id)
            if informed.stop_id:
                stops.append(informed.stop_id)

        effect_map = {
            1: "NO_SERVICE", 2: "REDUCED_SERVICE", 3: "SIGNIFICANT_DELAYS",
            4: "DETOUR", 5: "ADDITIONAL_SERVICE", 6: "MODIFIED_SERVICE",
            7: "OTHER_EFFECT", 8: "UNKNOWN_EFFECT", 9: "STOP_MOVED",
        }
        cause_map = {
            1: "UNKNOWN_CAUSE", 2: "OTHER_CAUSE", 3: "TECHNICAL_PROBLEM",
            4: "STRIKE", 5: "DEMONSTRATION", 6: "ACCIDENT",
            7: "HOLIDAY", 8: "WEATHER", 9: "MAINTENANCE",
            10: "CONSTRUCTION", 11: "POLICE_ACTIVITY", 12: "MEDICAL_EMERGENCY",
        }

        return {
            "id":          entity.id,
            "header":      header,
            "description": description,
            "routes":      list(set(routes)),
            "stops":       list(set(stops)),
            "effect":      effect_map.get(alert.effect, "UNKNOWN"),
            "cause":       cause_map.get(alert.cause, "UNKNOWN"),
        }

    def _resolve_route_ids(self, route_name: str) -> list[str]:
        name_lower = route_name.lower()
        for alias, ids in ROUTE_ALIASES.items():
            if alias in name_lower:
                return ids
        return []

    def _resolve_location_keywords(self, location: str) -> list[str]:
        loc_lower = location.lower()
        for key, keywords in LOCATION_KEYWORDS.items():
            if key in loc_lower or any(kw in loc_lower for kw in keywords):
                return keywords
        # Fall back to the raw location string split into words
        return [w for w in loc_lower.split() if len(w) > 3]
