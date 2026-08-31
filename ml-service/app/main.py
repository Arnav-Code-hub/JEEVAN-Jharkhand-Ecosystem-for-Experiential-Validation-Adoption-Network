"""Main entry point for ML service"""
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.triage.router import router as triage_router
from app.extraction.router import router as extraction_router
from app.prediction.router import router as prediction_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup/shutdown hooks.

    Neo4j was removed here per ADR-0002 — competency data lives in PostgreSQL
    with pgvector, owned by the NestJS backend. This service holds no database
    connection of its own; it receives everything it needs in the request body.
    """
    yield


app = FastAPI(
    title="SIH ML Service",
    description="AI/ML microservices for Societal Innovation Portal",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "SIH ML Service - Running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


app.include_router(triage_router)
app.include_router(extraction_router)
app.include_router(prediction_router)
