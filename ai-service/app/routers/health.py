from __future__ import annotations

from fastapi import APIRouter
from openai import APIConnectionError, APIStatusError, APITimeoutError

from app.openai_config import OpenAIConfigurationError, build_openai_client

router = APIRouter()

# Keep health checks bounded so load balancers do not wait on slow OpenAI.
_OPENAI_HEALTH_TIMEOUT_S = 5.0


@router.get("/health")
def health():
    """
    Liveness plus OpenAI: key present and a lightweight models.list() succeeds.
    Top-level ``status`` is ``ok`` only when OpenAI is usable; details under ``openai``.
    """
    payload: dict = {'service': 'ai', 'status': 'ok', 'openai': {}}
    try:
        client = build_openai_client(timeout=_OPENAI_HEALTH_TIMEOUT_S)
        client.models.list()
        payload['openai'] = {
            'status': 'ok',
            'message': 'OPENAI_API_KEY set and OpenAI models list succeeded',
        }
    except OpenAIConfigurationError as exc:
        payload['status'] = 'error'
        payload['openai'] = {
            'status': 'error',
            'message': str(exc),
        }
    except APITimeoutError as exc:
        payload['status'] = 'error'
        payload['openai'] = {
            'status': 'error',
            'message': 'OpenAI request timed out',
            'detail': str(exc),
        }
    except APIConnectionError as exc:
        payload['status'] = 'error'
        payload['openai'] = {
            'status': 'error',
            'message': 'Could not connect to OpenAI',
            'detail': str(exc),
        }
    except APIStatusError as exc:
        payload['status'] = 'error'
        payload['openai'] = {
            'status': 'error',
            'message': f'OpenAI API returned HTTP {exc.status_code}',
            'detail': getattr(exc, 'message', None) or str(exc),
        }
    except Exception as exc:  # pragma: no cover - defensive
        payload['status'] = 'error'
        payload['openai'] = {
            'status': 'error',
            'message': 'OpenAI health check failed',
            'detail': str(exc),
        }
    return payload
