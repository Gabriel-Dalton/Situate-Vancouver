from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.agents import OrchestratorAgent, QueryResponse, DetectedIncident

router = APIRouter(prefix="/incidents", tags=["incidents"])

# ---------------------------------------------------------------------------
# Singleton orchestrator — instantiated once when the module is first loaded,
# shared across all requests.
# ---------------------------------------------------------------------------

_orchestrator: OrchestratorAgent | None = None


def get_orchestrator() -> OrchestratorAgent:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = OrchestratorAgent()
    return _orchestrator


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    query: str


class ReportRequest(BaseModel):
    report: str
    reported_by: str = "citizen"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/query", response_model=QueryResponse)
def query(
    body: QueryRequest,
    orchestrator: OrchestratorAgent = Depends(get_orchestrator),
) -> QueryResponse:
    """
    Answer a natural language question about Vancouver conditions.

    Request:
        { "query": "Why is the traffic so bad on Burrard street?" }

    Response: QueryResponse — original_query, query_type, verdict, severity,
              location, cause, impact, recommended_actions, estimated_duration,
              related_alerts, cache_hit, confidence.
    """
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="query must not be empty")

    return orchestrator.answer_query(user_query=body.query)


@router.post("/report", response_model=DetectedIncident)
def report_incident(
    body: ReportRequest,
    orchestrator: OrchestratorAgent = Depends(get_orchestrator),
) -> DetectedIncident:
    """
    Submit a citizen-reported incident in plain text.

    Request:
        { "report": "tree branch fallen on knight street" }

    Response: DetectedIncident — structured map pin with location,
              coordinates, severity, and incident type.
    """
    if not body.report.strip():
        raise HTTPException(status_code=400, detail="report must not be empty")

    return orchestrator.submit_incident(
        report=body.report,
        reported_by=body.reported_by,
    )
