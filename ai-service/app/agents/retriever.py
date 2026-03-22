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
        "emergency":        30,
        "natural_disaster": 30,   # fast-moving situations — keep TTL short
        "traffic":          60,
        "transit":          60,
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
            "You receive live API records and an optional detected incident. "
            "Your job is to summarize what the data shows — nothing more.\n\n"
            "CRITICAL RULES:\n"
            "1. Only report what is explicitly present in the live API records or detected incident provided.\n"
            "2. Do NOT add context, patterns, or causes from training knowledge.\n"
            "3. If the live data is empty or no incident was detected, set confidence=0.1 and "
            "report that no data was found in data_sources_checked.\n"
            "4. location_context: briefly describe the geographic area to help interpret the data "
            "(street type, neighbourhood) — but never fabricate incident details.\n"
            "5. known_patterns, contributing_factors, and related_locations must only reference "
            "information present in the provided records."
        )

    def retrieve(
        self,
        decomposed_query: DecomposedQuery,
        incident: DetectedIncident | None = None,
        live_data: dict | None = None,
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
        if live_data:
            user_message += f"\n\nLive API records fetched for this query:\n{json.dumps(live_data, indent=2)}"

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
