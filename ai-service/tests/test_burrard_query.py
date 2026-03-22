"""
Test: "Why is the traffic so bad on Burrard street?"

Mocks all OpenAI and Redis calls with realistic Vancouver data so the full
pipeline runs locally without API keys or a running Redis instance.
Prints the final QueryResponse exactly as the frontend would receive it.
"""

import json
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Stub the openai + redis packages so importing the agents doesn't fail
# even if the packages aren't installed in the current environment.
# ---------------------------------------------------------------------------

def _make_openai_stub():
    openai_mod = types.ModuleType("openai")
    openai_mod.OpenAI = MagicMock
    sys.modules.setdefault("openai", openai_mod)

def _make_redis_stub():
    redis_mod = types.ModuleType("redis")
    redis_mod.Redis = MagicMock
    sys.modules.setdefault("redis", redis_mod)

_make_openai_stub()
_make_redis_stub()

# Now safe to import our agents
from app.agents.schemas import (  # noqa: E402
    DecomposedQuery,
    RetrievedContext,
    ReasonerOutput,
    QueryResponse,
)
from app.agents.orchestrator import OrchestratorAgent  # noqa: E402


# ---------------------------------------------------------------------------
# Realistic mock payloads
# ---------------------------------------------------------------------------

MOCK_DECOMPOSED = DecomposedQuery(
    intent="traffic",
    location="Burrard Bridge",
    location_key="burrard_bridge",
    time_reference="current",
    sub_intents=["congestion", "slow_traffic"],
    entities=["Burrard Bridge", "Burrard Street"],
    cache_key="traffic:burrard_bridge:current",
    retrieval_targets=["drivebc"],
)

MOCK_CONTEXT = RetrievedContext(
    location_context=(
        "Burrard Bridge is a six-lane crossing connecting downtown Vancouver to Kitsilano "
        "over False Creek. It carries ~50,000 vehicles/day and is a critical north-south "
        "artery with no nearby alternative for westside commuters."
    ),
    known_patterns=[
        "Severe southbound backup during afternoon rush (4–6 PM) as commuters head to Kitsilano and beyond",
        "Northbound congestion during morning rush (7:30–9 AM) merging onto Burrard Street downtown",
        "Reduced to 4 lanes during cycling events — causes significant backup",
        "Game-day overflow from BC Place pushes traffic onto Burrard via Pacific Blvd",
    ],
    related_locations=[
        "Granville Bridge (nearest alternative crossing)",
        "Cambie Bridge",
        "Pacific Boulevard on-ramp",
        "Cornwall Avenue / Chestnut Street intersection (Kits side)",
        "Burrard Street & Drake Street (downtown bottleneck)",
    ],
    transit_lines_affected=[
        "Bus 2 (Macdonald / Downtown)",
        "Bus 22 (Knight / MacDonald)",
        "Bus 44 (UBC via 41st)",
    ],
    contributing_factors=[
        "PM peak hour — high commuter volume",
        "Ongoing lane restrictions due to bridge maintenance on the east curb lane",
        "Pedestrian/cyclist conflict at the Burrard Bridge cycle track merges",
        "Spillback from Burrard & Pacific signal timing",
    ],
    data_sources_checked=["drivebc"],
    confidence=0.91,
    cache_hit=False,
)

