from unittest.mock import MagicMock, patch

import httpx
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from .client import VancouverOpenDataClient
from .exceptions import (
    VancouverOpenDataApiError,
    VancouverOpenDataError,
    VancouverOpenDataTransportError,
)


class VancouverOpenDataClientTests(TestCase):
    def test_catalog_list_returns_json(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertIn('/api/explore/v2.1/catalog/datasets', str(request.url))
            self.assertEqual(request.headers.get('authorization'), 'Apikey test-api-key')
            return httpx.Response(
                200,
                json={'total_count': 1, 'results': [{'dataset_id': 'x'}]},
                request=request,
            )

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.vancouver_opendata.client.httpx.Client', return_value=fake_http):
            c = VancouverOpenDataClient('https://opendata.vancouver.ca', 'test-api-key')
            data = c.catalog_list_datasets(limit=1, offset=0)
        self.assertEqual(data['total_count'], 1)
        self.assertEqual(len(data['results']), 1)

    def test_api_error_envelope_in_json_body(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={'error_code': 'ODSQLError', 'message': 'bad query'},
                request=request,
            )

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.vancouver_opendata.client.httpx.Client', return_value=fake_http):
            c = VancouverOpenDataClient('https://opendata.vancouver.ca', 'k')
            with self.assertRaises(VancouverOpenDataApiError) as ctx:
                c.catalog_list_datasets(limit=1)
        self.assertIn('bad query', str(ctx.exception))
        self.assertEqual(ctx.exception.api_error_code, 'ODSQLError')

    def test_disallowed_host_raises(self) -> None:
        with self.assertRaises(VancouverOpenDataError):
            VancouverOpenDataClient(
                'https://evil.example',
                'k',
                enforce_host_allowlist=True,
            )

    def test_http_error_with_json_message(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                401,
                json={'error': 'API key is not valid'},
                request=request,
            )

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.vancouver_opendata.client.httpx.Client', return_value=fake_http):
            c = VancouverOpenDataClient('https://opendata.vancouver.ca', 'wrong')
            with self.assertRaises(VancouverOpenDataApiError) as ctx:
                c.catalog_list_datasets(limit=1)
        self.assertIn('not valid', str(ctx.exception))

    def test_non_json_response_message(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                404,
                content=b'<html></html>',
                headers={'content-type': 'text/html'},
                request=request,
            )

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.vancouver_opendata.client.httpx.Client', return_value=fake_http):
            c = VancouverOpenDataClient('https://opendata.vancouver.ca', 'k')
            with self.assertRaises(VancouverOpenDataTransportError) as ctx:
                c.catalog_list_datasets(limit=1)
        self.assertIn('Non-JSON', str(ctx.exception))
        self.assertIn('404', str(ctx.exception))


class VancouverOpenDataDatasetsAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    @override_settings(VANCOUVER_OPENDATA_API_KEY='')
    def test_datasets_503_when_key_missing(self) -> None:
        r = self.client.get('/api/vancouver-opendata/datasets/')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(r.json()['ok'])

    @override_settings(
        VANCOUVER_OPENDATA_API_KEY='dummy',
        VANCOUVER_OPENDATA_BASE_URL='https://opendata.vancouver.ca',
    )
    @patch('apps.vancouver_opendata.views.build_ckan_client')
    def test_datasets_returns_wrapped_results(self, mock_build: MagicMock) -> None:
        instance = MagicMock()
        instance.catalog_list_datasets.return_value = {
            'total_count': 2,
            'results': [{'dataset_id': 'a'}, {'dataset_id': 'b'}],
        }
        mock_build.return_value = instance
        r = self.client.get('/api/vancouver-opendata/datasets/?limit=5')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertTrue(body['ok'])
        self.assertEqual(body['catalog']['total_count'], 2)
        self.assertEqual(len(body['catalog']['results']), 2)
        instance.catalog_list_datasets.assert_called_once()
        call_kw = instance.catalog_list_datasets.call_args.kwargs
        self.assertEqual(call_kw['limit'], 5)
        self.assertEqual(call_kw['search'], None)
