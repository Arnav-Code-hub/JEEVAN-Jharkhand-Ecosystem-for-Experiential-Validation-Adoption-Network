"""Knowledge extraction service"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/extraction", tags=["Extraction"])


class ExtractionRequest(BaseModel):
    text: str
    entity_types: list[str] = ["organization", "location", "person"]


class ExtractionResponse(BaseModel):
    entities: list[dict]
    relationships: list[dict]
    competency_encoding: dict


@router.post("/")
async def extract_entities(request: ExtractionRequest):
    return ExtractionResponse(
        entities=[
            {"type": "location", "text": "Ranchi", "confidence": 0.95},
            {"type": "organization", "text": "Public Works Department", "confidence": 0.85}
        ],
        relationships=[],
        competency_encoding={
            "technical_skills": ["civil_engineering"],
            "domain_knowledge": ["water_management"],
            "soft_skills": ["community_engagement"]
        }
    )
