from __future__ import annotations

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .client import Open511BCClient
from .exceptions import Open511BCApiError, Open511BCError, Open511BCTransportError
from .models import Open511EventsSnapshot


def _handle_error(exc: Open511BCError) -> Response:
    if isinstance(exc, Open511BCTransportError):
        return Response(
            {
                'ok': False,
                'error': {'code': 'transport_error', 'message': str(exc)},
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )
    if isinstance(exc, Open511BCApiError):
        payload: dict = {
            'ok': False,
            'error': {'code': 'upstream_error', 'message': str(exc)},
        }
        if exc.status_code is not None:
            payload['error']['status_code'] = exc.status_code
        return Response(payload, status=status.HTTP_502_BAD_GATEWAY)
    return Response(
        {
            'ok': False,
            'error': {'code': 'open511_error', 'message': str(exc)},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _build_client() -> Open511BCClient:
    return Open511BCClient(
        settings.OPEN511_BC_BASE_URL,
        timeout_seconds=float(settings.OPEN511_BC_TIMEOUT_SECONDS),
        enforce_host_allowlist=settings.OPEN511_BC_ENFORCE_HOST_ALLOWLIST,
    )


def _subset_params(request: Request, allowed: frozenset[str]) -> dict[str, str]:
    return {
        k: request.query_params.get(k, '')
        for k in allowed
        if k in request.query_params and request.query_params.get(k, '') != ''
    }


# Open511 Events filters — see https://api.open511.gov.bc.ca/help
_EVENTS_QUERY_KEYS = frozenset(
    {
        'format',
        'limit',
        'offset',
        'jurisdiction',
        'event_type',
        'event_subtype',
        'severity',
        'status',
        'created',
        'updated',
        'road_name',
        'area_id',
        'bbox',
        'geography',
        'tolerance',
        'in_effect_on',
    },
)

_PAGINATED_KEYS = frozenset({'format', 'limit', 'offset'})
_MINIMAL_KEYS = frozenset({'format'})


def _parse_events_limit_offset(params: dict[str, str]) -> dict[str, str]:
    """Clamp limit/offset to Open511 bounds (max 500 events per request)."""
    out = dict(params)
    if 'limit' in out:
        try:
            lim = int(out['limit'])
        except ValueError:
            lim = 50
        out['limit'] = str(max(1, min(lim, 500)))
    if 'offset' in out:
        try:
            off = int(out['offset'])
        except ValueError:
            off = 0
        out['offset'] = str(max(0, off))
    return out


@api_view(['GET'])
@permission_classes([AllowAny])
def open511_discovery(request: Request) -> Response:
    """Proxy Open511 discovery root (services and jurisdictions)."""
    params = _subset_params(request, _MINIMAL_KEYS)
    try:
        client = _build_client()
        raw = client.fetch_resource('discovery', params)
    except Open511BCError as exc:
        return _handle_error(exc)

    return Response(
        {
            'ok': True,
            'source': settings.OPEN511_BC_BASE_URL,
            'open511': raw,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def open511_events(request: Request) -> Response:
    """
    Proxy Open511 ``/events`` (road incidents, construction, weather, etc.).

    Pass-through query parameters are restricted to documented Open511 filters.
    """
    params = _subset_params(request, _EVENTS_QUERY_KEYS)
    params = _parse_events_limit_offset(params)
    try:
        client = _build_client()
        raw = client.fetch_resource('events', params)
    except Open511BCError as exc:
        return _handle_error(exc)

    return Response(
        {
            'ok': True,
            'source': settings.OPEN511_BC_BASE_URL,
            'open511': raw,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def open511_areas(request: Request) -> Response:
    """Proxy Open511 ``/areas``."""
    params = _subset_params(request, _PAGINATED_KEYS)
    params = _parse_events_limit_offset(params)
    try:
        client = _build_client()
        raw = client.fetch_resource('areas', params)
    except Open511BCError as exc:
        return _handle_error(exc)

    return Response(
        {
            'ok': True,
            'source': settings.OPEN511_BC_BASE_URL,
            'open511': raw,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def open511_jurisdiction(request: Request) -> Response:
    """Proxy Open511 ``/jurisdiction``."""
    params = _subset_params(request, _MINIMAL_KEYS)
    try:
        client = _build_client()
        raw = client.fetch_resource('jurisdiction', params)
    except Open511BCError as exc:
        return _handle_error(exc)

    return Response(
        {
            'ok': True,
            'source': settings.OPEN511_BC_BASE_URL,
            'open511': raw,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def open511_events_cached(request: Request) -> Response:
    """
    Return the latest locally-stored Open511 events snapshot.

    Use ``python manage.py refresh_open511_events`` (e.g. every 5 min via cron) to keep it fresh.
    The response includes ``fetched_at``, ``age_seconds``, and ``is_stale`` so callers can
    tell how current the data is.
    """
    try:
        snapshot = Open511EventsSnapshot.objects.get(pk=1)
    except Open511EventsSnapshot.DoesNotExist:
        return Response(
            {
                'ok': False,
                'error': {
                    'code': 'no_snapshot',
                    'message': (
                        'No Open511 events snapshot exists yet. '
                        'Run: python manage.py refresh_open511_events'
                    ),
                },
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    stale_after = int(settings.OPEN511_EVENTS_CACHE_STALE_AFTER_SECONDS)
    age_seconds = (timezone.now() - snapshot.fetched_at).total_seconds()

    return Response(
        {
            'ok': True,
            'source': settings.OPEN511_BC_BASE_URL,
            'fetched_at': snapshot.fetched_at.isoformat(),
            'age_seconds': round(age_seconds, 1),
            'is_stale': age_seconds > stale_after,
            'stale_after_seconds': stale_after,
            'fetch_params': snapshot.fetch_params,
            'open511': snapshot.payload,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def open511_jurisdiction_geography(request: Request) -> Response:
    """Proxy Open511 ``/jurisdictiongeography``."""
    params = _subset_params(request, _MINIMAL_KEYS)
    try:
        client = _build_client()
        raw = client.fetch_resource('jurisdictiongeography', params)
    except Open511BCError as exc:
        return _handle_error(exc)

    return Response(
        {
            'ok': True,
            'source': settings.OPEN511_BC_BASE_URL,
            'open511': raw,
        },
        status=status.HTTP_200_OK,
    )
