from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class Document(BaseModel):
    """Document model for reranking"""
    id: str = Field(..., description="Unique identifier for the document")
    content: str = Field(..., description="The text content of the document")
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, 
        description="Optional metadata about the document"
    )


class RerankRequest(BaseModel):
    """Request model for reranking endpoint"""
    query: str = Field(
        ..., 
        description="The search query to use for reranking",
        min_length=1
    )
    documents: List[Document] = Field(
        ..., 
        description="List of documents to rerank",
        min_items=1
    )
    max_results: Optional[int] = Field(
        default=20,
        description="Maximum number of results to return",
        ge=1,
        le=100
    )

    class Config:
        json_schema_extra = {
            "example": {
                "query": "implement user authentication",
                "documents": [
                    {
                        "id": "doc1",
                        "content": "def authenticate_user(username, password):\n    # Implementation here",
                        "metadata": {
                            "filePath": "src/auth.py",
                            "startLine": 10,
                            "endLine": 20
                        }
                    },
                    {
                        "id": "doc2",
                        "content": "class UserAuth:\n    def login(self, user, pass):",
                        "metadata": {
                            "filePath": "src/models/user.py",
                            "startLine": 45,
                            "endLine": 50
                        }
                    }
                ],
                "max_results": 10
            }
        }


class RerankResponse(BaseModel):
    """Response model for reranking results"""
    id: str = Field(..., description="Document identifier")
    score: float = Field(..., description="Relevance score from the reranker")
    rank: int = Field(..., description="Rank position (1-based)")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "doc1",
                "score": 0.95,
                "rank": 1
            }
        }


class HealthResponse(BaseModel):
    """Response model for health check endpoint"""
    status: str = Field(
        ..., 
        description="Health status of the service",
        pattern="^(healthy|unhealthy)$"
    )
    model: str = Field(
        ..., 
        description="Name of the loaded model"
    )
    device: str = Field(
        ..., 
        description="Device being used (cpu/cuda)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "status": "healthy",
                "model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
                "device": "cuda"
            }
        }