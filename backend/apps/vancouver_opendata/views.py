import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .ckan_probe import build_ckan_client
from .exceptions import VancouverOpenDataConfigurationError, VancouverOpenDataError

# Listing the full catalog may require many sequential portal requests.
_CATALOG_ALL_TIMEOUT_SECONDS = 90.0


def _handle_integration_error(exc: VancouverOpenDataError) -> Response:
    if isinstance(exc, VancouverOpenDataConfigurationError):
        return Response(
            {
                'ok': False,
                'error': {'code': 'not_configured', 'message': str(exc)},
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    payload = {
        'ok': False,
        'error': {'code': 'portal_error', 'message': str(exc)},
    }
    code = getattr(exc, 'api_error_code', None)
    if code:
        payload['error']['api_error_code'] = code
    return Response(payload, status=status.HTTP_502_BAD_GATEWAY)


_DATASET_ID_RE = re.compile(r'^[a-zA-Z0-9_.@-]+$')


def _bad_dataset_id() -> Response:
    return Response(
        {
            'ok': False,
            'error': {
                'code': 'invalid_dataset_id',
                'message': 'dataset_id may only contain letters, digits, ._- and @',
            },
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


def _parse_bool_query(value: str | None) -> bool | None:
    if value is None:
        return None
    s = value.strip().lower()
    if s in ('1', 'true', 'yes'):
        return True
    if s in ('0', 'false', 'no'):
        return False
    return None


def _parse_int_query(raw: str | None, default: int, *, min_v: int, max_v: int | None) -> int:
    try:
        v = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        v = default
    v = max(min_v, v)
    if max_v is not None:
        v = min(v, max_v)
    return v


@api_view(['GET'])
@permission_classes([AllowAny])
def opendata_all_datasets(request: Request) -> Response:
    """
    Return every dataset in the Vancouver Open Data catalog (paginates the Explore API).

    Optional query: ``q`` — same as ``/api/vancouver-opendata/datasets/`` search (omit or ``*`` for all).
    """
    try:
        client = build_ckan_client(timeout_seconds=_CATALOG_ALL_TIMEOUT_SECONDS)
    except VancouverOpenDataConfigurationError as exc:
        return _handle_integration_error(exc)

    q = request.query_params.get('q', '*') or '*'
    search = None if q == '*' else q

    try:
        raw = client.catalog_list_all_datasets(search=search)
    except VancouverOpenDataError as exc:
        return _handle_integration_error(exc)

    return Response(
        {
            'ok': True,
            'source': 'https://opendata.vancouver.ca',
            'total_count': raw['total_count'],
            'returned_count': raw['returned_count'],
            'truncated': raw['truncated'],
            'datasets': raw['results'],
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def datasets_list(request: Request) -> Response:
    """Return a bounded slice of datasets from the Explore catalog API."""
    try:
        client = build_ckan_client()
    except VancouverOpenDataConfigurationError as exc:
        return _handle_integration_error(exc)

    try:
        limit = int(request.query_params.get('limit', '10'))
    except (TypeError, ValueError):
        limit = 10
    limit = max(1, min(limit, 100))

    try:
        start = int(request.query_params.get('start', '0'))
    except (TypeError, ValueError):
        start = 0
    start = max(0, start)

    q = request.query_params.get('q', '*') or '*'
    search = None if q == '*' else q

    try:
        raw = client.catalog_list_datasets(limit=limit, offset=start, search=search)
    except VancouverOpenDataError as exc:
        return _handle_integration_error(exc)

    return Response(
        {
            'ok': True,
            'catalog': {
                'total_count': raw.get('total_count'),
                'results': raw.get('results'),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def dataset_detail(request: Request, dataset_id: str) -> Response:
    """Return dataset metadata and field schema from Explore API."""
    if not _DATASET_ID_RE.match(dataset_id):
        return _bad_dataset_id()
    try:
        client = build_ckan_client()
    except VancouverOpenDataConfigurationError as exc:
        return _handle_integration_error(exc)

    try:
        raw = client.catalog_get_dataset(
            dataset_id,
            select=request.query_params.get('select') or None,
            lang=request.query_params.get('lang') or None,
            timezone=request.query_params.get('timezone') or None,
            include_links=_parse_bool_query(request.query_params.get('include_links')),
            include_app_metas=_parse_bool_query(request.query_params.get('include_app_metas')),
        )
    except VancouverOpenDataError as exc:
        return _handle_integration_error(exc)

    return Response({'ok': True, 'dataset': raw}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def dataset_records(request: Request, dataset_id: str) -> Response:
    """Query records for a dataset (ODSQL ``where``, pagination, facets refine/exclude)."""
    if not _DATASET_ID_RE.match(dataset_id):
        return _bad_dataset_id()
    try:
        client = build_ckan_client()
    except VancouverOpenDataConfigurationError as exc:
        return _handle_integration_error(exc)

    limit = _parse_int_query(
        request.query_params.get('limit'),
        default=10,
        min_v=1,
        max_v=100,
    )
    offset = _parse_int_query(
        request.query_params.get('offset', request.query_params.get('start')),
        default=0,
        min_v=0,
        max_v=None,
    )
    if offset > 9900:
        offset = 9900

    refine = [x for x in request.query_params.getlist('refine') if x.strip()]
    exclude = [x for x in request.query_params.getlist('exclude') if x.strip()]

    try:
        raw = client.dataset_query_records(
            dataset_id,
            limit=limit,
            offset=offset,
            where=request.query_params.get('where') or None,
            select=request.query_params.get('select') or None,
            order_by=request.query_params.get('order_by') or None,
            group_by=request.query_params.get('group_by') or None,
            lang=request.query_params.get('lang') or None,
            timezone=request.query_params.get('timezone') or None,
            include_links=_parse_bool_query(request.query_params.get('include_links')),
            include_app_metas=_parse_bool_query(request.query_params.get('include_app_metas')),
            refine=refine or None,
            exclude=exclude or None,
        )
    except VancouverOpenDataError as exc:
        return _handle_integration_error(exc)

    return Response(
        {
            'ok': True,
            'records': {
                'total_count': raw.get('total_count'),
                'results': raw.get('results'),
            },
        },
        status=status.HTTP_200_OK,
    )
