import os
import time

import redis
from fastapi import APIRouter
from openai import OpenAI, APIConnectionError, AuthenticationError

router = APIRouter()


def _check_openai() -> dict:
    try:
        key = os.environ.get("OPENAI_API_KEY", "")
        if not key:
            return {"status": "error", "message": "OPENAI_API_KEY not set"}

        t0 = time.perf_counter()
        client = OpenAI(api_key=key)
        client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
        latency_ms = (time.perf_counter() - t0) * 1000
        return {"status": "ok", "latency_ms": round(latency_ms)}

    except AuthenticationError:
        return {"status": "error", "message": "Invalid API key"}
    except APIConnectionError:
        return {"status": "error", "message": "Could not reach OpenAI API"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _check_redis() -> dict:
    try:
        r = redis.Redis(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            username=os.environ.get("REDIS_USERNAME", "default"),
            password=os.environ.get("REDIS_PASSWORD"),
            decode_responses=True,
            socket_connect_timeout=3,
        )
        t0 = time.perf_counter()
        r.ping()
        latency_ms = (time.perf_counter() - t0) * 1000
        return {"status": "ok", "latency_ms": round(latency_ms)}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/health")
def health():
    openai_check = _check_openai()
    redis_check = _check_redis()

    all_ok = openai_check["status"] == "ok" and redis_check["status"] == "ok"

    return {
        "status": "ok" if all_ok else "degraded",
        "service": "ai",
        "checks": {
            "openai": openai_check,
            "redis": redis_check,
        },
    }
