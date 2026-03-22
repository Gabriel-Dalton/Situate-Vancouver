"""HTTP client for Vancouver Open Data (Opendatasoft Explore API v2.1)."""

from __future__ import annotations

import json
from typing import Any, Mapping, Sequence
from urllib.parse import quote, urlparse

import httpx

from .exceptions import (
    VancouverOpenDataApiError,
    VancouverOpenDataError,
    VancouverOpenDataTransportError,
)

_ALLOWED_HOSTS = frozenset({'opendata.vancouver.ca'})

# CKAN-style /api/3/action/* returns 404 HTML on this portal; Explore API is canonical.
_EXPLORE_PREFIX = '/api/explore/v2.1'

# Explore catalog: offset + limit must be strictly below this bound (see portal swagger).
_PORTAL_CATALOG_OFFSET_LIMIT_SUM_MAX = 10000


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

    def _get_json(
        self,
        path: str,
        params: Mapping[str, Any] | Sequence[tuple[str, Any]] | None = None,
    ) -> dict[str, Any]:
        path = path if path.startswith('/') else f'/{path}'
        url = f'{self._base_url}{path}'
        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.get(url, params=params or (), headers=self._headers())
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

    def catalog_list_all_datasets(
        self,
        *,
        search: str | None = None,
        page_size: int = 100,
    ) -> dict[str, Any]:
        """
        Walk catalog pages until all datasets are fetched or the portal window is exhausted.

        The Explore API caps ``offset + limit`` below ``_PORTAL_CATALOG_OFFSET_LIMIT_SUM_MAX``;
        if the catalog is larger, ``truncated`` is True in the returned dict.
        """
        page_size = max(1, min(int(page_size), 100))
        all_results: list[Any] = []
        total_count: int | None = None
        offset = 0
        truncated = False

        while True:
            if offset + page_size >= _PORTAL_CATALOG_OFFSET_LIMIT_SUM_MAX:
                truncated = True
                break

            batch = self.catalog_list_datasets(
                limit=page_size,
                offset=offset,
                search=search,
            )

            if total_count is None:
                tc = batch.get('total_count')
                if isinstance(tc, int):
                    total_count = tc

            results = batch.get('results')
            if not isinstance(results, list):
                break

            all_results.extend(results)

            if total_count is not None and len(all_results) >= total_count:
                break
            if len(results) < page_size:
                break

            offset += page_size

        if total_count is not None and len(all_results) < total_count:
            truncated = True

        out_total = total_count if total_count is not None else len(all_results)
        return {
            'total_count': out_total,
            'results': all_results,
            'truncated': truncated,
            'returned_count': len(all_results),
        }

    def _dataset_path_segment(self, dataset_id: str) -> str:
        # Path segment only; disallow injection via encoded slashes etc.
        if not dataset_id or dataset_id.strip() != dataset_id:
            raise VancouverOpenDataError('dataset_id must be a non-empty trimmed string')
        return quote(dataset_id, safe='@._-')

    def catalog_get_dataset(
        self,
        dataset_id: str,
        *,
        select: str | None = None,
        lang: str | None = None,
        timezone: str | None = None,
        include_links: bool | None = None,
        include_app_metas: bool | None = None,
    ) -> dict[str, Any]:
        """
        GET /catalog/datasets/{dataset_id} — metadata, fields, links to records/exports.
        """
        seg = self._dataset_path_segment(dataset_id)
        params: list[tuple[str, Any]] = []
        if select is not None and select != '':
            params.append(('select', select))
        if lang is not None and lang != '':
            params.append(('lang', lang))
        if timezone is not None and timezone != '':
            params.append(('timezone', timezone))
        if include_links is not None:
            params.append(('include_links', str(include_links).lower()))
        if include_app_metas is not None:
            params.append(('include_app_metas', str(include_app_metas).lower()))
        return self._get_json(f'{_EXPLORE_PREFIX}/catalog/datasets/{seg}', params=params or None)

    def dataset_query_records(
        self,
        dataset_id: str,
        *,
        limit: int = 10,
        offset: int = 0,
        where: str | None = None,
        select: str | None = None,
        order_by: str | None = None,
        group_by: str | None = None,
        lang: str | None = None,
        timezone: str | None = None,
        include_links: bool | None = None,
        include_app_metas: bool | None = None,
        refine: Sequence[str] | None = None,
        exclude: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        """
        GET /catalog/datasets/{dataset_id}/records — ODSQL via ``where``, ``select``, etc.

        ``limit`` is capped at 100 (no ``group_by``); ``offset`` must keep offset+limit < 10000.
        """
        seg = self._dataset_path_segment(dataset_id)
        limit = max(1, min(int(limit), 100))
        offset = max(0, int(offset))
        params: list[tuple[str, Any]] = [
            ('limit', limit),
            ('offset', offset),
        ]
        if where is not None and where.strip() != '':
            params.append(('where', where))
        if select is not None and select != '':
            params.append(('select', select))
        if order_by is not None and order_by.strip() != '':
            params.append(('order_by', order_by))
        if group_by is not None and group_by.strip() != '':
            params.append(('group_by', group_by))
        if lang is not None and lang != '':
            params.append(('lang', lang))
        if timezone is not None and timezone != '':
            params.append(('timezone', timezone))
        if include_links is not None:
            params.append(('include_links', str(include_links).lower()))
        if include_app_metas is not None:
            params.append(('include_app_metas', str(include_app_metas).lower()))
        for r in refine or ():
            s = r.strip() if isinstance(r, str) else ''
            if s:
                params.append(('refine', s))
        for e in exclude or ():
            s = e.strip() if isinstance(e, str) else ''
            if s:
                params.append(('exclude', s))

        return self._get_json(
            f'{_EXPLORE_PREFIX}/catalog/datasets/{seg}/records',
            params=params,
        )
