from app.openai_config import build_openai_client

from .schemas import DetectedIncident, RetrievedContext, ReasonerOutput


class ReasonerAgent:
    """
    Synthesizes detected incidents and retrieved context to answer natural language
    questions about what's happening in Vancouver and why.
    """

    def __init__(self, model: str = "gpt-4o"):
        self.client = build_openai_client()
        self.model = model
        self.system_prompt = (
            "You are the Reasoner agent for Situate Vancouver, a real-time city monitoring system. "
            "You receive a detected incident and retrieved context, both sourced from live API data.\n\n"
            "CRITICAL RULES:\n"
            "1. Base your answer SOLELY on the incident and context data provided. "
            "Do NOT use training knowledge to describe current real-world conditions.\n"
            "2. If event_detected is false, your answer MUST state: "
            "'No live data is currently available for this query from our feeds.' "
            "Set severity='low' and confidence=0.0.\n"
            "3. Never describe an incident, road closure, wildfire, or any condition "
            "that isn't explicitly present in the provided data.\n"
            "4. recommended_actions may include general advice (e.g. 'check DriveBC') "
            "but must not claim specific conditions exist without data support.\n\n"
            "EVENT CORRELATION:\n"
            "The LIVE SITUATE CONTEXT may include upcoming events and a pre-computed "
            "'Event-incident correlations' section. When correlations are listed, treat the "
            "nearby event as a likely contributing cause of the incident or congestion. "
            "Mention the event by name in your answer and factor it into your recommendations "
            "(e.g. suggest avoiding the area, arriving early, or using transit). "
            "When no pre-computed correlation exists but an event venue is geographically close "
            "to an incident location and the timing overlaps, you may infer the connection — "
            "but mark it as possible rather than certain.\n\n"
            "severity must be one of: low | medium | high | critical\n"
            "confidence: 0.0 if no data, 0.5-0.7 if partial data, 0.8-1.0 if strong data match"
        )

    def reason(
        self,
        user_query: str,
        incident: DetectedIncident | dict,
        context: RetrievedContext,
        user_context: str | None = None,
    ) -> ReasonerOutput:
        """
        Reason over an incident and context to answer a user query.

        Args:
            user_query: The natural language question from the user.
            incident: DetectedIncident or dict from WatcherAgent.
            context: RetrievedContext from RetrieverAgent.
            user_context: Optional live context string from Django (active incidents,
                          user profile, saved routes, border waits, etc.).

        Returns:
            ReasonerOutput with plain-English answer and recommendations.
        """
        incident_json = (
            incident.model_dump_json(indent=2)
            if isinstance(incident, DetectedIncident)
            else str(incident)
        )

        context_block = (
            f"\n\nLIVE SITUATE CONTEXT (from Django — use this to personalise your answer):\n"
            f"{user_context}\n"
            if user_context
            else ""
        )

        user_message = (
            f"User question: {user_query}\n\n"
            f"Detected incident:\n{incident_json}\n\n"
            f"Retrieved context:\n{context.model_dump_json(indent=2)}"
            f"{context_block}"
        )

        response = self.client.beta.chat.completions.parse(
            model=self.model,
            response_format=ReasonerOutput,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.parsed
