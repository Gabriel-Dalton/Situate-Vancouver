"""
DeepEval harness for the Situate Vancouver AI query pipeline.

Metrics evaluated per query:
  1. QueryTypeCorrectness  — custom: did we classify the intent correctly?
  2. CoordinateBounds      — custom: are lat/lng inside Metro Vancouver?
  3. AnswerRelevancy       — DeepEval built-in: does the verdict answer the question?
  4. Hallucination         — DeepEval built-in: does the verdict invent facts?
  5. ConfidenceFloor       — custom: is confidence >= case minimum?

Running modes
─────────────
  # Against live API (needs OPENAI_API_KEY + running services):
  cd ai-service
  PYTHONPATH=. deepeval test run tests/evals/test_query_evals.py

  # Dry-run with mocked orchestrator (no API keys needed, for CI):
  cd ai-service
  PYTHONPATH=. pytest tests/evals/test_query_evals.py --mock-orchestrator -v

  # Single case:
  cd ai-service
  PYTHONPATH=. deepeval test run tests/evals/test_query_evals.py -k "burrard"
"""

import os
import sys
import types
from typing import Optional

import pytest

# ---------------------------------------------------------------------------
# DeepEval imports
# ---------------------------------------------------------------------------
from deepeval import evaluate
from deepeval.metrics import AnswerRelevancyMetric, HallucinationMetric
from deepeval.metrics.base_metric import BaseMetric
from deepeval.test_case import LLMTestCase

# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
from tests.evals.dataset import EVAL_DATASET, EvalCase

# ---------------------------------------------------------------------------
# Custom metrics
# ---------------------------------------------------------------------------

class QueryTypeCorrectnessMetric(BaseMetric):
    """Passes when the returned query_type matches the expected type."""

    def __init__(self, expected_type: str):
        self.expected_type = expected_type
        self.threshold = 1.0

    @property
    def name(self) -> str:
        return "QueryTypeCorrectness"

    def measure(self, test_case: LLMTestCase) -> float:
        actual = (test_case.additional_metadata or {}).get("query_type", "")
        self.success = actual == self.expected_type
        self.score = 1.0 if self.success else 0.0
        self.reason = (
            f"Expected '{self.expected_type}', got '{actual}'"
            if not self.success
            else f"Correct — '{actual}'"
        )
        return self.score

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return self.success


class CoordinateBoundsMetric(BaseMetric):
    """Passes when lat/lng fall inside the expected bounding box."""

    def __init__(self, bbox: tuple):
        self.lat_min, self.lat_max, self.lng_min, self.lng_max = bbox
        self.threshold = 1.0

    @property
    def name(self) -> str:
        return "CoordinateBounds"

    def measure(self, test_case: LLMTestCase) -> float:
        meta = test_case.additional_metadata or {}
        lat = meta.get("lat")
        lng = meta.get("lng")
        if lat is None or lng is None:
            self.success = False
            self.score = 0.0
            self.reason = "Coordinates missing from response"
            return self.score

        in_bounds = (
            self.lat_min <= lat <= self.lat_max
            and self.lng_min <= lng <= self.lng_max
        )
        self.success = in_bounds
        self.score = 1.0 if in_bounds else 0.0
        self.reason = (
            f"({lat:.4f}, {lng:.4f}) is within Metro Vancouver bounds"
            if in_bounds
            else f"({lat:.4f}, {lng:.4f}) is OUTSIDE Metro Vancouver bounds "
                 f"[{self.lat_min}–{self.lat_max}, {self.lng_min}–{self.lng_max}]"
        )
        return self.score

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return self.success


class ConfidenceFloorMetric(BaseMetric):
    """Passes when confidence >= minimum threshold."""

    def __init__(self, minimum: float):
        self.minimum = minimum
        self.threshold = 1.0

    @property
    def name(self) -> str:
        return "ConfidenceFloor"

    def measure(self, test_case: LLMTestCase) -> float:
        confidence = (test_case.additional_metadata or {}).get("confidence", 0.0)
        self.success = confidence >= self.minimum
        self.score = 1.0 if self.success else 0.0
        self.reason = (
            f"confidence={confidence:.2f} >= {self.minimum}"
            if self.success
            else f"confidence={confidence:.2f} is below minimum {self.minimum}"
        )
        return self.score

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        return self.success


# ---------------------------------------------------------------------------
# Orchestrator factory
# ---------------------------------------------------------------------------

