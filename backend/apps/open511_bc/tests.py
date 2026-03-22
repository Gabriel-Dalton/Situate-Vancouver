from unittest.mock import MagicMock, patch

import httpx
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from .client import Open511BCClient
from .exceptions import Open511BCApiError, Open511BCError, Open511BCTransportError
from .models import Open511EventsSnapshot


class Open511BCClientTests(TestCase):
    def test_events_request_includes_format_json(self) -> None:
        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured['url'] = str(request.url)
            captured['auth'] = request.headers.get('authorization')
            return httpx.Response(
                200,
                json={'events': [], 'meta': {'url': '/events'}},
                request=request,
            )

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.open511_bc.client.httpx.Client', return_value=fake_http):
            c = Open511BCClient('https://api.open511.gov.bc.ca', enforce_host_allowlist=True)
            data = c.fetch_resource('events', {'limit': '2'})
        self.assertEqual(data['events'], [])
        self.assertIn('format=json', captured['url'])
        self.assertIsNone(captured.get('auth'))

    def test_no_authorization_header_sent(self) -> None:
        """Public Open511 endpoint: no Authorization header should be sent."""
        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured['auth'] = request.headers.get('authorization')
            return httpx.Response(200, json={'events': []}, request=request)

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.open511_bc.client.httpx.Client', return_value=fake_http):
            c = Open511BCClient('https://api.open511.gov.bc.ca', enforce_host_allowlist=True)
            c.fetch_resource('events')
        self.assertIsNone(captured.get('auth'))

    def test_disallowed_host_raises(self) -> None:
        with self.assertRaises(Open511BCError):
            Open511BCClient('https://evil.example', enforce_host_allowlist=True)

    def test_http_error_raises_api_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, text='unavailable', request=request)

        transport = httpx.MockTransport(handler)
        fake_http = httpx.Client(transport=transport, timeout=10.0)
        with patch('apps.open511_bc.client.httpx.Client', return_value=fake_http):
            c = Open511BCClient('https://api.open511.gov.bc.ca', enforce_host_allowlist=True)
            with self.assertRaises(Open511BCApiError) as ctx:
                c.fetch_resource('events')
        self.assertEqual(ctx.exception.status_code, 503)


class Open511BCAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    @patch('apps.open511_bc.views.Open511BCClient')
    def test_events_proxy_ok(self, mock_cls: object) -> None:
        from unittest.mock import MagicMock

        inst = MagicMock()
        inst.fetch_resource.return_value = {'events': [{'id': 'drivebc.ca/1'}]}
        mock_cls.return_value = inst

        r = self.client.get('/api/open511-bc/events/', {'event_type': 'INCIDENT', 'limit': '5'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertTrue(body['ok'])
        self.assertEqual(len(body['open511']['events']), 1)
        inst.fetch_resource.assert_called_once()
        args, kwargs = inst.fetch_resource.call_args
        self.assertEqual(args[0], 'events')
        self.assertEqual(args[1]['event_type'], 'INCIDENT')
        self.assertEqual(args[1]['limit'], '5')

    @patch('apps.open511_bc.views.Open511BCClient')
    def test_unknown_query_keys_ignored(self, mock_cls: object) -> None:
        from unittest.mock import MagicMock

        inst = MagicMock()
        inst.fetch_resource.return_value = {'events': []}
        mock_cls.return_value = inst

        self.client.get('/api/open511-bc/events/', {'evil': '1', 'limit': '1'})
        args, _kwargs = inst.fetch_resource.call_args
        self.assertEqual(args[0], 'events')
        self.assertNotIn('evil', args[1])

    @patch('apps.open511_bc.views.Open511BCClient')
    def test_transport_error_returns_502(self, mock_cls: object) -> None:
        inst = MagicMock()
        inst.fetch_resource.side_effect = Open511BCTransportError('no route')
        mock_cls.return_value = inst

        r = self.client.get('/api/open511-bc/events/')
        self.assertEqual(r.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(r.json()['error']['code'], 'transport_error')


class Open511CachedEventsAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def test_no_snapshot_returns_503(self) -> None:
        Open511EventsSnapshot.objects.all().delete()
        r = self.client.get('/api/open511-bc/events/cached/')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(r.json()['error']['code'], 'no_snapshot')

    @override_settings(OPEN511_EVENTS_CACHE_STALE_AFTER_SECONDS=300)
    def test_fresh_snapshot_returns_ok_not_stale(self) -> None:
        snapshot = Open511EventsSnapshot(
            payload={'events': [{'id': 'drivebc.ca/1'}]},
            fetch_params={'limit': '500'},
            fetched_at=timezone.now(),
        )
        snapshot.save()

        r = self.client.get('/api/open511-bc/events/cached/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertTrue(body['ok'])
        self.assertFalse(body['is_stale'])
        self.assertEqual(len(body['open511']['events']), 1)
        self.assertIn('fetched_at', body)
        self.assertIn('age_seconds', body)

    @override_settings(OPEN511_EVENTS_CACHE_STALE_AFTER_SECONDS=1)
    def test_old_snapshot_is_flagged_stale(self) -> None:
        import datetime
        old_time = timezone.now() - datetime.timedelta(seconds=120)
        snapshot = Open511EventsSnapshot(
            payload={'events': []},
            fetch_params={},
            fetched_at=old_time,
        )
        snapshot.save()

        r = self.client.get('/api/open511-bc/events/cached/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = r.json()
        self.assertTrue(body['ok'])
        self.assertTrue(body['is_stale'])


class RefreshOpen511EventsCommandTests(TestCase):
    @patch('apps.open511_bc.management.commands.refresh_open511_events.Open511BCClient')
    def test_command_saves_snapshot(self, mock_cls: object) -> None:
        from django.core.management import call_command

        inst = MagicMock()
        inst.fetch_resource.return_value = {
            'events': [{'id': 'drivebc.ca/1'}, {'id': 'drivebc.ca/2'}],
            'pagination': {'offset': '0'},
        }
        mock_cls.return_value = inst

        call_command('refresh_open511_events', verbosity=0)

        snapshot = Open511EventsSnapshot.objects.get(pk=1)
        self.assertEqual(len(snapshot.payload['events']), 2)
        self.assertIsNotNone(snapshot.fetched_at)

    @patch('apps.open511_bc.management.commands.refresh_open511_events.Open511BCClient')
    def test_command_overrides_existing_snapshot(self, mock_cls: object) -> None:
        from django.core.management import call_command

        Open511EventsSnapshot.objects.update_or_create(
            pk=1,
            defaults={
                'payload': {'events': []},
                'fetch_params': {},
                'fetched_at': timezone.now(),
            },
        )

        inst = MagicMock()
        inst.fetch_resource.return_value = {'events': [{'id': 'drivebc.ca/99'}]}
        mock_cls.return_value = inst

        call_command('refresh_open511_events', verbosity=0)

        snapshot = Open511EventsSnapshot.objects.get(pk=1)
        self.assertEqual(snapshot.payload['events'][0]['id'], 'drivebc.ca/99')
        self.assertEqual(Open511EventsSnapshot.objects.count(), 1)