MOCK_ANALYSIS = ReasonerOutput(
    answer=(
        "Traffic on Burrard Bridge is unusually heavy right now because of a combination of "
        "afternoon rush hour and an active lane restriction on the east curb lane due to bridge "
        "maintenance. This has squeezed five lanes of traffic into four, creating a bottleneck "
        "that's backing up as far as Drake Street downtown and Cornwall Avenue on the Kitsilano side."
    ),
    cause=(
        "Lane restriction from ongoing bridge maintenance (east curb lane closed) coinciding "
        "with PM peak commuter traffic."
    ),
    impact=(
        "Southbound commuters heading to Kitsilano, Point Grey, and UBC are seeing 15–25 minute "
        "delays. Buses 2 and 22 are running 8–12 minutes behind schedule. Northbound flow is "
        "moderately impacted but moving."
    ),
    reasoning_steps=[
        "Query is about current traffic conditions on Burrard Bridge.",
        "Burrard Bridge is a major False Creek crossing with no close substitute for westside trips.",
        "Current time is afternoon peak — historically the worst window for southbound flow.",
        "DriveBC shows an active lane restriction (east curb lane) due to maintenance.",
        "Lane reduction + peak hour = compounded delay beyond normal rush congestion.",
        "Buses 2 and 22 use the bridge and will be delayed proportionally.",
        "Granville Bridge is the nearest alternative but also busy at this hour.",
    ],
    recommended_actions=[
        "Take Granville Bridge as an alternative — expect moderate traffic but better than Burrard",
        "Consider Cambie Bridge if heading to SW Vancouver or Richmond via Cambie/99",
        "Bus riders on route 2 or 22: add 10–15 min buffer or consider Canada Line to Broadway",
        "Cyclists: the Burrard Bridge cycle track is open but expect pedestrian congestion near the pylons",
        "Check DriveBC or Google Maps for real-time signal updates before committing to the bridge",
    ],
    estimated_duration="Expect delays to persist until approximately 6:30 PM",
    severity="high",
    related_alerts=[
        "Granville Bridge: moderate southbound congestion",
        "Bus 2 (Macdonald): running 8–12 min late",
        "Bus 22 (Knight/MacDonald): running 10 min late",
        "Burrard St & Pacific Blvd: signal backup, allow extra 5 min",
    ],
    confidence=0.89,
)


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

class TestBurrardQuery(unittest.TestCase):

    def _make_orchestrator(self) -> OrchestratorAgent:
        """Return an OrchestratorAgent with all sub-agents fully mocked."""
        orch = OrchestratorAgent.__new__(OrchestratorAgent)
        orch.decomposer = MagicMock()
        orch.retriever = MagicMock()
        orch.reasoner = MagicMock()
        orch.watcher = MagicMock()

        orch.decomposer.decompose.return_value = MOCK_DECOMPOSED
        orch.retriever.retrieve.return_value = MOCK_CONTEXT
        orch.reasoner.reason.return_value = MOCK_ANALYSIS

        return orch

    def test_answer_query_returns_query_response(self):
        orch = self._make_orchestrator()
        query = "Why is the traffic so bad on Burrard street?"

        result = orch.answer_query(query)

        self.assertIsInstance(result, QueryResponse)
        self.assertEqual(result.original_query, query)
        self.assertEqual(result.query_type, "traffic")
        self.assertEqual(result.location, "Burrard Bridge")
        self.assertEqual(result.severity, "high")
        self.assertFalse(result.cache_hit)
        self.assertGreater(result.confidence, 0.5)
        self.assertIn("maintenance", result.verdict.lower())
        self.assertTrue(len(result.recommended_actions) > 0)

    def test_decomposer_called_with_query(self):
        orch = self._make_orchestrator()
        query = "Why is the traffic so bad on Burrard street?"
        orch.answer_query(query)
        orch.decomposer.decompose.assert_called_once_with(query)

    def test_retriever_called_with_decomposed(self):
        orch = self._make_orchestrator()
        orch.answer_query("Why is the traffic so bad on Burrard street?")
        orch.retriever.retrieve.assert_called_once_with(decomposed_query=MOCK_DECOMPOSED)

    def test_cache_hit_flag_propagates(self):
        orch = self._make_orchestrator()
        # Simulate a cache hit
        cached_context = MOCK_CONTEXT.model_copy(update={"cache_hit": True})
        orch.retriever.retrieve.return_value = cached_context

        result = orch.answer_query("Why is the traffic so bad on Burrard street?")
        self.assertTrue(result.cache_hit)


# ---------------------------------------------------------------------------
# Pretty-print the full QueryResponse when run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("QUERY: \"Why is the traffic so bad on Burrard street?\"")
    print("=" * 70)

    orch = TestBurrardQuery()._make_orchestrator()
    result: QueryResponse = orch.answer_query("Why is the traffic so bad on Burrard street?")

    print(json.dumps(result.model_dump(), indent=2))

    print("\n" + "=" * 70)
    print("CACHE HIT simulation (same query again):")
    print("=" * 70)

    cached_context = MOCK_CONTEXT.model_copy(update={"cache_hit": True})
    orch.retriever.retrieve.return_value = cached_context
    cached_result: QueryResponse = orch.answer_query("Why is the traffic so bad on Burrard street?")

    print(json.dumps(cached_result.model_dump(), indent=2))

    print("\nRunning assertions...")
    unittest.main(verbosity=2, exit=True)
