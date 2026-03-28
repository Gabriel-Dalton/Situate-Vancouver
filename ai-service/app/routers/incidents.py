import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.agents import OrchestratorAgent, QueryResponse, DetectedIncident
from app.openai_config import OpenAIConfigurationError

router = APIRouter(prefix="/incidents", tags=["incidents"])
limiter = Limiter(key_func=get_remote_address)

# Characters that have no place in a natural language city query
_BLOCKED = re.compile(r"[<>{}\[\]\\;`]")
# Max length to prevent prompt stuffing
_MAX_LEN = 300

# ---------------------------------------------------------------------------
# Singleton orchestrator — instantiated once when the module is first loaded,
# shared across all requests.
# ---------------------------------------------------------------------------

_orchestrator: OrchestratorAgent | None = None


def get_orchestrator() -> OrchestratorAgent:
    global _orchestrator
    if _orchestrator is None:
        try:
            _orchestrator = OrchestratorAgent()
        except OpenAIConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _orchestrator


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("query must not be empty")
        if len(v) > _MAX_LEN:
            raise ValueError(f"query must be {_MAX_LEN} characters or fewer")
        if _BLOCKED.search(v):
            raise ValueError("query contains invalid characters")
        return v


class ReportRequest(BaseModel):
    report: str
    reported_by: str = "citizen"

    @field_validator("report")
    @classmethod
    def validate_report(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("report must not be empty")
        if len(v) > _MAX_LEN:
            raise ValueError(f"report must be {_MAX_LEN} characters or fewer")
        if _BLOCKED.search(v):
            raise ValueError("report contains invalid characters")
        return v

    @field_validator("reported_by")
    @classmethod
    def validate_reported_by(cls, v: str) -> str:
        if len(v) > 100:
            raise ValueError("reported_by must be 100 characters or fewer")
        return v.strip()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/query", response_model=QueryResponse)
@limiter.limit("20/minute")
def query(
    request: Request,
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
@limiter.limit("10/minute")
def report_incident(
    request: Request,
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
