from .watcher import WatcherAgent
from .retriever import RetrieverAgent
from .reasoner import ReasonerAgent
from .decomposer import QueryDecomposer
from .schemas import Coordinates, DetectedIncident, QueryResponse


class OrchestratorAgent:
    """
    Coordinates the full Situate Vancouver agent pipeline.

    WATCH mode        — ingest a raw feed entry → produce a map pin + analysis
    USER REPORT mode  — structured a citizen-submitted incident → map pin + cache
    QUERY mode        — answer a natural language user question → QueryResponse
    """

    def __init__(self, model: str = "gpt-4o"):
        self.watcher = WatcherAgent(model=model)
        self.retriever = RetrieverAgent(model=model)
        self.reasoner = ReasonerAgent(model=model)
        self.decomposer = QueryDecomposer(model=model)

    def process_feed(self, feed_data: str, source: str = "unknown") -> dict:
        """
        WATCH mode: Process a raw data feed entry end-to-end.

        Args:
            feed_data: Raw text from a live data feed.
            source: 'drivebc' | 'translink' | 'weathercan' | '911_dispatch' | 'public_safety'

        Returns:
            { incident: DetectedIncident, context: RetrievedContext, analysis: ReasonerOutput }
        """
        incident = self.watcher.watch(feed_data=feed_data, source=source)

        if not incident.event_detected:
            return {"incident": incident, "context": None, "analysis": None}

        location = incident.location or incident.incident_type
        decomposed = self.decomposer.decompose(f"{incident.incident_type} at {location}")

        context = self.retriever.retrieve(decomposed_query=decomposed, incident=incident)

        analysis = self.reasoner.reason(
            user_query=f"What is happening at {location}?",
            incident=incident,
            context=context,
        )

        return {
            "incident": incident,
            "decomposed": decomposed,
            "context": context,
            "analysis": analysis,
        }

    def submit_incident(self, report: str, reported_by: str = "citizen") -> DetectedIncident:
        """
        USER REPORT mode: Structure and cache a citizen-submitted incident.

        The Watcher classifies the raw text (type, location, severity, coordinates)
        and the result is cached by entity key so follow-up queries about the same
        location hit the cache immediately.

        e.g. "tree branch fallen on knight street"
             "car blocking the bike lane on Hornby near Nelson"

        Args:
            report: Free-text incident description from the user.
            reported_by: Identifier for audit trail (default "citizen").

        Returns:
            DetectedIncident — ready to be stored in Django and rendered as a map pin.
        """
        incident = self.watcher.watch(
            feed_data=report,
            source="user_report",
            incident_type="general",
        )

        # Cache the incident by its decomposed entity key so queries about
        # this location return this report without hitting the LLM again.
        if incident.event_detected and incident.location:
            decomposed = self.decomposer.decompose(
                f"{incident.incident_type} at {incident.location}"
            )
            self.retriever.cache_incident(
                cache_key=decomposed.cache_key,
                incident=incident,
                intent=decomposed.intent,
            )

        return incident

    def answer_query(self, user_query: str) -> QueryResponse:
        """
        QUERY mode: Answer a natural language question about Vancouver.

        Pipeline:
          1. Decompose → intent, location, cache_key
          2. Redis cache check (entity-based key)
          3. Cache miss → Retriever fetches fresh context
          4. Reasoner synthesizes plain-English answer
          5. Return structured QueryResponse

        Args:
            user_query: e.g. "Why is the traffic so bad on Burrard Bridge?"

        Returns:
            QueryResponse with original_query, query_type, verdict, and full detail.
        """
        # Step 1 — decompose query into structured entities
        decomposed = self.decomposer.decompose(user_query)

        # Step 2 — watcher fetches live Open Data records + classifies the situation
        incident = self.watcher.watch(
            feed_data=user_query,
            source="user_query",
            incident_type=decomposed.intent,
            location=decomposed.location,
        )

        # Step 3 — retrieve context, now enriched with the real incident data
        context = self.retriever.retrieve(decomposed_query=decomposed, incident=incident)

        analysis = self.reasoner.reason(
            user_query=user_query,
            incident=incident,
            context=context,
        )

        return QueryResponse(
            original_query=user_query,
            query_type=decomposed.intent,
            verdict=analysis.answer,
            severity=analysis.severity,
            location=incident.location or decomposed.location,
            coordinates=incident.coordinates,
            cause=analysis.cause,
            impact=analysis.impact,
            recommended_actions=analysis.recommended_actions,
            estimated_duration=analysis.estimated_duration,
            related_alerts=analysis.related_alerts,
            cache_hit=context.cache_hit,
            confidence=analysis.confidence,
        )
