"""Aggregate health: Django process, Vancouver Open Data (Explore API), Open511 BC, AI service.

AI: GET ``{AI_SERVICE_URL}/health``; JSON must have ``"status": "ok"`` (AI probes OpenAI
via ``models.list()``). The full body is under ``checks.ai_service.upstream``, including
``openai`` when the AI service returns it.
"""

from __future__ import annotations

import json
import time

import httpx
from django.conf import settings

from django.utils import timezone

from apps.open511_bc.models import Open511EventsSnapshot
from apps.vancouver_opendata.ckan_probe import build_ckan_client, run_ckan_smoke_probe
from apps.vancouver_opendata.exceptions import (
    VancouverOpenDataConfigurationError,
    VancouverOpenDataError,
)

# Must exceed the AI service OpenAI probe timeout so we do not false-fail while upstream is OK.
AI_HEALTH_TIMEOUT_SECONDS = 10.0
REMOTE_OPENDATA_HEALTH_TIMEOUT_SECONDS = 12.0


def collect_health_checks() -> dict:
    checks: dict[str, dict] = {
        'django': {
            'status': 'ok',
            'message': 'Django API process is running',
        },
    }

    _check_vancouver_opendata_with_optional_remote(checks)
    if settings.HEALTH_CHECK_AI:
        _check_ai_service(checks)
    else:
        base = settings.AI_SERVICE_URL.rstrip('/')
        checks['ai_service'] = {
            'status': 'skipped',
            'message': 'AI health check disabled (HEALTH_CHECK_AI=false)',
            'url': f'{base}/health',
        }

    if getattr(settings, 'HEALTH_CHECK_OPEN511_BC', True):
        _check_open511_bc(checks)
    else:
        checks['open511_bc'] = {
            'status': 'skipped',
            'message': 'Open511 BC health check disabled (HEALTH_CHECK_OPEN511_BC=false)',
            'base_url': settings.OPEN511_BC_BASE_URL,
        }

    overall = _compute_overall(checks)
    return {
        'status': overall,
        'service': 'django',
        'checks': checks,
    }


def _compute_overall(checks: dict[str, dict]) -> str:
    critical = ('vancouver_opendata', 'ai_service')
    for key in critical:
        block = checks.get(key)
        if not block:
            continue
        if block.get('status') == 'error':
            return 'unhealthy'
    for key in critical:
        block = checks.get(key)
        if block and block.get('status') == 'not_configured':
            return 'degraded'
    # Open511 snapshot stale or absent → degraded (non-critical, no unhealthy)
    o5 = checks.get('open511_bc', {})
    if o5.get('status') in ('degraded', 'not_configured'):
        return 'degraded'
    return 'healthy'


def _check_vancouver_opendata_with_optional_remote(checks: dict[str, dict]) -> None:
    remote_url = getattr(settings, 'HEALTH_VANCOUVER_OPENDATA_STATUS_URL', '') or ''
    if remote_url and _apply_remote_vancouver_opendata_check(checks, remote_url):
        return
    _check_vancouver_opendata_local(checks)


def _apply_remote_vancouver_opendata_check(checks: dict[str, dict], remote_url: str) -> bool:
    """
    True if checks['vancouver_opendata'] was filled from remote aggregate health JSON.
    """
    try:
        response = httpx.get(
            remote_url,
            timeout=REMOTE_OPENDATA_HEALTH_TIMEOUT_SECONDS,
            follow_redirects=True,
        )
        try:
            data = response.json()
        except json.JSONDecodeError:
            return False
        remote_check = data.get('checks', {}).get('vancouver_opendata')
        if not isinstance(remote_check, dict) or not remote_check.get('status'):
            return False
        merged = dict(remote_check)
        merged['health_source_url'] = remote_url
        checks['vancouver_opendata'] = merged
        return True
    except httpx.RequestError:
        return False


