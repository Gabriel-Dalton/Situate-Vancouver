import hashlib
import json
import logging
from datetime import datetime

import httpx
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .health_checks import collect_health_checks
from .models import Incident, UserProfile, SavedRoute

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


_CAMERAS_URL = 'https://api.open511.gov.bc.ca/cameras'
_CAMERAS_BBOX = '-123.5,48.9,-121.8,49.5'   # Metro Vancouver bounding box
_CAMERAS_CACHE_TTL = 10 * 60                  # 10 minutes


@api_view(['GET'])
@permission_classes([AllowAny])
def cameras_geojson(request):
    """
    Return a GeoJSON FeatureCollection of DriveBC traffic cameras in Metro Vancouver.
    Proxied from the Open511 BC cameras endpoint, cached 10 minutes.
    """
    cache_key = 'cameras_geojson_metro_van'
    cached = cache.get(cache_key)
    if cached:
        return Response(json.loads(cached))

    try:
        resp = httpx.get(
            _CAMERAS_URL,
            params={'bbox': _CAMERAS_BBOX, 'limit': 300},
            headers={'Accept': 'application/json'},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning('cameras_geojson: fetch failed — %s', exc)
        return Response({'type': 'FeatureCollection', 'features': []})

    features = []
    for cam in data.get('cameras', []):
        geo = cam.get('geography')
        if not geo or geo.get('type') != 'Point':
            continue
        views = cam.get('cameras', [])
        image_url = views[0].get('imageUrl', '') if views else ''
        orientation = views[0].get('orientation', '') if views else ''
        roads = cam.get('roads', [])
        road = roads[0].get('name', '') if roads else ''
        features.append({
            'type': 'Feature',
            'geometry': geo,
            'properties': {
                'id': cam.get('id', ''),
                'name': cam.get('name', ''),
                'image_url': image_url,
                'orientation': orientation,
                'road': road,
            },
        })

    geojson = {'type': 'FeatureCollection', 'features': features}
    cache.set(cache_key, json.dumps(geojson), timeout=_CAMERAS_CACHE_TTL)
    return Response(geojson)


def _build_ai_context(request) -> str:
    """
    Build a plain-text context block for the AI reasoner containing:
    - Current Vancouver time
    - Active DB incidents (top 15 by severity)
    - Border wait times
    - Authenticated user's profile, home address, and saved routes
    """
    lines: list[str] = []

    # ── Timestamp ──
    now = timezone.now().astimezone(timezone.get_current_timezone())
    lines.append(f"Current time: {now.strftime('%Y-%m-%d %H:%M %Z')}")

    # ── Active incidents ──
    severity_order = {'high': 0, 'medium': 1, 'low': 2}
    incidents = list(
        Incident.objects.filter(status='active')
        .values('incident_type', 'severity', 'title', 'location_description')
        .order_by('severity')[:20]
    )
    if incidents:
        border = [i for i in incidents if i['incident_type'] == 'border_wait']
        other  = [i for i in incidents if i['incident_type'] != 'border_wait']

        if other:
            lines.append(f"\nActive map incidents ({len(other)} shown):")
            for i in sorted(other, key=lambda x: severity_order.get(x['severity'], 9))[:15]:
                loc = i['location_description'] or ''
                lines.append(f"  - [{i['severity'].upper()}] {i['incident_type']}: {i['title']}" + (f" — {loc}" if loc else ""))

        if border:
            lines.append("\nBorder wait times:")
            for i in border:
                lines.append(f"  - {i['title']}: {i['severity']} wait" + (f" ({i['location_description']})" if i['location_description'] else ""))
    else:
        lines.append("\nNo active incidents in the database right now.")

    # ── User profile (if authenticated) ──
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        try:
            profile = UserProfile.objects.get(user=user)
            lines.append("\nUser profile:")
            if profile.home_label:
                lines.append(f"  - Home address: {profile.home_label}")
            lines.append(f"  - Alert channel: {profile.notify_via}")
            lines.append(f"  - Alert lead time: {profile.alert_lead_minutes} minutes before departure")

            routes = list(
                SavedRoute.objects.filter(user=profile, is_active=True)
                .values('name', 'origin_label', 'destination_label', 'departure_time', 'active_days')
            )
            if routes:
                lines.append(f"\n  Saved routes ({len(routes)}):")
                for r in routes:
                    days = ', '.join(r['active_days']) if r['active_days'] else 'all days'
                    lines.append(
                        f"    * {r['name']}: {r['origin_label']} → {r['destination_label']}"
                        f" (departs {r['departure_time']}, {days})"
                    )
            else:
                lines.append("  - No saved routes.")
        except UserProfile.DoesNotExist:
            pass
    else:
        lines.append("\nUser: not signed in (no personalised route data available).")

    return "\n".join(lines)


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
    if len(raw) > 500:
        return Response(
            {'detail': 'Query must be 500 characters or fewer.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', 'unknown')).split(',')[0].strip()
    rate_key = f'ratelimit:ai_query:{ip}'
    count = cache.get(rate_key, 0)
    if count >= 10:
        return Response(
            {'detail': 'Too many requests. Please wait a moment.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    cache.set(rate_key, count + 1, timeout=60)

    # Cache AI responses by normalised query — same question asked twice skips the LLM
    query = raw.strip()
    query_hash = hashlib.md5(query.lower().encode()).hexdigest()
    cache_key = f'ai_query:{query_hash}'
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug('ai_incidents_query: cache hit for query hash %s', query_hash)
        payload = json.loads(cached)
        if isinstance(payload, dict):
            payload['cache_hit'] = True
        return Response(payload, status=status.HTTP_200_OK)

    user_context = _build_ai_context(request)

    base = settings.AI_SERVICE_URL.rstrip('/')
    url = f'{base}/incidents/query'
    timeout = float(getattr(settings, 'AI_QUERY_TIMEOUT_SECONDS', 120.0))

    try:
        upstream = httpx.post(
            url,
            json={'query': query, 'context': user_context},
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

    # Only cache successful, non-error responses — 10 minute TTL
    if upstream.status_code == 200 and payload.get('query_type') != 'error':
        cache.set(cache_key, json.dumps(payload), timeout=600)

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


_OUTAGES_CACHE_KEY = 'bchydro_outages_geojson'
_OUTAGES_CACHE_TTL = 60 * 15  # 15 minutes — matches BC Hydro RSS update cadence


@api_view(['GET'])
@permission_classes([AllowAny])
def outages_geojson(request):
    """
    Return active BC Hydro power outage incidents as a GeoJSON FeatureCollection.

    GET /api/outages/

    Only incidents with coordinates are included (location strings that
    Nominatim could not resolve are omitted). Results are Redis-cached for
    15 minutes. The Celery task poll_bchydro refreshes the underlying data
    on the same cadence.
    """
    cached = cache.get(_OUTAGES_CACHE_KEY)
    if cached:
        return Response(json.loads(cached))

    qs = Incident.objects.filter(
        source_api=Incident.SourceAPI.BCHYDRO,
        status=Incident.Status.ACTIVE,
        lat__isnull=False,
        lng__isnull=False,
    ).values('id', 'title', 'location', 'description', 'severity', 'lat', 'lng', 'updated_at')

    features = [
        {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [row['lng'], row['lat']]},
            'properties': {
                'id': str(row['id']),
                'title': row['title'],
                'location': row['location'],
                'description': row['description'],
                'severity': row['severity'],
                'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None,
            },
        }
        for row in qs
    ]

    geojson = {'type': 'FeatureCollection', 'features': features}
    cache.set(_OUTAGES_CACHE_KEY, json.dumps(geojson, default=str), timeout=_OUTAGES_CACHE_TTL)
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
    if len(origin) > 200 or len(destination) > 200:
        return Response(
            {'detail': 'Location names must be 200 characters or fewer.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Rate limit: 20 route requests per minute per IP
    ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', 'unknown')).split(',')[0].strip()
    rate_key = f'ratelimit:find_route:{ip}'
    count = cache.get(rate_key, 0)
    if count >= 20:
        return Response(
            {'detail': 'Too many requests. Please wait a moment.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    cache.set(rate_key, count + 1, timeout=60)

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
