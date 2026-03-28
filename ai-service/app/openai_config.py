"""Central OpenAI client construction and configuration errors."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

# Load ai-service/.env first (service-specific keys like OPENROUTER_API_KEY),
# then repo-root .env for shared keys. Neither overrides vars already set in the shell.
_AI_SERVICE_ROOT = Path(__file__).resolve().parent.parent
_REPO_ROOT = _AI_SERVICE_ROOT.parent
load_dotenv(_AI_SERVICE_ROOT / '.env', override=False)
load_dotenv(_REPO_ROOT / '.env', override=False)


class OpenAIConfigurationError(RuntimeError):
    """Raised when OPENAI_API_KEY is missing or empty."""


def build_openai_client(*, timeout: float | None = None) -> OpenAI:
    """
    Build an OpenAI client using OPENAI_API_KEY from the environment.

    Args:
        timeout: Optional request timeout in seconds (e.g. for health checks).

    Raises:
        OpenAIConfigurationError: If the key is missing or whitespace-only.
    """
    key = (os.environ.get('OPENAI_API_KEY') or '').strip()
    if not key:
        raise OpenAIConfigurationError(
            'OPENAI_API_KEY is not set. Add it to the repository root `.env` '
            '(see `.env.example`); `make run` loads that file so uvicorn inherits it.',
        )
    kwargs: dict = {'api_key': key}
    if timeout is not None:
        kwargs['timeout'] = timeout
    return OpenAI(**kwargs)
