"""
Agent test suite — all OpenAI and Redis calls are mocked.
No API keys or live services required.

Run:
    cd ai-service
    PYTHONPATH=. python3 -m pytest tests/test_agents.py -v
    # or without pytest:
    PYTHONPATH=. python3 tests/test_agents.py
"""

import sys
import types
import unittest
from unittest.mock import MagicMock, patch, call

# ---------------------------------------------------------------------------
# Stub openai + redis before any agent import
# ---------------------------------------------------------------------------

def _stub(name):
    m = types.ModuleType(name)
    sys.modules.setdefault(name, m)
    return m

openai_mod = _stub("openai")
openai_mod.OpenAI = MagicMock
openai_mod.APIConnectionError = Exception
openai_mod.AuthenticationError = Exception

redis_mod = _stub("redis")
redis_mod.Redis = MagicMock

# httpx (used by VancouverAPIGetter)
httpx_mod = _stub("httpx")
httpx_mod.Client = MagicMock
httpx_mod.HTTPStatusError = Exception
httpx_mod.RequestError = Exception

from app.agents.schemas import (   # noqa: E402
    Coordinates, DecomposedQuery, DetectedIncident,
    RetrievedContext, ReasonerOutput, QueryResponse,
)
from app.agents.decomposer import QueryDecomposer      # noqa: E402
from app.agents.watcher import WatcherAgent            # noqa: E402
from app.agents.retriever import RetrieverAgent        # noqa: E402
from app.agents.reasoner import ReasonerAgent          # noqa: E402
from app.agents.orchestrator import OrchestratorAgent  # noqa: E402


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

def make_decomposed(**kwargs) -> DecomposedQuery:
    defaults = dict(
        intent="traffic",
        location="Burrard Bridge",
        location_key="burrard_bridge",
        time_reference="current",
        sub_intents=["congestion"],
        entities=["Burrard Bridge"],
        cache_key="traffic:burrard_bridge:current",
        retrieval_targets=["drivebc"],
    )
    return DecomposedQuery(**{**defaults, **kwargs})


def make_incident(**kwargs) -> DetectedIncident:
    defaults = dict(
        event_detected=True,
        incident_type="traffic_incident",
        location="Burrard Bridge",
        coordinates=Coordinates(lat=49.2754, lng=-123.1371),
        severity="high",
        summary="Heavy traffic on Burrard Bridge.",
        raw_details="Congestion due to lane closure and PM rush hour.",
        affects_transit=False,
        timestamp="2026-03-22T20:00:00Z",
    )
    return DetectedIncident(**{**defaults, **kwargs})


def make_context(**kwargs) -> RetrievedContext:
    defaults = dict(
        location_context="Burrard Bridge connects downtown to Kitsilano.",
        known_patterns=["Evening rush congestion", "Cyclist conflicts"],
        related_locations=["Granville Bridge", "Cambie Bridge"],
        transit_lines_affected=["Bus 2", "Bus 22"],
        contributing_factors=["Lane closure", "PM peak"],
        data_sources_checked=["drivebc"],
        confidence=0.91,
        cache_hit=False,
    )
    return RetrievedContext(**{**defaults, **kwargs})


def make_analysis(**kwargs) -> ReasonerOutput:
    defaults = dict(
        answer="Traffic is heavy due to a lane closure during PM rush hour.",
        cause="East curb lane closed for maintenance + peak traffic volume.",
        impact="15-25 min delays for southbound commuters.",
        reasoning_steps=["Detected lane closure", "PM peak hour", "Compounded delay"],
        recommended_actions=["Use Granville Bridge", "Check DriveBC"],
        estimated_duration="Until 6:30 PM",
        severity="high",
        related_alerts=["Granville: moderate congestion", "Bus 2: 8 min late"],
        confidence=0.89,
    )
    return ReasonerOutput(**{**defaults, **kwargs})


# ---------------------------------------------------------------------------
# QueryDecomposer tests
# ---------------------------------------------------------------------------