def _check_vancouver_opendata_local(checks: dict[str, dict]) -> None:
    try:
        client = build_ckan_client()
        started = time.perf_counter()
        probe, _result = run_ckan_smoke_probe(client)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        checks['vancouver_opendata'] = {
            'status': 'ok',
            'message': 'Vancouver Open Data Explore API reachable',
            'base_url': settings.VANCOUVER_OPENDATA_BASE_URL,
            'catalog_probe': probe,
            'latency_ms': latency_ms,
        }
    except VancouverOpenDataConfigurationError as exc:
        checks['vancouver_opendata'] = {
            'status': 'not_configured',
            'message': str(exc),
            'base_url': settings.VANCOUVER_OPENDATA_BASE_URL,
        }
    except VancouverOpenDataError as exc:
        payload: dict = {
            'status': 'error',
            'message': str(exc),
            'base_url': settings.VANCOUVER_OPENDATA_BASE_URL,
        }
        if getattr(exc, 'api_error_code', None):
            payload['api_error_code'] = exc.api_error_code
        checks['vancouver_opendata'] = payload


def _check_open511_bc(checks: dict[str, dict]) -> None:
    """Report Open511 BC health based on the local DB snapshot (no live upstream request)."""
    stale_after = int(
        getattr(settings, 'HEALTH_OPEN511_SNAPSHOT_STALE_AFTER_SECONDS', 86400),
    )
    try:
        snapshot = Open511EventsSnapshot.objects.get(pk=1)
    except Open511EventsSnapshot.DoesNotExist:
        checks['open511_bc'] = {
            'status': 'not_configured',
            'message': (
                'No Open511 events snapshot yet. '
                'Run: python manage.py refresh_open511_events'
            ),
            'base_url': settings.OPEN511_BC_BASE_URL,
        }
        return

    age_seconds = (timezone.now() - snapshot.fetched_at).total_seconds()
    is_stale = age_seconds > stale_after
    event_count = len(snapshot.payload.get('events') or [])

    checks['open511_bc'] = {
        'status': 'degraded' if is_stale else 'ok',
        'message': (
            f'Snapshot is older than health threshold ({round(age_seconds)}s, max {stale_after}s). '
            'Run: python manage.py refresh_open511_events'
            if is_stale
            else 'Open511 BC events snapshot is within the health freshness window'
        ),
        'base_url': settings.OPEN511_BC_BASE_URL,
        'fetched_at': snapshot.fetched_at.isoformat(),
        'age_seconds': round(age_seconds, 1),
        'stale_after_seconds': stale_after,
        'event_count': event_count,
    }


def _check_ai_service(checks: dict[str, dict]) -> None:
    base = settings.AI_SERVICE_URL.rstrip('/')
    health_url = f'{base}/health'
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=AI_HEALTH_TIMEOUT_SECONDS) as client:
            response = client.get(health_url)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        if response.status_code != 200:
            checks['ai_service'] = {
                'status': 'error',
                'message': f'Unexpected HTTP {response.status_code}',
                'url': health_url,
                'latency_ms': latency_ms,
            }
            return

        body: dict | None
        try:
            raw = response.json()
        except json.JSONDecodeError:
            checks['ai_service'] = {
                'status': 'error',
                'message': 'AI /health returned non-JSON body',
                'url': health_url,
                'latency_ms': latency_ms,
            }
            return

        if not isinstance(raw, dict):
            checks['ai_service'] = {
                'status': 'error',
                'message': 'AI /health JSON must be an object',
                'url': health_url,
                'latency_ms': latency_ms,
            }
            return

        upstream_status = raw.get('status')
        if upstream_status != 'ok':
            checks['ai_service'] = {
                'status': 'error',
                'message': (
                    'AI /health reported non-ok status'
                    if upstream_status is not None
                    else 'AI /health JSON missing "status": "ok"'
                ),
                'url': health_url,
                'latency_ms': latency_ms,
                'upstream': raw,
            }
            return

        checks['ai_service'] = {
            'status': 'ok',
            'message': 'AI service /health reachable and reports ok',
            'url': health_url,
            'latency_ms': latency_ms,
            'upstream': raw,
        }
    except httpx.TimeoutException:
        checks['ai_service'] = {
            'status': 'error',
            'message': f'Request timed out after {AI_HEALTH_TIMEOUT_SECONDS}s',
            'url': health_url,
        }
    except httpx.RequestError as exc:
        checks['ai_service'] = {
            'status': 'error',
            'message': 'Could not reach AI service',
            'url': health_url,
            'detail': str(exc),
        }
