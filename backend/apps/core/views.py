import httpx
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .health_checks import collect_health_checks


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