class TestQueryDecomposer(unittest.TestCase):

    def setUp(self):
        with patch("app.agents.decomposer.OpenAI"):
            self.decomposer = QueryDecomposer()

    def _mock_parse(self, result: DecomposedQuery):
        msg = MagicMock()
        msg.parsed = result
        choice = MagicMock()
        choice.message = msg
        self.decomposer.client.beta.chat.completions.parse.return_value = MagicMock(choices=[choice])

    def test_returns_decomposed_query(self):
        base = make_decomposed(cache_key="", retrieval_targets=[])
        self._mock_parse(base)
        result = self.decomposer.decompose("Why is traffic so bad on Burrard Bridge?")
        self.assertIsInstance(result, DecomposedQuery)

    def test_cache_key_built_from_entities(self):
        base = make_decomposed(cache_key="", retrieval_targets=[])
        self._mock_parse(base)
        result = self.decomposer.decompose("Why is traffic so bad on Burrard Bridge?")
        self.assertEqual(result.cache_key, "traffic:burrard_bridge:current")

    def test_retrieval_targets_set_by_intent(self):
        base = make_decomposed(intent="emergency", location_key="downtown",
                               cache_key="", retrieval_targets=[])
        self._mock_parse(base)
        result = self.decomposer.decompose("Any emergencies downtown?")
        self.assertIn("911_dispatch", result.retrieval_targets)

    def test_cache_key_excludes_empty_location(self):
        base = make_decomposed(location="", location_key="", cache_key="", retrieval_targets=[])
        self._mock_parse(base)
        result = self.decomposer.decompose("What's the weather like?")
        self.assertNotIn("::", result.cache_key)
        self.assertFalse(result.cache_key.startswith(":"))

    def test_llm_called_with_query(self):
        base = make_decomposed(cache_key="", retrieval_targets=[])
        self._mock_parse(base)
        query = "Is Waterfront Station busy?"
        self.decomposer.decompose(query)
        call_kwargs = self.decomposer.client.beta.chat.completions.parse.call_args
        messages = call_kwargs.kwargs["messages"]
        self.assertTrue(any(query in str(m) for m in messages))


# ---------------------------------------------------------------------------
# WatcherAgent tests
# ---------------------------------------------------------------------------

class TestWatcherAgent(unittest.TestCase):

    def setUp(self):
        with patch("app.agents.watcher.OpenAI"), \
             patch("app.agents.watcher.VancouverAPIGetter") as mock_getter:
            self.watcher = WatcherAgent()
            self.watcher.api_getter = mock_getter.return_value
        self.watcher.api_getter.fetch.return_value = {"Current road closures": []}

    def _mock_parse(self, result: DetectedIncident):
        msg = MagicMock()
        msg.parsed = result
        choice = MagicMock()
        choice.message = msg
        self.watcher.client.beta.chat.completions.parse.return_value = MagicMock(choices=[choice])

    def test_returns_detected_incident(self):
        self._mock_parse(make_incident())
        result = self.watcher.watch("Heavy traffic on Burrard Bridge", source="user_query")
        self.assertIsInstance(result, DetectedIncident)

    def test_fetches_open_data_before_llm(self):
        self._mock_parse(make_incident())
        self.watcher.watch("traffic query", source="drivebc",
                           incident_type="traffic", location="Burrard Bridge")
        self.watcher.api_getter.fetch.assert_called_once_with(
            incident_type="traffic", location="Burrard Bridge", limit=10
        )

    def test_open_data_results_sent_to_llm(self):
        self.watcher.api_getter.fetch.return_value = {
            "Current road closures": [{"location": "Burrard Bridge", "comp_date": "2026-04-01"}]
        }
        self._mock_parse(make_incident())
        self.watcher.watch("traffic", source="drivebc", incident_type="traffic")
        call_kwargs = self.watcher.client.beta.chat.completions.parse.call_args
        messages = call_kwargs.kwargs["messages"]
        user_msg = next(m["content"] for m in messages if m["role"] == "user")
        self.assertIn("Burrard Bridge", user_msg)

    def test_no_event_detected(self):
        no_event = make_incident(event_detected=False, severity="low", summary="No incidents found.")
        self._mock_parse(no_event)
        result = self.watcher.watch("All clear?", source="drivebc")
        self.assertFalse(result.event_detected)

    def test_coordinates_returned(self):
        self._mock_parse(make_incident())
        result = self.watcher.watch("traffic", source="drivebc")
        self.assertIsInstance(result.coordinates, Coordinates)
        self.assertAlmostEqual(result.coordinates.lat, 49.2754)


# ---------------------------------------------------------------------------
# RetrieverAgent tests
# ---------------------------------------------------------------------------

