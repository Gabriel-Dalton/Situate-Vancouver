import os
import json
import redis
from app.openai_config import build_openai_client

from .schemas import DecomposedQuery, DetectedIncident, RetrievedContext


class RetrieverAgent:
    """
    Retrieves relevant context about a Vancouver location or incident.

    Cache keys are built from decomposed entities (intent + location + time),
    not raw query strings — so rephrased versions of the same question hit
    the same cache entry.
    """

    CACHE_TTL = {
        "emergency":    30,
        "traffic":      60,
        "transit":      60,
        "obstruction":  120,
        "weather":      300,
        "construction": 600,
        "general":      60,
    }

    def __init__(self, model: str = "gpt-4o"):
        self.client = build_openai_client()
        self.model = model
        self.redis = redis.Redis(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            username=os.environ.get("REDIS_USERNAME", "default"),
            password=os.environ.get("REDIS_PASSWORD"),
            decode_responses=True,
        )
        self.system_prompt = (
            "You are the Retriever agent for Situate Vancouver, a real-time city monitoring system. "
            "Given a structured query decomposition and optional incident data, surface all relevant "
            "context needed to explain what is happening and why.\n\n"
            "You have deep knowledge of:\n"
            "- Vancouver bridges: Burrard, Granville, Cambie, Knight Street, Lions Gate, Pattullo, Port Mann\n"
            "- TransLink: Expo Line, Millennium Line, Canada Line, buses, SeaBus, WestCoast Express\n"
            "- Key hubs: Waterfront, Stadium-Chinatown, Broadway-City Hall, Commercial-Broadway, Metrotown\n"
            "- Venues: Rogers Arena, BC Place, Queen Elizabeth Theatre\n"
            "- Neighbourhoods: Downtown, West End, Kitsilano, Mount Pleasant, East Van, Strathcona\n"
            "- Weather impact zones: bridges, North Shore routes, Highway 1\n"
            "- Emergency service areas and public safety hotspots"
        )

    def retrieve(
        self,
        decomposed_query: DecomposedQuery,
        incident: DetectedIncident | None = None,
    ) -> RetrievedContext:
        """
        Retrieve context using a decomposed query. Checks entity-based cache first.

        Args:
            decomposed_query: Output from QueryDecomposer.decompose()
            incident: Optional structured incident from WatcherAgent.

        Returns:
            RetrievedContext with cache_hit flag set.
        """
        cache_key = f"situate:{decomposed_query.cache_key}"
        intent = decomposed_query.intent

        cached = self.redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            data["cache_hit"] = True
            return RetrievedContext(**data)

        user_message = f"Query decomposition:\n{decomposed_query.model_dump_json(indent=2)}"
        if incident:
            user_message += f"\n\nDetected incident:\n{incident.model_dump_json(indent=2)}"

        response = self.client.beta.chat.completions.parse(
            model=self.model,
            response_format=RetrievedContext,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        result = response.choices[0].message.parsed
        result.cache_hit = False

        ttl = self.CACHE_TTL.get(intent, 60)
        self.redis.setex(cache_key, ttl, result.model_dump_json())

        return result

    def cache_incident(self, cache_key: str, incident: DetectedIncident, intent: str) -> None:
        """
        Write a user-reported incident into the cache so follow-up queries
        about the same location are served from Redis without an LLM call.

        Args:
            cache_key: Entity-based key from QueryDecomposer (e.g. "obstruction:knight_street:current")
            incident: Structured incident from WatcherAgent.
            intent: Incident intent string for TTL lookup.
        """
        context = RetrievedContext(
            location_context=incident.summary,
            known_patterns=[],
            related_locations=[],
            transit_lines_affected=[],
            contributing_factors=[incident.raw_details],
            data_sources_checked=["user_report"],
            confidence=0.8,
            cache_hit=False,
        )
        ttl = self.CACHE_TTL.get(intent, 60)
        full_key = f"situate:{cache_key}"
        self.redis.setex(full_key, ttl, context.model_dump_json())
