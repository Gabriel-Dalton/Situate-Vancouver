"""Tests for GET /health (OpenAI probe)."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from openai import APIStatusError

from app.openai_config import OpenAIConfigurationError


class HealthEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    @patch('app.routers.health.build_openai_client')
    def test_health_ok_when_models_list_succeeds(self, mock_build: MagicMock) -> None:
        mock_client = MagicMock()
        mock_build.return_value = mock_client
        r = self.client.get('/health')
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['service'], 'ai')
        self.assertEqual(data['openai']['status'], 'ok')
        mock_client.models.list.assert_called_once()
        mock_build.assert_called_once_with(timeout=5.0)

    @patch('app.routers.health.build_openai_client')
    def test_health_error_when_key_missing(self, mock_build: MagicMock) -> None:
        mock_build.side_effect = OpenAIConfigurationError('OPENAI_API_KEY is not set.')
        r = self.client.get('/health')
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['openai']['status'], 'error')
        self.assertIn('OPENAI_API_KEY', data['openai']['message'])

    @patch('app.routers.health.build_openai_client')
    def test_health_error_when_openai_returns_http_error(
        self,
        mock_build: MagicMock,
    ) -> None:
        mock_client = MagicMock()
        mock_client.models.list.side_effect = APIStatusError(
            'invalid',
            response=MagicMock(status_code=401),
            body=None,
        )
        mock_build.return_value = mock_client
        r = self.client.get('/health')
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['openai']['status'], 'error')
        self.assertIn('401', data['openai']['message'])


if __name__ == '__main__':
    unittest.main()