class TestRetrieverAgent(unittest.TestCase):

    def setUp(self):
        with patch("app.agents.retriever.OpenAI"), \
             patch("app.agents.retriever.redis.Redis"):
            self.retriever = RetrieverAgent()
        self.retriever.redis.get.return_value = None  # cache miss by default

    def _mock_parse(self, result: RetrievedContext):
        msg = MagicMock()
        msg.parsed = result
        choice = MagicMock()
        choice.message = msg
        self.retriever.client.beta.chat.completions.parse.return_value = MagicMock(choices=[choice])

    def test_returns_retrieved_context(self):
        self._mock_parse(make_context())
        result = self.retriever.retrieve(make_decomposed())
        self.assertIsInstance(result, RetrievedContext)

    def test_cache_miss_calls_llm(self):
        self.retriever.redis.get.return_value = None
        self._mock_parse(make_context())
        self.retriever.retrieve(make_decomposed())
        self.retriever.client.beta.chat.completions.parse.assert_called_once()

    def test_cache_hit_skips_llm(self):
        import json
        cached = make_context(cache_hit=False)
        self.retriever.redis.get.return_value = cached.model_dump_json()
        result = self.retriever.retrieve(make_decomposed())
        self.retriever.client.beta.chat.completions.parse.assert_not_called()
        self.assertTrue(result.cache_hit)

    def test_result_written_to_cache_on_miss(self):
        self._mock_parse(make_context())
        self.retriever.retrieve(make_decomposed())
        self.retriever.redis.setex.assert_called_once()

    def test_cache_key_uses_entity_key(self):
        self._mock_parse(make_context())
        decomposed = make_decomposed(cache_key="traffic:burrard_bridge:current")
        self.retriever.retrieve(decomposed)
        key_used = self.retriever.redis.setex.call_args[0][0]
        self.assertEqual(key_used, "situate:traffic:burrard_bridge:current")

    def test_correct_ttl_per_intent(self):
        self._mock_parse(make_context())
        self.retriever.retrieve(make_decomposed(intent="emergency"))
        ttl = self.retriever.redis.setex.call_args[0][1]
        self.assertEqual(ttl, 30)  # emergency TTL = 30s

    def test_cache_incident_writes_to_redis(self):
        self.retriever.cache_incident(
            cache_key="obstruction:knight_street:current",
            incident=make_incident(incident_type="obstruction", location="Knight Street"),
            intent="obstruction",
        )
        self.retriever.redis.setex.assert_called_once()


# ---------------------------------------------------------------------------
# ReasonerAgent tests
# ---------------------------------------------------------------------------

class TestReasonerAgent(unittest.TestCase):

    def setUp(self):
        with patch("app.agents.reasoner.OpenAI"):
            self.reasoner = ReasonerAgent()

    def _mock_parse(self, result: ReasonerOutput):
        msg = MagicMock()
        msg.parsed = result
        choice = MagicMock()
        choice.message = msg
        self.reasoner.client.beta.chat.completions.parse.return_value = MagicMock(choices=[choice])

    def test_returns_reasoner_output(self):
        self._mock_parse(make_analysis())
        result = self.reasoner.reason(
            user_query="Why is Burrard Bridge backed up?",
            incident=make_incident(),
            context=make_context(),
        )
        self.assertIsInstance(result, ReasonerOutput)

    def test_answer_is_non_empty(self):
        self._mock_parse(make_analysis())
        result = self.reasoner.reason("query", make_incident(), make_context())
        self.assertTrue(len(result.answer) > 0)

    def test_severity_valid_value(self):
        self._mock_parse(make_analysis(severity="high"))
        result = self.reasoner.reason("query", make_incident(), make_context())
        self.assertIn(result.severity, ["low", "medium", "high", "critical"])

    def test_confidence_in_range(self):
        self._mock_parse(make_analysis(confidence=0.89))
        result = self.reasoner.reason("query", make_incident(), make_context())
        self.assertGreaterEqual(result.confidence, 0.0)
        self.assertLessEqual(result.confidence, 1.0)

    def test_recommended_actions_are_list(self):
        self._mock_parse(make_analysis())
        result = self.reasoner.reason("query", make_incident(), make_context())
        self.assertIsInstance(result.recommended_actions, list)

    def test_user_query_passed_to_llm(self):
        self._mock_parse(make_analysis())
        query = "Why is the traffic so bad on Burrard Bridge?"
        self.reasoner.reason(query, make_incident(), make_context())
        call_kwargs = self.reasoner.client.beta.chat.completions.parse.call_args
        messages = call_kwargs.kwargs["messages"]
        user_msg = next(m["content"] for m in messages if m["role"] == "user")
        self.assertIn(query, user_msg)


# ---------------------------------------------------------------------------
# OrchestratorAgent tests
# ---------------------------------------------------------------------------

