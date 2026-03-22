"""Aggregate health: Django process, Vancouver Open Data (Explore API), AI service."""

from __future__ import annotations

import time

import httpx
from django.conf import settings

from apps.vancouver_opendata.ckan_probe import build_ckan_client, run_ckan_smoke_probe
from apps.vancouver_opendata.exceptions import (
    VancouverOpenDataConfigurationError,
    VancouverOpenDataError,
)

AI_HEALTH_TIMEOUT_SECONDS = 3.0


def collect_health_checks() -> dict:
    checks: dict[str, dict] = {
        'django': {
            'status': 'ok',
            'message': 'Django API process is running',
        },
    }

    _check_vancouver_opendata(checks)
    if settings.HEALTH_CHECK_AI:
        _check_ai_service(checks)
    else:
        base = settings.AI_SERVICE_URL.rstrip('/')
        checks['ai_service'] = {
            'status': 'skipped',
            'message': 'AI health check disabled (HEALTH_CHECK_AI=false)',
            'url': f'{base}/health',
        }

    overall = _compute_overall(checks)
    return {
        'status': overall,
        'service': 'django',
        'checks': checks,
    }


def _compute_overall(checks: dict[str, dict]) -> str:
    for key in ('vancouver_opendata', 'ai_service'):
        block = checks.get(key)
        if not block:
            continue
        if block.get('status') == 'error':
            return 'unhealthy'
    for key in ('vancouver_opendata', 'ai_service'):
        block = checks.get(key)
        if block and block.get('status') == 'not_configured':
            return 'degraded'
    return 'healthy'


def _check_vancouver_opendata(checks: dict[str, dict]) -> None:
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


def _check_ai_service(checks: dict[str, dict]) -> None:
    base = settings.AI_SERVICE_URL.rstrip('/')
    health_url = f'{base}/health'
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=AI_HEALTH_TIMEOUT_SECONDS) as client:
            response = client.get(health_url)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        if response.status_code == 200:
            checks['ai_service'] = {
                'status': 'ok',
                'message': 'AI service /health returned HTTP 200',
                'url': health_url,
                'latency_ms': latency_ms,
            }
            return
        checks['ai_service'] = {
            'status': 'error',
            'message': f'Unexpected HTTP {response.status_code}',
            'url': health_url,
            'latency_ms': latency_ms,
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
