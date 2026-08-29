"""Main entry point for ML service"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.triage.router import router as triage_router
from app.extraction.router import router as extraction_router
from app.prediction.router import router as prediction_router
from app.models.neo4j_driver import neo4j_service

app = FastAPI(
    title="SIH ML Service",
    description="AI/ML microservices for Societal Innovation Portal",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Connect to Neo4j on startup"""
    neo4j_service.connect()


@app.on_event("shutdown")
async def shutdown_event():
    """Close Neo4j connection on shutdown"""
    neo4j_service.close()


@app.get("/")
async def root():
    return {"message": "SIH ML Service - Running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


app.include_router(triage_router)
app.include_router(extraction_router)
app.include_router(prediction_router)