class TestOrchestratorAgent(unittest.TestCase):

    def _make_orchestrator(self) -> OrchestratorAgent:
        orch = OrchestratorAgent.__new__(OrchestratorAgent)
        orch.decomposer = MagicMock()
        orch.watcher = MagicMock()
        orch.retriever = MagicMock()
        orch.reasoner = MagicMock()

        orch.decomposer.decompose.return_value = make_decomposed()
        orch.watcher.watch.return_value = make_incident()
        orch.retriever.retrieve.return_value = make_context()
        orch.reasoner.reason.return_value = make_analysis()

        return orch

    # --- answer_query ---

    def test_answer_query_returns_query_response(self):
        orch = self._make_orchestrator()
        result = orch.answer_query("Why is Burrard Bridge backed up?")
        self.assertIsInstance(result, QueryResponse)

    def test_answer_query_pipeline_order(self):
        """Decompose → Watch → Retrieve → Reason — in that order."""
        orch = self._make_orchestrator()
        manager = MagicMock()
        manager.attach_mock(orch.decomposer.decompose, "decompose")
        manager.attach_mock(orch.watcher.watch, "watch")
        manager.attach_mock(orch.retriever.retrieve, "retrieve")
        manager.attach_mock(orch.reasoner.reason, "reason")

        orch.answer_query("query")

        call_names = [c[0] for c in manager.mock_calls]
        self.assertEqual(call_names, ["decompose", "watch", "retrieve", "reason"])

    def test_answer_query_original_query_preserved(self):
        orch = self._make_orchestrator()
        q = "Is there a closure on Granville near Broadway?"
        result = orch.answer_query(q)
        self.assertEqual(result.original_query, q)

    def test_answer_query_query_type_from_decomposer(self):
        orch = self._make_orchestrator()
        orch.decomposer.decompose.return_value = make_decomposed(intent="emergency")
        orch.watcher.watch.return_value = make_incident(incident_type="emergency")
        result = orch.answer_query("Any emergencies near Rogers Arena?")
        self.assertEqual(result.query_type, "emergency")

    def test_answer_query_verdict_from_reasoner(self):
        orch = self._make_orchestrator()
        orch.reasoner.reason.return_value = make_analysis(answer="No closures found.")
        result = orch.answer_query("Any closures?")
        self.assertEqual(result.verdict, "No closures found.")

    def test_answer_query_cache_hit_propagates(self):
        orch = self._make_orchestrator()
        orch.retriever.retrieve.return_value = make_context(cache_hit=True)
        result = orch.answer_query("query")
        self.assertTrue(result.cache_hit)

    def test_answer_query_coordinates_from_incident(self):
        orch = self._make_orchestrator()
        coords = Coordinates(lat=49.28, lng=-123.12)
        orch.watcher.watch.return_value = make_incident(coordinates=coords)
        result = orch.answer_query("query")
        self.assertEqual(result.coordinates.lat, 49.28)

    # --- submit_incident ---

    def test_submit_incident_returns_detected_incident(self):
        orch = self._make_orchestrator()
        result = orch.submit_incident("Tree branch fallen on Knight Street")
        self.assertIsInstance(result, DetectedIncident)

    def test_submit_incident_caches_when_event_detected(self):
        orch = self._make_orchestrator()
        orch.watcher.watch.return_value = make_incident(event_detected=True, location="Knight Street")
        orch.submit_incident("Tree branch fallen on Knight Street")
        orch.retriever.cache_incident.assert_called_once()

    def test_submit_incident_skips_cache_when_no_event(self):
        orch = self._make_orchestrator()
        orch.watcher.watch.return_value = make_incident(event_detected=False, location="")
        orch.submit_incident("All clear")
        orch.retriever.cache_incident.assert_not_called()

    # --- process_feed ---

    def test_process_feed_returns_dict_with_keys(self):
        orch = self._make_orchestrator()
        result = orch.process_feed("Road closure on Main St", source="drivebc")
        self.assertIn("incident", result)
        self.assertIn("context", result)
        self.assertIn("analysis", result)

    def test_process_feed_stops_early_when_no_event(self):
        orch = self._make_orchestrator()
        orch.watcher.watch.return_value = make_incident(event_detected=False)
        result = orch.process_feed("No news today", source="drivebc")
        self.assertIsNone(result["context"])
        self.assertIsNone(result["analysis"])
        orch.retriever.retrieve.assert_not_called()
        orch.reasoner.reason.assert_not_called()


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
