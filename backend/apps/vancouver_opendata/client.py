"""HTTP client for Vancouver Open Data (Opendatasoft Explore API v2.1)."""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlparse

import httpx

from .exceptions import (
    VancouverOpenDataApiError,
    VancouverOpenDataError,
    VancouverOpenDataTransportError,
)

_ALLOWED_HOSTS = frozenset({'opendata.vancouver.ca'})

# CKAN-style /api/3/action/* returns 404 HTML on this portal; Explore API is canonical.
_EXPLORE_PREFIX = '/api/explore/v2.1'


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip('/')


def _assert_allowed_base_url(base_url: str) -> None:
    parsed = urlparse(base_url)
    host = (parsed.hostname or '').lower()
    if host not in _ALLOWED_HOSTS:
        raise VancouverOpenDataError(
            f'Open Data base URL host must be one of {_ALLOWED_HOSTS}, got {host!r}',
        )


class VancouverOpenDataClient:
    """
    Opendatasoft Explore API v2.1 (GET + JSON).

    Auth: ``Authorization: Apikey <key>`` (see Opendatasoft docs).
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        timeout_seconds: float = 10.0,
        enforce_host_allowlist: bool = True,
    ) -> None:
        self._base_url = _normalize_base_url(base_url)
        if enforce_host_allowlist:
            _assert_allowed_base_url(self._base_url)
        self._api_key = api_key.strip()
        self._timeout = timeout_seconds

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {
            'Accept': 'application/json',
            'User-Agent': 'SituateVancouver-Backend/1.0',
        }
        if self._api_key:
            headers['Authorization'] = f'Apikey {self._api_key}'
        return headers

    def _get_json(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        path = path if path.startswith('/') else f'/{path}'
        url = f'{self._base_url}{path}'
        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.get(url, params=params or {}, headers=self._headers())
        except httpx.TimeoutException as exc:
            raise VancouverOpenDataTransportError(
                'Request to Vancouver Open Data timed out',
            ) from exc
        except httpx.RequestError as exc:
            raise VancouverOpenDataTransportError(
                'Could not reach Vancouver Open Data',
            ) from exc

        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            ctype = response.headers.get('content-type', '')
            raise VancouverOpenDataTransportError(
                f'Non-JSON response (HTTP {response.status_code}, {ctype})',
            ) from exc

        if not isinstance(data, dict):
            raise VancouverOpenDataTransportError(
                'Vancouver Open Data returned unexpected JSON shape',
            )

        self._raise_if_error_envelope(data, response.status_code)
        return data

    def _raise_if_error_envelope(self, data: dict[str, Any], status_code: int) -> None:
        if status_code >= 400:
            msg = data.get('message') if isinstance(data.get('message'), str) else None
            err = data.get('error')
            if msg is None and isinstance(err, str):
                msg = err
            if msg is None:
                msg = f'HTTP {status_code}'
            code = data.get('error_code') if isinstance(data.get('error_code'), str) else None
            raise VancouverOpenDataApiError(msg, api_error_code=code)

        err_code = data.get('error_code')
        if isinstance(err_code, str):
            msg = data.get('message')
            raise VancouverOpenDataApiError(
                str(msg) if isinstance(msg, str) else err_code,
                api_error_code=err_code,
            )

    def catalog_list_datasets(
        self,
        *,
        limit: int = 10,
        offset: int = 0,
        search: str | None = None,
    ) -> dict[str, Any]:
        """
        GET catalog/datasets. Returns the portal JSON: total_count, results, ...
        """
        limit = max(1, min(int(limit), 100))
        offset = max(0, int(offset))
        params: dict[str, Any] = {'limit': limit, 'offset': offset}
        if search is not None and search != '*' and search.strip() != '':
            params['search'] = search.strip()

        return self._get_json(f'{_EXPLORE_PREFIX}/catalog/datasets', params=params)
