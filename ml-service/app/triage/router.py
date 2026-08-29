"""Triage service for processing citizen complaints"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/triage", tags=["Triage"])


class TriageRequest(BaseModel):
    description: str
    location: dict | None = None
    media_urls: list[str] = []


class TriageResponse(BaseModel):
    is_emergency: bool
    competency_tags: list[str]
    confidence: float
    recommended_action: str


@router.post("/", response_model=TriageResponse)
async def triage_complaint(request: TriageRequest):
    return TriageResponse(
        is_emergency=False,
        competency_tags=["infrastructure", "sanitation"],
        confidence=0.85,
        recommended_action="route_to_citizen_module"
    )
