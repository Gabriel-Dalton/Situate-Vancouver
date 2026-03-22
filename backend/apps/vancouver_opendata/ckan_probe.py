"""Shared smoke-probe helpers for Vancouver Open Data (used by health and tests)."""

from __future__ import annotations

from django.conf import settings

from .client import VancouverOpenDataClient
from .exceptions import VancouverOpenDataConfigurationError


def build_ckan_client(*, timeout_seconds: float | None = None) -> VancouverOpenDataClient:
    key = settings.VANCOUVER_OPENDATA_API_KEY
    if not key:
        raise VancouverOpenDataConfigurationError(
            'VANCOUVER_OPENDATA_API_KEY is not configured',
        )
    timeout = (
        float(timeout_seconds)
        if timeout_seconds is not None
        else float(settings.VANCOUVER_OPENDATA_TIMEOUT_SECONDS)
    )
    return VancouverOpenDataClient(
        settings.VANCOUVER_OPENDATA_BASE_URL,
        key,
        timeout_seconds=timeout,
        enforce_host_allowlist=settings.VANCOUVER_OPENDATA_ENFORCE_HOST_ALLOWLIST,
    )


def run_ckan_smoke_probe(client: VancouverOpenDataClient) -> tuple[str, object]:
    """Lightweight catalog request (limit=1). Raises VancouverOpenDataError on failure."""
    result = client.catalog_list_datasets(limit=1, offset=0)
    return 'catalog_datasets', result
