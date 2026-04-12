"""
Eval dataset — real Metro Vancouver queries with expected classifications.

Each entry defines:
  query           : the raw user question
  expected_type   : the query_type the orchestrator should return
  expected_location_hint : a substring that should appear in the location field
  location_bbox   : (lat_min, lat_max, lng_min, lng_max) the coordinates must fall inside
  should_have_actions : whether recommended_actions should be non-empty
"""

from dataclasses import dataclass, field

# Metro Vancouver bounding box — any incident coordinate must be inside this
METRO_VAN_BBOX = (48.9, 49.7, -123.8, -122.1)


@dataclass
class EvalCase:
    query: str
    expected_type: str
    expected_location_hint: str       # case-insensitive substring check
    location_bbox: tuple = field(default_factory=lambda: METRO_VAN_BBOX)
    should_have_actions: bool = True
    min_confidence: float = 0.5


EVAL_DATASET: list[EvalCase] = [
    # ── Traffic ──────────────────────────────────────────────────────────────
    EvalCase(
        query="Why is traffic so bad on Burrard Bridge right now?",
        expected_type="traffic",
        expected_location_hint="burrard",
    ),
    EvalCase(
        query="Is the Lions Gate Bridge backed up this morning?",
        expected_type="traffic",
        expected_location_hint="lions gate",
    ),
    EvalCase(
        query="How is traffic on Highway 1 near Burnaby?",
        expected_type="traffic",
        expected_location_hint="burnaby",
    ),
    EvalCase(
        query="Any slowdowns on Knight Street bridge?",
        expected_type="traffic",
        expected_location_hint="knight",
    ),

    # ── Construction ─────────────────────────────────────────────────────────
    EvalCase(
        query="Are there road closures on Granville Street today?",
        expected_type="construction",
        expected_location_hint="granville",
    ),
    EvalCase(
        query="What construction is happening near Broadway and Cambie?",
        expected_type="construction",
        expected_location_hint="broadway",
    ),

    # ── Transit ───────────────────────────────────────────────────────────────
    EvalCase(
        query="Is the Expo Line running on time?",
        expected_type="transit",
        expected_location_hint="expo",
    ),
    EvalCase(
        query="Any delays on the Canada Line from YVR?",
        expected_type="transit",
        expected_location_hint="canada line",
    ),
    EvalCase(
        query="Are buses running normally on Commercial Drive?",
        expected_type="transit",
        expected_location_hint="commercial",
    ),

    # ── Weather ───────────────────────────────────────────────────────────────
    EvalCase(
        query="Is there flooding in the DTES right now?",
        expected_type="weather",
        expected_location_hint="downtown",
        should_have_actions=True,
    ),
    EvalCase(
        query="Has the snowstorm affected roads in North Vancouver?",
        expected_type="weather",
        expected_location_hint="north vancouver",
    ),

    # ── Emergency ─────────────────────────────────────────────────────────────
    EvalCase(
        query="Is there a fire near Robson Street?",
        expected_type="emergency",
        expected_location_hint="robson",
        min_confidence=0.4,  # emergencies are harder to verify
    ),
    EvalCase(
        query="Any major incidents near Rogers Arena tonight?",
        expected_type="emergency",
        expected_location_hint="rogers arena",
    ),

    # ── Natural disaster ──────────────────────────────────────────────────────
    EvalCase(
        query="Are there any wildfires affecting Metro Vancouver air quality?",
        expected_type="natural_disaster",
        expected_location_hint="vancouver",
    ),

    # ── General / edge cases ──────────────────────────────────────────────────
    EvalCase(
        query="What's happening at Waterfront Station?",
        expected_type="transit",
        expected_location_hint="waterfront",
    ),
    EvalCase(
        query="Is SkyTrain running?",
        expected_type="transit",
        expected_location_hint="",  # no specific location required
        should_have_actions=False,
    ),
]
