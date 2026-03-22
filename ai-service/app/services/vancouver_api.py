import os
import httpx
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Dataset registry
# Each entry maps an incident type to one or more Opendatasoft dataset IDs
# and the fields to pull from each.
# ---------------------------------------------------------------------------

@dataclass
class DatasetConfig:
    dataset_id: str
    label: str
    # Field used for location text-search filtering (ODSQL)
    location_field: str
    # Fields to return (empty = return all)
    select_fields: list[str] = field(default_factory=list)


DATASETS: dict[str, list[DatasetConfig]] = {
    "traffic": [
        DatasetConfig(
            dataset_id="road-ahead-current-road-closures",
            label="Current road closures",
            location_field="location",
            select_fields=["project", "location", "comp_date", "url_link", "geo_point_2d"],
        ),
    ],
    "construction": [
        DatasetConfig(
            dataset_id="road-ahead-projects-under-construction",
            label="Active construction projects",
            location_field="location",
            select_fields=["project", "location", "comp_date", "url_link", "geo_point_2d"],
        ),
        DatasetConfig(
            dataset_id="road-ahead-upcoming-projects",
            label="Upcoming road projects",
            location_field="location",
            select_fields=["project", "location", "comp_date", "url_link", "geo_point_2d"],
        ),
    ],
    "transit": [
        DatasetConfig(
            dataset_id="rapid-transit-stations",
            label="Rapid transit stations",
            location_field="station",
            select_fields=["station", "geo_local_area", "geo_point_2d"],
        ),
    ],
    "emergency": [
        DatasetConfig(
            dataset_id="3-1-1-service-requests",
            label="311 service requests",
            location_field="address",
            select_fields=[
                "service_request_type",
                "department",
                "status",
                "address",
                "local_area",
                "service_request_open_timestamp",
                "latitude",
                "longitude",
            ],
        ),
    ],
    "public_safety": [
        DatasetConfig(
            dataset_id="3-1-1-service-requests",
            label="311 service requests",
            location_field="address",
            select_fields=[
                "service_request_type",
                "department",
                "status",
                "address",
                "local_area",
                "service_request_open_timestamp",
                "latitude",
                "longitude",
            ],
        ),
    ],
    "obstruction": [
        DatasetConfig(
            dataset_id="road-ahead-current-road-closures",
            label="Current road closures",
            location_field="location",
            select_fields=["project", "location", "comp_date", "url_link", "geo_point_2d"],
        ),
        DatasetConfig(
            dataset_id="3-1-1-service-requests",
            label="311 service requests",
            location_field="address",
            select_fields=[
                "service_request_type",
                "status",
                "address",
                "local_area",
                "service_request_open_timestamp",
                "latitude",
                "longitude",
            ],
        ),
    ],
    "weather": [
        # Vancouver Open Data has no real-time weather feed.
        # Snow removal routes give useful winter-condition context.
        DatasetConfig(
            dataset_id="snow-removal-routes",
            label="Snow removal routes",
            location_field="",
            select_fields=[],
        ),
    ],
    "natural_disaster": [
        # Road closures are the most direct indicator of disaster-related blockages
        DatasetConfig(
            dataset_id="road-ahead-current-road-closures",
            label="Current road closures",
            location_field="location",
            select_fields=["project", "location", "comp_date", "url_link", "geo_point_2d"],
        ),
        # 311 requests surface flood reports, fallen trees, debris, sinkholes
        DatasetConfig(
            dataset_id="3-1-1-service-requests",
            label="311 disaster-related service requests",
            location_field="address",
            select_fields=[
                "service_request_type",
                "department",
                "status",
                "address",
                "local_area",
                "service_request_open_timestamp",
                "latitude",
                "longitude",
            ],
        ),
        # Snow removal routes provide winter infrastructure context
        DatasetConfig(
            dataset_id="snow-removal-routes",
            label="Snow removal routes",
            location_field="",
            select_fields=[],
        ),
    ],
    "general": [
        DatasetConfig(
            dataset_id="road-ahead-current-road-closures",
            label="Current road closures",
            location_field="location",
            select_fields=["project", "location", "comp_date", "geo_point_2d"],
        ),
        DatasetConfig(
            dataset_id="3-1-1-service-requests",
            label="311 service requests",
            location_field="address",
            select_fields=[
                "service_request_type",
                "status",
                "address",
                "local_area",
                "latitude",
                "longitude",
            ],
        ),
    ],
}


# ---------------------------------------------------------------------------
# APIGetter
# ---------------------------------------------------------------------------

class VancouverAPIGetter:
    """
    Fetches live data from the Vancouver Open Data portal (Opendatasoft v2.1)
    for a given incident type and optional location filter.

    Usage:
        getter = VancouverAPIGetter()
        records = getter.fetch("traffic", location="Burrard Bridge")
        records = getter.fetch("construction")
        records = getter.fetch("emergency", location="Downtown")
    """

    BASE_URL = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets"

    def __init__(self):
        self.api_key = os.environ.get("VANCOUVER_OPENDATA_API_KEY", "")
        self.timeout = float(os.environ.get("VANCOUVER_OPENDATA_TIMEOUT_SECONDS", 10))
        self.headers = {"Authorization": f"Apikey {self.api_key}"}

    def fetch(
        self,
        incident_type: str,
        location: str = "",
        limit: int = 20,
    ) -> dict[str, list[dict]]:
        """
        Fetch records for an incident type, optionally filtered by location.

        Args:
            incident_type: One of traffic | construction | transit | emergency |
                           public_safety | obstruction | weather | general
            location: Optional location string to filter results
                      e.g. "Burrard Bridge", "Downtown", "Knight Street"
            limit: Max records to return per dataset (default 20)

        Returns:
            Dict keyed by dataset label → list of records.
            e.g. {
                "Current road closures": [...],
                "311 service requests": [...],
            }
        """
        configs = DATASETS.get(incident_type, DATASETS["general"])
        results: dict[str, list[dict]] = {}

        with httpx.Client(headers=self.headers, timeout=self.timeout) as client:
            for config in configs:
                records = self._fetch_dataset(
                    client=client,
                    config=config,
                    location=location,
                    limit=limit,
                )
                results[config.label] = records

        return results

    def _fetch_dataset(
        self,
        client: httpx.Client,
        config: DatasetConfig,
        location: str,
        limit: int,
    ) -> list[dict]:
        """Fetch records from a single dataset, applying location filter if provided."""
        params: dict = {"limit": limit}

        if config.select_fields:
            params["select"] = ",".join(config.select_fields)

        if location and config.location_field:
            # ODSQL text search on the location field
            safe_location = location.replace('"', "")
            params["where"] = f'search({config.location_field}, "{safe_location}")'

        url = f"{self.BASE_URL}/{config.dataset_id}/records"

        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            return response.json().get("results", [])
        except httpx.HTTPStatusError as e:
            return [{"error": f"HTTP {e.response.status_code}", "dataset": config.dataset_id}]
        except httpx.RequestError as e:
            return [{"error": str(e), "dataset": config.dataset_id}]
