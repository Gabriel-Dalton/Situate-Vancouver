import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
from django.core.management import call_command
from django.core.management.base import CommandError
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

    @override_settings(
        VANCOUVER_OPENDATA_API_KEY='dummy',
        VANCOUVER_OPENDATA_BASE_URL='https://opendata.vancouver.ca',
    )
    @patch('apps.vancouver_opendata.views.build_ckan_client')
    def test_dataset_detail_proxies_portal(self, mock_build: MagicMock) -> None:
        instance = MagicMock()
        instance.catalog_get_dataset.return_value = {'dataset_id': 'road-lane-closures', 'fields': []}
        mock_build.return_value = instance
        r = self.client.get('/api/vancouver-opendata/datasets/road-lane-closures/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertTrue(body['ok'])
        self.assertEqual(body['dataset']['dataset_id'], 'road-lane-closures')
        instance.catalog_get_dataset.assert_called_once_with(
            'road-lane-closures',
            select=None,
            lang=None,
            timezone=None,
            include_links=None,
            include_app_metas=None,
        )

    @override_settings(
        VANCOUVER_OPENDATA_API_KEY='dummy',
        VANCOUVER_OPENDATA_BASE_URL='https://opendata.vancouver.ca',
    )
    @patch('apps.vancouver_opendata.views.build_ckan_client')
    def test_dataset_records_passes_odsql_params(self, mock_build: MagicMock) -> None:
        instance = MagicMock()
        instance.dataset_query_records.return_value = {
            'total_count': 1,
            'results': [{'_id': '1'}],
        }
        mock_build.return_value = instance
        r = self.client.get(
            '/api/vancouver-opendata/datasets/road-lane-closures/records/',
            {
                'limit': '20',
                'offset': '5',
                'where': 'street like "Georgia"',
                'order_by': 'modified desc',
            },
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertTrue(body['ok'])
        self.assertEqual(body['records']['total_count'], 1)
        instance.dataset_query_records.assert_called_once()
        kw = instance.dataset_query_records.call_args.kwargs
        self.assertEqual(kw['limit'], 20)
        self.assertEqual(kw['offset'], 5)
        self.assertEqual(kw['where'], 'street like "Georgia"')
        self.assertEqual(kw['order_by'], 'modified desc')


class VancouverOpenDataClientRecordsTests(TestCase):
    def test_dataset_query_records_builds_url(self) -> None:
        captured: dict[str, object] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured['url'] = str(request.url)
            return httpx.Response(
                200,
                json={'total_count': 0, 'results': []},
                request=request,
            )

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.vancouver_opendata.client.httpx.Client', return_value=fake_http):
            c = VancouverOpenDataClient('https://opendata.vancouver.ca', 'k')
            c.dataset_query_records(
                'my-dataset',
                where='x=1',
                refine=['a:1', 'b:2'],
            )
        url = str(captured['url'])
        self.assertIn('/api/explore/v2.1/catalog/datasets/my-dataset/records', url)
        self.assertIn('where=x%3D1', url)
        self.assertIn('refine=a%3A1', url)
        self.assertIn('refine=b%3A2', url)


class VancouverOpenDataClientCatalogAllTests(TestCase):
    def test_catalog_list_all_merges_pages(self) -> None:
        c = VancouverOpenDataClient('https://opendata.vancouver.ca', 'k')
        side = [
            {
                'total_count': 150,
                'results': [{'dataset_id': str(i)} for i in range(100)],
            },
            {
                'total_count': 150,
                'results': [{'dataset_id': str(i)} for i in range(100, 150)],
            },
        ]
        with patch.object(
            VancouverOpenDataClient,
            'catalog_list_datasets',
            side_effect=side,
        ) as mock_list:
            out = c.catalog_list_all_datasets()
        self.assertEqual(out['returned_count'], 150)
        self.assertEqual(out['total_count'], 150)
        self.assertFalse(out['truncated'])
        self.assertEqual(len(out['results']), 150)
        self.assertEqual(mock_list.call_count, 2)


class OpenDataAllDatasetsAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    @override_settings(VANCOUVER_OPENDATA_API_KEY='')
    def test_api_datasets_503_when_key_missing(self) -> None:
        r = self.client.get('/api/datasets/')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(r.json()['ok'])

    @override_settings(
        VANCOUVER_OPENDATA_API_KEY='dummy',
        VANCOUVER_OPENDATA_BASE_URL='https://opendata.vancouver.ca',
    )
    @patch('apps.vancouver_opendata.views.build_ckan_client')
    def test_api_datasets_returns_full_catalog(self, mock_build: MagicMock) -> None:
        instance = MagicMock()
        instance.catalog_list_all_datasets.return_value = {
            'total_count': 2,
            'results': [{'dataset_id': 'a'}, {'dataset_id': 'b'}],
            'truncated': False,
            'returned_count': 2,
        }
        mock_build.return_value = instance
        r = self.client.get('/api/datasets/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertTrue(body['ok'])
        self.assertEqual(body['total_count'], 2)
        self.assertEqual(body['returned_count'], 2)
        self.assertFalse(body['truncated'])
        self.assertEqual(len(body['datasets']), 2)
        self.assertIn('opendata.vancouver.ca', body['source'])
        mock_build.assert_called_once_with(timeout_seconds=90.0)
        instance.catalog_list_all_datasets.assert_called_once_with(search=None)


class FetchVancouverOpenDataCommandTests(TestCase):
    @override_settings(VANCOUVER_OPENDATA_API_KEY='')
    def test_fetch_command_errors_when_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(CommandError):
                call_command('fetch_vancouver_opendata', output=d)

    @override_settings(
        VANCOUVER_OPENDATA_API_KEY='dummy',
        VANCOUVER_OPENDATA_BASE_URL='https://opendata.vancouver.ca',
    )
    @patch(
        'apps.vancouver_opendata.management.commands.fetch_vancouver_opendata.build_ckan_client',
    )
    def test_fetch_command_writes_catalog_metadata_and_records(self, mock_build: MagicMock) -> None:
        instance = MagicMock()
        instance.catalog_list_all_datasets.return_value = {
            'total_count': 1,
            'returned_count': 1,
            'truncated': False,
            'results': [{'dataset_id': 'test-ds'}],
        }
        instance.catalog_get_dataset.return_value = {'dataset_id': 'test-ds', 'fields': []}
        instance.dataset_query_records.return_value = {
            'total_count': 2,
            'results': [{'_id': 'a'}, {'_id': 'b'}],
        }
        mock_build.return_value = instance

        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            call_command('fetch_vancouver_opendata', output=str(out), max_datasets=1)
            self.assertTrue((out / 'catalog.json').exists())
            self.assertTrue((out / 'test-ds' / 'metadata.json').exists())
            self.assertTrue((out / 'test-ds' / 'records.jsonl').exists())
            self.assertTrue((out / 'test-ds' / 'records_meta.json').exists())
            lines = (out / 'test-ds' / 'records.jsonl').read_text(encoding='utf-8').strip().splitlines()
            self.assertEqual(len(lines), 2)

        instance.dataset_query_records.assert_called()

    @override_settings(
        VANCOUVER_OPENDATA_API_KEY='dummy',
        VANCOUVER_OPENDATA_BASE_URL='https://opendata.vancouver.ca',
    )
    @patch(
        'apps.vancouver_opendata.management.commands.fetch_vancouver_opendata.build_ckan_client',
    )
    def test_fetch_command_metadata_only_skips_records(self, mock_build: MagicMock) -> None:
        instance = MagicMock()
        instance.catalog_list_all_datasets.return_value = {
            'total_count': 1,
            'returned_count': 1,
            'truncated': False,
            'results': [{'dataset_id': 'only-meta'}],
        }
        instance.catalog_get_dataset.return_value = {'dataset_id': 'only-meta'}
        mock_build.return_value = instance

        with tempfile.TemporaryDirectory() as d:
            out = Path(d)
            call_command(
                'fetch_vancouver_opendata',
                output=str(out),
                max_datasets=1,
                metadata_only=True,
            )
            self.assertTrue((out / 'only-meta' / 'metadata.json').exists())
            self.assertFalse((out / 'only-meta' / 'records.jsonl').exists())

        instance.dataset_query_records.assert_not_called()
