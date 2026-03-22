"""
Live end-to-end pipeline test.

Runs the full orchestrator flow — Decomposer → Watcher (Vancouver Open Data)
→ Retriever (Redis cache) → Reasoner → QueryResponse — with real API calls.

Usage:
    cd ai-service
    PYTHONPATH=. python3 tests/run_live_pipeline.py
"""

import json
import os
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Load .env before importing any agent (agents read env vars at __init__)
# ---------------------------------------------------------------------------

def _load_env(env_path: Path) -> None:
    if not env_path.exists():
        print(f"[warn] No .env found at {env_path}, relying on shell environment")
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

# Load root .env first (Vancouver API key lives there), then ai-service .env
_load_env(Path(__file__).parent.parent.parent / ".env")
_load_env(Path(__file__).parent.parent / ".env")

from app.agents.orchestrator import OrchestratorAgent  # noqa: E402
from app.agents.schemas import QueryResponse            # noqa: E402
from app.services.vancouver_api import VancouverAPIGetter  # noqa: E402

QUERY = "Why is the traffic so bad on Burrard street bridge?"
DIVIDER = "=" * 70


def section(title: str) -> None:
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)


def run() -> None:
    # ------------------------------------------------------------------
    # 0. Preflight — show what the Vancouver Open Data API returns raw
    # ------------------------------------------------------------------
    section("STEP 0 — Vancouver Open Data API (raw fetch)")
    getter = VancouverAPIGetter()
    print("Fetching: incident_type='traffic', location='Burrard Bridge' ...")
    t0 = time.perf_counter()
    raw = getter.fetch(incident_type="traffic", location="Burrard Bridge", limit=5)
    elapsed = time.perf_counter() - t0
    print(f"Fetched in {elapsed:.2f}s\n")
    print(json.dumps(raw, indent=2))

    # ------------------------------------------------------------------
    # 1. Full orchestrator pipeline
    # ------------------------------------------------------------------
    section("STEP 1 — Decomposer")
    print(f"Query: \"{QUERY}\"\n")
    orchestrator = OrchestratorAgent()

    # Decompose manually so we can print intermediate output
    decomposed = orchestrator.decomposer.decompose(QUERY)
    print(json.dumps(decomposed.model_dump(), indent=2))

    section("STEP 2 — Watcher (Open Data + LLM classification)")
    print("Calling VancouverAPIGetter + GPT-4o to classify incident ...\n")
    t0 = time.perf_counter()
    incident = orchestrator.watcher.watch(
        feed_data=QUERY,
        source="user_query",
        incident_type=decomposed.intent,
        location=decomposed.location,
    )
    print(f"Watcher completed in {time.perf_counter() - t0:.2f}s\n")
    print(json.dumps(incident.model_dump(), indent=2))

    section("STEP 3 — Retriever (Redis cache check + context)")
    t0 = time.perf_counter()
    context = orchestrator.retriever.retrieve(
        decomposed_query=decomposed,
        incident=incident,
    )
    elapsed = time.perf_counter() - t0
    cache_status = "HIT  (served from Redis)" if context.cache_hit else "MISS (fetched fresh)"
    print(f"Cache: {cache_status} — {elapsed:.2f}s\n")
    print(json.dumps(context.model_dump(), indent=2))

    section("STEP 4 — Reasoner (final answer)")
    t0 = time.perf_counter()
    analysis = orchestrator.reasoner.reason(
        user_query=QUERY,
        incident=incident,
        context=context,
    )
    print(f"Reasoner completed in {time.perf_counter() - t0:.2f}s\n")
    print(json.dumps(analysis.model_dump(), indent=2))

    # ------------------------------------------------------------------
    # 2. Final QueryResponse — what the frontend receives
    # ------------------------------------------------------------------
    section("FINAL OUTPUT — QueryResponse (sent to UI)")
    response = QueryResponse(
        original_query=QUERY,
        query_type=decomposed.intent,
        verdict=analysis.answer,
        severity=analysis.severity,
        location=incident.location or decomposed.location,
        cause=analysis.cause,
        impact=analysis.impact,
        recommended_actions=analysis.recommended_actions,
        estimated_duration=analysis.estimated_duration,
        related_alerts=analysis.related_alerts,
        cache_hit=context.cache_hit,
        confidence=analysis.confidence,
    )
    print(json.dumps(response.model_dump(), indent=2))

    # ------------------------------------------------------------------
    # 3. Run again to demonstrate cache hit
    # ------------------------------------------------------------------
    section("CACHE HIT — same query again (should skip LLM for retrieval)")
    t0 = time.perf_counter()
    context2 = orchestrator.retriever.retrieve(decomposed_query=decomposed, incident=incident)
    elapsed = time.perf_counter() - t0
    cache_status2 = "HIT  ✓" if context2.cache_hit else "MISS"
    print(f"Cache: {cache_status2} — {elapsed:.4f}s")
    print(f"(First call took ~{time.perf_counter() - t0 + elapsed:.2f}s, this took {elapsed:.4f}s)\n")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] {type(e).__name__}: {e}", file=sys.stderr)
        raise
