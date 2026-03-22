import datetime
from unittest.mock import MagicMock, patch

import httpx
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.open511_bc.models import Open511EventsSnapshot
from apps.vancouver_opendata.exceptions import VancouverOpenDataApiError


@override_settings(HEALTH_CHECK_OPEN511_BC=False)
class AggregateHealthAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    @override_settings(HEALTH_CHECK_AI=True)
    @patch('apps.core.health_checks.httpx.Client')
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_healthy_when_all_deps_ok(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
        mock_httpx_client_cls: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.return_value = ('site_read', True)

        mock_http = MagicMock()
        mock_http.__enter__.return_value = mock_http
        mock_http.__exit__.return_value = None
        mock_http.get.return_value = httpx.Response(
            200,
            json={
                'status': 'ok',
                'service': 'ai',
                'openai': {'status': 'ok', 'message': 'ok'},
            },
        )
        mock_httpx_client_cls.return_value = mock_http

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertEqual(body['status'], 'healthy')
        self.assertEqual(body['checks']['django']['status'], 'ok')
        self.assertEqual(body['checks']['vancouver_opendata']['status'], 'ok')
        self.assertEqual(body['checks']['ai_service']['status'], 'ok')
        self.assertEqual(body['checks']['ai_service']['upstream']['service'], 'ai')
        self.assertEqual(body['checks']['ai_service']['upstream']['openai']['status'], 'ok')

    @override_settings(VANCOUVER_OPENDATA_API_KEY='', HEALTH_CHECK_AI=True)
    @patch('apps.core.health_checks.httpx.Client')
    def test_health_degraded_when_vancouver_not_configured(
        self,
        mock_httpx_client_cls: MagicMock,
    ) -> None:
        mock_http = MagicMock()
        mock_http.__enter__.return_value = mock_http
        mock_http.__exit__.return_value = None
        mock_http.get.return_value = httpx.Response(
            200,
            json={
                'status': 'ok',
                'service': 'ai',
                'openai': {'status': 'ok', 'message': 'ok'},
            },
        )
        mock_httpx_client_cls.return_value = mock_http

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertEqual(body['status'], 'degraded')
        self.assertEqual(body['checks']['vancouver_opendata']['status'], 'not_configured')

    @override_settings(HEALTH_CHECK_AI=True)
    @patch('apps.core.health_checks.httpx.Client')
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_unhealthy_when_ckan_fails(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
        mock_httpx_client_cls: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.side_effect = VancouverOpenDataApiError('fail')

        mock_http = MagicMock()
        mock_http.__enter__.return_value = mock_http
        mock_http.__exit__.return_value = None
        mock_http.get.return_value = httpx.Response(
            200,
            json={
                'status': 'ok',
                'service': 'ai',
                'openai': {'status': 'ok', 'message': 'ok'},
            },
        )
        mock_httpx_client_cls.return_value = mock_http

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        body = r.json()
        self.assertEqual(body['status'], 'unhealthy')
        self.assertEqual(body['checks']['vancouver_opendata']['status'], 'error')

    @override_settings(HEALTH_CHECK_AI=True)
    @patch('apps.core.health_checks.httpx.Client')
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_unhealthy_when_ai_unreachable(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
        mock_httpx_client_cls: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.return_value = ('site_read', True)

        mock_http = MagicMock()
        mock_http.__enter__.return_value = mock_http
        mock_http.__exit__.return_value = None
        mock_http.get.side_effect = httpx.ConnectError('refused')
        mock_httpx_client_cls.return_value = mock_http

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        body = r.json()
        self.assertEqual(body['status'], 'unhealthy')
        self.assertEqual(body['checks']['ai_service']['status'], 'error')

    @override_settings(HEALTH_CHECK_AI=True)
    @patch('apps.core.health_checks.httpx.Client')
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_unhealthy_when_ai_health_json_not_ok(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
        mock_httpx_client_cls: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.return_value = ('site_read', True)

        mock_http = MagicMock()
        mock_http.__enter__.return_value = mock_http
        mock_http.__exit__.return_value = None
        mock_http.get.return_value = httpx.Response(
            200,
            json={'status': 'degraded', 'service': 'ai'},
        )
        mock_httpx_client_cls.return_value = mock_http

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        body = r.json()
        self.assertEqual(body['status'], 'unhealthy')
        self.assertEqual(body['checks']['ai_service']['status'], 'error')
        self.assertEqual(body['checks']['ai_service']['upstream']['status'], 'degraded')

    @override_settings(HEALTH_CHECK_AI=False)
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_skips_ai_when_disabled(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.return_value = ('catalog_datasets', {'total_count': 1})

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertEqual(body['status'], 'healthy')
        self.assertEqual(body['checks']['ai_service']['status'], 'skipped')

    @override_settings(
        HEALTH_CHECK_AI=False,
        HEALTH_VANCOUVER_OPENDATA_STATUS_URL='https://example.com/api/health/',
    )
    @patch('apps.core.health_checks.httpx.get')
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_vancouver_opendata_from_remote_aggregate_url(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
        mock_httpx_get: MagicMock,
    ) -> None:
        mock_httpx_get.return_value = httpx.Response(
            200,
            json={
                'status': 'healthy',
                'checks': {
                    'vancouver_opendata': {
                        'status': 'ok',
                        'message': 'Vancouver Open Data Explore API reachable',
                        'base_url': 'https://opendata.vancouver.ca',
                        'catalog_probe': 'catalog_datasets',
                        'latency_ms': 100.0,
                    },
                },
            },
        )

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        van = body['checks']['vancouver_opendata']
        self.assertEqual(van['status'], 'ok')
        self.assertEqual(van['health_source_url'], 'https://example.com/api/health/')
        mock_build_ckan.assert_not_called()
        mock_probe.assert_not_called()

    @override_settings(HEALTH_CHECK_AI=False, HEALTH_CHECK_OPEN511_BC=True, OPEN511_EVENTS_CACHE_STALE_AFTER_SECONDS=300)
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_includes_open511_bc_fresh_snapshot(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.return_value = ('catalog_datasets', {'total_count': 1})
        Open511EventsSnapshot.objects.update_or_create(
            pk=1,
            defaults={
                'payload': {'events': [{'id': 'drivebc.ca/1'}]},
                'fetch_params': {},
                'fetched_at': timezone.now(),
            },
        )

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertEqual(body['status'], 'healthy')
        o5 = body['checks']['open511_bc']
        self.assertEqual(o5['status'], 'ok')
        self.assertEqual(o5['event_count'], 1)

    @override_settings(HEALTH_CHECK_AI=False, HEALTH_CHECK_OPEN511_BC=True, OPEN511_EVENTS_CACHE_STALE_AFTER_SECONDS=300)
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_degraded_when_open511_no_snapshot(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.return_value = ('catalog_datasets', {'total_count': 1})
        Open511EventsSnapshot.objects.all().delete()

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertEqual(body['status'], 'degraded')
        self.assertEqual(body['checks']['open511_bc']['status'], 'not_configured')

    @override_settings(HEALTH_CHECK_AI=False, HEALTH_CHECK_OPEN511_BC=True, OPEN511_EVENTS_CACHE_STALE_AFTER_SECONDS=1)
    @patch('apps.core.health_checks.build_ckan_client')
    @patch('apps.core.health_checks.run_ckan_smoke_probe')
    def test_health_degraded_when_open511_snapshot_stale(
        self,
        mock_probe: MagicMock,
        mock_build_ckan: MagicMock,
    ) -> None:
        mock_build_ckan.return_value = MagicMock()
        mock_probe.return_value = ('catalog_datasets', {'total_count': 1})
        Open511EventsSnapshot.objects.update_or_create(
            pk=1,
            defaults={
                'payload': {'events': []},
                'fetch_params': {},
                'fetched_at': timezone.now() - datetime.timedelta(seconds=120),
            },
        )

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertEqual(body['status'], 'degraded')
        self.assertEqual(body['checks']['open511_bc']['status'], 'degraded')


class AIQueryProxyAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    @override_settings(AI_SERVICE_URL='http://ai.test:8001')
    @patch('apps.core.views.httpx.post')
    def test_query_proxies_json_success(self, mock_post: MagicMock) -> None:
        mock_post.return_value = httpx.Response(
            200,
            json={'original_query': 'x', 'verdict': 'ok'},
            headers={'content-type': 'application/json'},
        )
        r = self.client.post('/api/query/', {'query': 'Why traffic?'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.json()['verdict'], 'ok')
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], 'http://ai.test:8001/incidents/query')
        self.assertEqual(kwargs['json'], {'query': 'Why traffic?'})

    def test_query_requires_non_empty_string(self) -> None:
        r = self.client.post('/api/query/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        r2 = self.client.post('/api/query/', {'query': '  '}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(AI_SERVICE_URL='http://ai.test:8001')
    @patch('apps.core.views.httpx.post')
    def test_query_upstream_error_status_forwarded(self, mock_post: MagicMock) -> None:
        mock_post.return_value = httpx.Response(
            400,
            json={'detail': 'query must not be empty'},
            headers={'content-type': 'application/json'},
        )
        r = self.client.post('/api/query/', {'query': 'valid'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['detail'], 'query must not be empty')

    @override_settings(AI_SERVICE_URL='http://ai.test:8001')
    @patch('apps.core.views.httpx.post')
    def test_query_connect_error_returns_502(self, mock_post: MagicMock) -> None:
        mock_post.side_effect = httpx.ConnectError('refused')
        r = self.client.post('/api/query/', {'query': 'x'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn('detail', r.json())

    @override_settings(AI_SERVICE_URL='http://ai.test:8001')
    @patch('apps.core.views.httpx.post')
    def test_query_upstream_503_forwarded(self, mock_post: MagicMock) -> None:
        mock_post.return_value = httpx.Response(
            503,
            json={'detail': 'OPENAI_API_KEY is not set.'},
            headers={'content-type': 'application/json'},
        )
        r = self.client.post('/api/query/', {'query': 'x'}, format='json')
        self.assertEqual(r.status_code, 503)
        self.assertIn('OPENAI_API_KEY', r.json()['detail'])

    @override_settings(AI_SERVICE_URL='http://ai.test:8001')
    @patch('apps.core.views.httpx.post')
    def test_query_timeout_returns_503(self, mock_post: MagicMock) -> None:
        mock_post.side_effect = httpx.TimeoutException('timed out')
        r = self.client.post('/api/query/', {'query': 'x'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
