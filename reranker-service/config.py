"""
Configuration constants and settings for the reranker service.
"""

import os
from typing import Optional

# Model configuration
DEFAULT_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/app/.cache/models")

# API configuration
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8080"))
API_WORKERS = int(os.getenv("API_WORKERS", "1"))

# Reranking configuration
DEFAULT_MAX_RESULTS = 20
MAX_ALLOWED_RESULTS = 100
MIN_ALLOWED_RESULTS = 1
MAX_DOCUMENT_LENGTH = 10000  # Maximum characters per document

# Performance configuration
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))  # seconds
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "32"))

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:*,http://127.0.0.1:*").split(",")

# Device configuration
FORCE_CPU = os.getenv("FORCE_CPU", "false").lower() == "true"

# Model warmup configuration
WARMUP_ON_START = os.getenv("WARMUP_ON_START", "true").lower() == "true"

# Health check configuration
HEALTH_CHECK_TIMEOUT = 5  # seconds

def get_model_name() -> str:
    """Get the model name from environment or use default."""
    return os.getenv("MODEL_NAME", DEFAULT_MODEL_NAME)

def get_device() -> str:
    """Determine the device to use for model inference."""
    if FORCE_CPU:
        return "cpu"
    
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"

def validate_config() -> None:
    """Validate configuration settings."""
    if API_PORT < 1 or API_PORT > 65535:
        raise ValueError(f"Invalid API_PORT: {API_PORT}")
    
    if API_WORKERS < 1:
        raise ValueError(f"Invalid API_WORKERS: {API_WORKERS}")
    
    if REQUEST_TIMEOUT < 1:
        raise ValueError(f"Invalid REQUEST_TIMEOUT: {REQUEST_TIMEOUT}")
    
    if BATCH_SIZE < 1:
        raise ValueError(f"Invalid BATCH_SIZE: {BATCH_SIZE}")