def _make_mock_orchestrator():
    """Return a fully-mocked orchestrator for CI runs."""
    from unittest.mock import MagicMock
    import sys, types

    for name in ("openai", "redis"):
        if name not in sys.modules:
            m = types.ModuleType(name)
            if name == "openai":
                m.OpenAI = MagicMock
                m.APIConnectionError = Exception
                m.AuthenticationError = Exception
            else:
                m.Redis = MagicMock
            sys.modules[name] = m

    from app.agents.schemas import (
        Coordinates, QueryResponse, DetectedIncident,
        RetrievedContext, ReasonerOutput, DecomposedQuery,
    )
    from app.agents.orchestrator import OrchestratorAgent

    orch = OrchestratorAgent.__new__(OrchestratorAgent)
    orch.decomposer = MagicMock()
    orch.watcher = MagicMock()
    orch.retriever = MagicMock()
    orch.reasoner = MagicMock()

    def _answer_query(query: str) -> QueryResponse:
        return QueryResponse(
            original_query=query,
            query_type="traffic",
            verdict="Moderate congestion detected near the queried location due to ongoing road works.",
            severity="medium",
            location="Burrard Bridge, Vancouver",
            coordinates=Coordinates(lat=49.2754, lng=-123.1371),
            cause="Road maintenance reducing lane capacity.",
            impact="15-20 minute delays for commuters.",
            recommended_actions=["Use Granville Bridge as alternate route"],
            estimated_duration="Until 6 PM",
            related_alerts=["Granville Bridge: moderate traffic"],
            cache_hit=False,
            confidence=0.82,
            data_sources=["drivebc"],
        )

    orch.answer_query = _answer_query
    return orch


def _make_live_orchestrator():
    """Return a real orchestrator backed by live OpenAI."""
    from app.agents.orchestrator import OrchestratorAgent
    return OrchestratorAgent()


# ---------------------------------------------------------------------------
# Test case builder
# ---------------------------------------------------------------------------

def _build_test_case(
    case: EvalCase,
    orchestrator,
) -> tuple[LLMTestCase, list[BaseMetric]]:
    """Run the query and return a DeepEval test case + metrics."""
    response = orchestrator.answer_query(case.query)

    # Context = data sources consulted (used for hallucination metric)
    context = response.data_sources if response.data_sources else ["drivebc", "vancouver_opendata"]

    test_case = LLMTestCase(
        input=case.query,
        actual_output=response.verdict,
        context=context,
        additional_metadata={
            "query_type": response.query_type,
            "lat": response.coordinates.lat,
            "lng": response.coordinates.lng,
            "confidence": response.confidence,
            "location": response.location,
            "cache_hit": response.cache_hit,
        },
    )

    metrics: list[BaseMetric] = [
        QueryTypeCorrectnessMetric(expected_type=case.expected_type),
        CoordinateBoundsMetric(bbox=case.location_bbox),
        ConfidenceFloorMetric(minimum=case.min_confidence),
        AnswerRelevancyMetric(threshold=0.5, model="gpt-4o-mini"),
        HallucinationMetric(threshold=0.5, model="gpt-4o-mini"),
    ]

    return test_case, metrics


# ---------------------------------------------------------------------------
# Pytest parametrised tests
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def orchestrator(request):
    use_mock = request.config.getoption("--mock-orchestrator", default=False)
    if use_mock or not os.environ.get("OPENAI_API_KEY"):
        return _make_mock_orchestrator()
    return _make_live_orchestrator()


@pytest.mark.parametrize("case", EVAL_DATASET, ids=[c.query[:50] for c in EVAL_DATASET])
def test_query_eval(case: EvalCase, orchestrator, pytestconfig):
    """
    Run each eval case through DeepEval.
    Fails if any metric falls below its threshold.
    """
    mock_mode = pytestconfig.getoption("--mock-orchestrator", default=False)
    test_case, metrics = _build_test_case(case, orchestrator)

    # Run all custom (non-LLM) metrics — always
    custom_failures = []
    for metric in metrics:
        if isinstance(metric, (QueryTypeCorrectnessMetric, CoordinateBoundsMetric, ConfidenceFloorMetric)):
            metric.measure(test_case)
            if not metric.is_successful():
                custom_failures.append(f"{metric.name}: {metric.reason}")

    # Run LLM-judge metrics only in live mode (needs OPENAI_API_KEY, not mock)
    if not mock_mode and os.environ.get("OPENAI_API_KEY"):
        llm_metrics = [m for m in metrics if isinstance(m, (AnswerRelevancyMetric, HallucinationMetric))]
        if llm_metrics:
            evaluate([test_case], llm_metrics)
            for metric in llm_metrics:
                if not metric.is_successful():
                    custom_failures.append(
                        f"{metric.__class__.__name__}: score={metric.score:.2f} "
                        f"(threshold={metric.threshold})"
                    )

    if custom_failures:
        pytest.fail(
            f"Query: {case.query!r}\n"
            + "\n".join(f"  ✗ {f}" for f in custom_failures)
        )
