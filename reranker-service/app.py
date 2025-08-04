from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
import time
from datetime import datetime, timezone

from models.reranker import CrossEncoderReranker
from models.schemas import RerankRequest, RerankResponse, HealthResponse
from config import LOG_LEVEL, LOG_FORMAT, validate_config

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT
)
logger = logging.getLogger(__name__)

# Track startup time for uptime calculation
startup_time = time.time()

# Initialize FastAPI app
app = FastAPI(
    title="Code Reranker API",
    version="1.0.0",
    description="A FastAPI service for reranking code search results using cross-encoder models"
)

# Configure CORS middleware for localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://0.0.0.0:*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Validate configuration on startup
try:
    validate_config()
    logger.info("Configuration validated successfully")
except Exception as e:
    logger.error(f"Configuration validation failed: {str(e)}")
    raise

# Initialize reranker
try:
    reranker = CrossEncoderReranker()
    logger.info("Reranker initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize reranker: {str(e)}")
    reranker = None

@app.get("/")
async def root():
    """Root endpoint providing API information"""
    return {
        "name": "Code Reranker API",
        "version": "1.0.0",
        "status": "online",
        "endpoints": {
            "health": "/health",
            "rerank": "/rerank",
            "docs": "/docs"
        }
    }

@app.post("/rerank", response_model=List[RerankResponse])
async def rerank(request: RerankRequest):
    """
    Rerank code search results based on query relevance.
    
    Args:
        request: RerankRequest containing query, documents, and max_results
        
    Returns:
        List of RerankResponse objects with id, score, and rank
    """
    if not reranker:
        raise HTTPException(
            status_code=503,
            detail="Reranker service is not available"
        )
    
    try:
        # Validate request
        if not request.query:
            raise HTTPException(
                status_code=400,
                detail="Query cannot be empty"
            )
        
        if not request.documents:
            raise HTTPException(
                status_code=400,
                detail="Documents list cannot be empty"
            )
        
        # Convert Document objects to dictionaries for reranker
        documents = [doc.model_dump() for doc in request.documents]
        
        # Perform reranking
        results = await reranker.rerank(
            query=request.query,
            documents=documents,
            max_results=request.max_results or 20
        )
        
        return results
        
    except ValueError as e:
        logger.error(f"Invalid request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Reranking error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/health")
async def health():
    """
    Health check endpoint to verify service status.
    
    Returns:
        Extended health information including uptime
    """
    # Calculate uptime
    current_time = time.time()
    uptime_seconds = int(current_time - startup_time)
    uptime_hours = uptime_seconds // 3600
    uptime_minutes = (uptime_seconds % 3600) // 60
    uptime_str = f"{uptime_hours}h {uptime_minutes}m {uptime_seconds % 60}s"
    
    if not reranker:
        return {
            "status": "unhealthy",
            "model": "not loaded",
            "device": "unknown",
            "uptime": uptime_str,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": "Reranker not initialized"
        }
    
    try:
        # Perform model validation
        model_valid = reranker.validate_model()
        model_name = getattr(reranker, 'model_name', 'unknown')
        device = getattr(reranker, 'device', 'unknown')
        
        return {
            "status": "healthy" if model_valid else "degraded",
            "model": model_name,
            "device": device,
            "uptime": uptime_str,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_valid": model_valid
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "model": "error",
            "device": "error",
            "uptime": uptime_str,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }

# Add startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup"""
    logger.info("Code Reranker API starting up...")
    logger.info(f"Model: {reranker.model_name if reranker else 'Not loaded'}")
    logger.info(f"Device: {reranker.device if reranker else 'Unknown'}")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("Code Reranker API shutting down...")
    if reranker:
        # Cleanup will be handled by the reranker's __del__ method
        logger.info("Cleaning up reranker resources...")