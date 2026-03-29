import json
import logging

import httpx
from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .health_checks import collect_health_checks

logger = logging.getLogger(__name__)

# Vancouver Open Data GeoJSON export URLs
# These return a GeoJSON FeatureCollection directly — no API key required.
_LENS_SOURCES = {
    'cycle': (
        'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets'
        '/bikeways/exports/geojson?lang=en&timezone=America%2FVancouver'
    ),
    # public-streets filtered to local/residential streets used by pedestrians
    'pedestrian': (
        'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets'
        '/public-streets/exports/geojson?lang=en&timezone=America%2FVancouver'
        '&where=streetuse%20in%20(%22Local%22%2C%22Collector%22%2C%22Pedestrian%22)'
    ),
    # Drive lens relies on TomTom traffic flow already on the map — no extra geometry.
    'drive': None,
}

_LENS_CACHE_TTL = 60 * 60 * 24  # 24 hours — geometry rarely changes
_LENS_FETCH_TIMEOUT = 30.0


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    """
    Aggregate health: Django, Vancouver Open Data (CKAN), and AI service ``GET /health``.

    When ``HEALTH_CHECK_AI`` is true, ``checks.ai_service`` includes ``upstream`` (parsed AI JSON).
    """
    payload = collect_health_checks()
    http_status = (
        status.HTTP_503_SERVICE_UNAVAILABLE
        if payload['status'] == 'unhealthy'
        else status.HTTP_200_OK
    )
    return Response(payload, status=http_status)


@api_view(['POST'])
@permission_classes([AllowAny])
def ai_incidents_query(request):
    """
    Proxy natural-language queries to the FastAPI AI service (POST /incidents/query).

    Request JSON: { "query": "..." }
    Response: same JSON and HTTP status as the AI service when reachable.
    """
    raw = request.data.get('query')
    if raw is None:
        return Response(
            {'detail': 'Field "query" is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not isinstance(raw, str) or not raw.strip():
        return Response(
            {'detail': 'Field "query" must be a non-empty string.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    base = settings.AI_SERVICE_URL.rstrip('/')
    url = f'{base}/incidents/query'
    timeout = float(getattr(settings, 'AI_QUERY_TIMEOUT_SECONDS', 120.0))

    try:
        upstream = httpx.post(
            url,
            json={'query': raw.strip()},
            timeout=timeout,
        )
    except httpx.TimeoutException:
        return Response(
            {'detail': 'AI service request timed out.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except httpx.RequestError as exc:
        return Response(
            {
                'detail': 'Could not reach AI service.',
                'error': str(exc),
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    ct = (upstream.headers.get('content-type') or '').lower()
    if 'application/json' in ct:
        try:
            payload = upstream.json()
        except ValueError:
            payload = {'detail': upstream.text}
    else:
        payload = {'detail': upstream.text} if upstream.text else {}

    return Response(payload, status=upstream.status_code)


@api_view(['GET'])
@permission_classes([AllowAny])
def lens_geojson(request, lens: str):
    """
    Return GeoJSON for a mobility lens overlay.

    GET /api/lens/<lens>/   lens ∈ {cycle, pedestrian, drive}

    Results are cached in Redis for 24 hours. Drive lens returns an empty
    FeatureCollection (TomTom traffic flow already covers it on the map).
    """
    if lens not in _LENS_SOURCES:
        return Response(
            {'detail': f'Unknown lens "{lens}". Must be one of: {", ".join(_LENS_SOURCES)}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    url = _LENS_SOURCES[lens]
    if url is None:
        return Response({'type': 'FeatureCollection', 'features': []})

    cache_key = f'lens_geojson_{lens}'
    cached = cache.get(cache_key)
    if cached:
        return Response(json.loads(cached))

    try:
        resp = httpx.get(url, timeout=_LENS_FETCH_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
        geojson = resp.json()
    except httpx.TimeoutException:
        return Response(
            {'detail': f'Timed out fetching {lens} overlay data.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except httpx.RequestError as exc:
        logger.error('lens_geojson fetch error (%s): %s', lens, exc)
        return Response(
            {'detail': f'Could not fetch {lens} overlay data.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as exc:
        logger.error('lens_geojson unexpected error (%s): %s', lens, exc)
        return Response({'detail': 'Unexpected error.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    cache.set(cache_key, json.dumps(geojson), timeout=_LENS_CACHE_TTL)
    return Response(geojson)


@api_view(['POST'])
@permission_classes([AllowAny])
def find_route(request):
    """
    Proxy route-finding requests to the FastAPI AI service (POST /routes/find).

    Request JSON: { "origin": "...", "destination": "..." }
    Response: routes, incidents_avoided, origin/dest coordinates.
    """
    origin = request.data.get('origin')
    destination = request.data.get('destination')

    if not origin or not isinstance(origin, str) or not origin.strip():
        return Response(
            {'detail': 'Field "origin" is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not destination or not isinstance(destination, str) or not destination.strip():
        return Response(
            {'detail': 'Field "destination" is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    base = settings.AI_SERVICE_URL.rstrip('/')
    url = f'{base}/routes/find'
    timeout = float(getattr(settings, 'AI_QUERY_TIMEOUT_SECONDS', 30.0))

    try:
        upstream = httpx.post(
            url,
            json={'origin': origin.strip(), 'destination': destination.strip()},
            timeout=timeout,
        )
    except httpx.TimeoutException:
        return Response(
            {'detail': 'Route service request timed out.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except httpx.RequestError as exc:
        return Response(
            {'detail': 'Could not reach route service.', 'error': str(exc)},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    ct = (upstream.headers.get('content-type') or '').lower()
    if 'application/json' in ct:
        try:
            payload = upstream.json()
        except ValueError:
            payload = {'detail': upstream.text}
    else:
        payload = {'detail': upstream.text} if upstream.text else {}

    return Response(payload, status=upstream.status_code)
