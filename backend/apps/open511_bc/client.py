"""HTTP client for BC Open511 (DriveBC) — public JSON API, no API key."""

from __future__ import annotations

import json
from typing import Any, Mapping
from urllib.parse import urlparse

import httpx

from .exceptions import Open511BCApiError, Open511BCError, Open511BCTransportError

_ALLOWED_HOSTS = frozenset({'api.open511.gov.bc.ca'})

_RESOURCE_PATHS: dict[str, str] = {
    'discovery': '/',
    'events': '/events',
    'areas': '/areas',
    'jurisdiction': '/jurisdiction',
    'jurisdictiongeography': '/jurisdictiongeography',
}


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip('/')


def _assert_allowed_base_url(base_url: str) -> None:
    parsed = urlparse(base_url)
    host = (parsed.hostname or '').lower()
    if host not in _ALLOWED_HOSTS:
        raise Open511BCError(
            f'Open511 BC base URL host must be one of {_ALLOWED_HOSTS}, got {host!r}',
        )


class Open511BCClient:
    """
    DriveBC Open511 API (GET + JSON).

    Docs: https://api.open511.gov.bc.ca/help
    No API key needed for public read access. Comply with BC API terms of use.
    """

    def __init__(
        self,
        base_url: str,
        *,
        timeout_seconds: float = 15.0,
        enforce_host_allowlist: bool = True,
    ) -> None:
        self._base_url = _normalize_base_url(base_url)
        if enforce_host_allowlist:
            _assert_allowed_base_url(self._base_url)
        self._timeout = timeout_seconds

    def _headers(self) -> dict[str, str]:
        return {
            'Accept': 'application/json',
            'User-Agent': 'SituateVancouver-Backend/1.0',
        }

    def fetch_resource(
        self,
        resource: str,
        params: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        GET a documented Open511 resource and return parsed JSON object.

        ``resource`` must be one of: discovery, events, areas, jurisdiction,
        jurisdictiongeography.
        """
        path = _RESOURCE_PATHS.get(resource)
        if path is None:
            raise Open511BCError(f'Unknown Open511 resource: {resource!r}')

        url = f'{self._base_url}{path}'
        q = dict(params or ())
        if 'format' not in q:
            q['format'] = 'json'

        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.get(url, params=q, headers=self._headers())
        except httpx.TimeoutException as exc:
            raise Open511BCTransportError(
                'Request to Open511 BC timed out',
            ) from exc
        except httpx.RequestError as exc:
            raise Open511BCTransportError(
                'Could not reach Open511 BC',
            ) from exc

        if response.status_code >= 400:
            msg = f'Open511 BC returned HTTP {response.status_code}'
            raise Open511BCApiError(msg, status_code=response.status_code)

        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            ctype = response.headers.get('content-type', '')
            raise Open511BCTransportError(
                f'Non-JSON response (HTTP {response.status_code}, {ctype})',
            ) from exc

        if not isinstance(data, dict):
            raise Open511BCTransportError(
                'Open511 BC returned unexpected JSON shape',
            )

        return data
