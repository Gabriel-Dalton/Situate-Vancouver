from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .ckan_probe import build_ckan_client
from .exceptions import (
    VancouverOpenDataConfigurationError,
    VancouverOpenDataError,
)


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
