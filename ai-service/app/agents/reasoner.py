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
            "You receive a detected incident and rich location context, then reason through the situation "
            "to produce a clear, human-friendly explanation and actionable advice.\n\n"
            "Answer questions like 'Why is the traffic so bad on Burrard Bridge?' or "
            "'What's going on at Waterfront Station?' in a direct, confident tone — "
            "like a knowledgeable local who understands Vancouver's city systems.\n\n"
            "severity must be one of: low | medium | high | critical\n"
            "confidence: float between 0.0 and 1.0"
        )

    def reason(
        self,
        user_query: str,
        incident: DetectedIncident | dict,
        context: RetrievedContext,
    ) -> ReasonerOutput:
        """
        Reason over an incident and context to answer a user query.

        Args:
            user_query: The natural language question from the user.
            incident: DetectedIncident or dict from WatcherAgent.
            context: RetrievedContext from RetrieverAgent.

        Returns:
            ReasonerOutput with plain-English answer and recommendations.
        """
        incident_json = (
            incident.model_dump_json(indent=2)
            if isinstance(incident, DetectedIncident)
            else str(incident)
        )

        user_message = (
            f"User question: {user_query}\n\n"
            f"Detected incident:\n{incident_json}\n\n"
            f"Retrieved context:\n{context.model_dump_json(indent=2)}"
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
