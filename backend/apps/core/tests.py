from unittest.mock import MagicMock, patch

import httpx
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.vancouver_opendata.exceptions import VancouverOpenDataApiError


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
        mock_http.get.return_value = httpx.Response(200, json={'status': 'ok'})
        mock_httpx_client_cls.return_value = mock_http

        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertEqual(body['status'], 'healthy')
        self.assertEqual(body['checks']['django']['status'], 'ok')
        self.assertEqual(body['checks']['vancouver_opendata']['status'], 'ok')
        self.assertEqual(body['checks']['ai_service']['status'], 'ok')

    @override_settings(VANCOUVER_OPENDATA_API_KEY='', HEALTH_CHECK_AI=True)
    @patch('apps.core.health_checks.httpx.Client')
    def test_health_degraded_when_vancouver_not_configured(
        self,
        mock_httpx_client_cls: MagicMock,
    ) -> None:
        mock_http = MagicMock()
        mock_http.__enter__.return_value = mock_http
        mock_http.__exit__.return_value = None
        mock_http.get.return_value = httpx.Response(200, json={'status': 'ok'})
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
        mock_http.get.return_value = httpx.Response(200, json={'status': 'ok'})
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
