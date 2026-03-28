import httpx

# ---------------------------------------------------------------------------
# Surrey ArcGIS REST API
# Base: https://gisservices.surrey.ca/arcgis/rest/services
# No authentication required — public datasets.
# All queries return WGS84 (EPSG:4326) via outSR=4326.
# ---------------------------------------------------------------------------

BASE_URL = "https://gisservices.surrey.ca/arcgis/rest/services"

LAYERS = {
    "construction": {
        "service": "CapitalConstructionProjectOperationsDashboard/MapServer",
        "layer_id": 58,
        "label": "Surrey capital construction projects",
        "fields": [
            "PROJECT_NAME",
            "PROJECT_LOCATION",
            "PROJECT_TYPE",
            "PROJECT_STATUS",
            "PROJECT_PURPOSE",
            "PLANNED_COMPLETION_DATE",
        ],
        "location_field": "PROJECT_LOCATION",
    },
    "traffic_cameras": {
        "service": "OpenData/MapServer",
        "layer_id": 265,
        "label": "Surrey traffic cameras",
        "fields": ["OBJECTID", "CAMERA_ID", "LOCATION"],
        "location_field": "LOCATION",
    },
}

# Types that map to the construction layer
_CONSTRUCTION_TYPES = {"construction", "obstruction", "general"}


class SurreyAPIGetter:
    """
    Fetches live data from Surrey's ArcGIS REST API.

    Usage:
        getter = SurreyAPIGetter()
        records = getter.fetch("construction", location="King George")
        records = getter.fetch("construction")
    """

    def __init__(self):
        self.timeout = 10.0

    def fetch(
        self,
        incident_type: str,
        location: str = "",
        limit: int = 20,
    ) -> dict[str, list[dict]]:
        """
        Fetch Surrey records for a given incident type.

        Returns:
            Dict keyed by layer label → list of normalised records.
        """
        if incident_type not in _CONSTRUCTION_TYPES:
            return {}

        results: dict[str, list[dict]] = {}

        with httpx.Client(timeout=self.timeout) as client:
            for key, cfg in LAYERS.items():
                if key == "traffic_cameras":
                    continue  # only pull cameras if explicitly requested later
                records = self._query_layer(client, cfg, location, limit)
                results[cfg["label"]] = records

        return results

    def _query_layer(
        self,
        client: httpx.Client,
        cfg: dict,
        location: str,
        limit: int,
    ) -> list[dict]:
        url = f"{BASE_URL}/{cfg['service']}/{cfg['layer_id']}/query"

        where = "1=1"
        if location and cfg.get("location_field"):
            safe = location.replace("'", "''")
            where = f"UPPER({cfg['location_field']}) LIKE UPPER('%{safe}%')"

        params = {
            "where": where,
            "outFields": ",".join(cfg["fields"]),
            "f": "json",
            "resultRecordCount": limit,
            "outSR": "4326",
            "returnGeometry": "true",
        }

        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            raw = response.json()
            return [self._normalise(f, cfg) for f in raw.get("features", [])]
        except httpx.HTTPStatusError as e:
            return [{"error": f"HTTP {e.response.status_code}"}]
        except httpx.RequestError as e:
            return [{"error": str(e)}]

    def _normalise(self, feature: dict, cfg: dict) -> dict:
        """Convert ArcGIS feature to a flat dict matching Vancouver Open Data style."""
        attrs = feature.get("attributes", {})
        geometry = feature.get("geometry", {})

        # Extract centroid from polygon rings for a single lat/lng
        lat, lng = None, None
        rings = geometry.get("rings", [])
        if rings and rings[0]:
            lngs = [pt[0] for pt in rings[0]]
            lats = [pt[1] for pt in rings[0]]
            lng = sum(lngs) / len(lngs)
            lat = sum(lats) / len(lats)

        record = {k.lower(): v for k, v in attrs.items()}
        record["source"] = "surrey"
        if lat is not None:
            record["lat"] = lat
            record["lng"] = lng

        return record
