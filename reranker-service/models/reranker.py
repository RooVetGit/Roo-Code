from typing import List, Dict, Any
import asyncio
import logging
from sentence_transformers import CrossEncoder
import torch
from concurrent.futures import ThreadPoolExecutor
import time

from config import (
    get_model_name,
    get_device,
    BATCH_SIZE,
    MODEL_CACHE_DIR,
    WARMUP_ON_START
)

logger = logging.getLogger(__name__)


class CrossEncoderReranker:
    """
    Cross-encoder based reranker using sentence-transformers.
    
    This class provides reranking functionality for code search results
    using pre-trained cross-encoder models.
    """
    
    def __init__(self, model_name: str = None):
        """
        Initialize the reranker with specified model.
        
        Args:
            model_name: Name of the cross-encoder model to use.
                       If None, uses the model from config.
        """
        self.model_name = model_name or get_model_name()
        self.device = get_device()
        self._executor = ThreadPoolExecutor(max_workers=1)
        
        logger.info(f"Initializing reranker with model: {self.model_name}")
        logger.info(f"Device: {self.device}")
        logger.info(f"Model cache directory: {MODEL_CACHE_DIR}")
        
        try:
            # Initialize CrossEncoder model with caching
            self.model = CrossEncoder(
                model_name=self.model_name,
                device=self.device,
                max_length=512,  # Maximum sequence length
                trust_remote_code=False
            )
            logger.info(f"Successfully loaded model: {self.model_name}")
            
            # Perform warmup if configured
            if WARMUP_ON_START:
                asyncio.create_task(self.warmup())
                
        except Exception as e:
            logger.error(f"Failed to load model {self.model_name}: {str(e)}")
            raise
        
    async def rerank(
        self, 
        query: str, 
        documents: List[Dict[str, Any]], 
        max_results: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Rerank documents based on query relevance using cross-encoder.
        
        Args:
            query: The search query
            documents: List of documents to rerank, each with 'id' and 'content'
            max_results: Maximum number of results to return
            
        Returns:
            List of reranked documents with scores and ranks
        """
        if not documents:
            return []
            
        start_time = time.time()
        logger.info(f"Reranking {len(documents)} documents for query: '{query}'")
        
        try:
            # Extract content and create query-document pairs
            pairs = [[query, doc["content"]] for doc in documents]
            
            # Run scoring in executor to avoid blocking
            loop = asyncio.get_event_loop()
            scores = await loop.run_in_executor(
                self._executor,
                self._score_pairs,
                pairs
            )
            
            # Create result objects with scores
            scored_docs = []
            for i, (doc, score) in enumerate(zip(documents, scores)):
                scored_docs.append({
                    "id": doc["id"],
                    "score": float(score),
                    "rank": 0  # Will be assigned after sorting
                })
            
            # Sort by score in descending order
            scored_docs.sort(key=lambda x: x["score"], reverse=True)
            
            # Assign ranks and limit results
            results = []
            for i, doc in enumerate(scored_docs[:max_results]):
                doc["rank"] = i + 1
                results.append(doc)
            
            elapsed_time = time.time() - start_time
            logger.info(
                f"Reranking complete in {elapsed_time:.2f}s. "
                f"Returning {len(results)} results"
            )
            
            return results
            
        except Exception as e:
            logger.error(f"Error during reranking: {str(e)}")
            raise
    
    def _score_pairs(self, pairs: List[List[str]]) -> List[float]:
        """
        Score query-document pairs using the cross-encoder model.
        
        This method is called in a separate thread to avoid blocking.
        
        Args:
            pairs: List of [query, document] pairs
            
        Returns:
            List of relevance scores
        """
        try:
            # Process in batches if needed
            all_scores = []
            
            for i in range(0, len(pairs), BATCH_SIZE):
                batch = pairs[i:i + BATCH_SIZE]
                batch_scores = self.model.predict(batch)
                all_scores.extend(batch_scores)
            
            return all_scores
            
        except Exception as e:
            logger.error(f"Error scoring pairs: {str(e)}")
            raise
        
    def validate_model(self) -> bool:
        """
        Validate that the model is properly loaded.
        
        Returns:
            True if model is valid, False otherwise
        """
        try:
            # Check if model is loaded
            if self.model is None:
                return False
                
            # Try a simple prediction to ensure model works
            test_pairs = [["test", "test"]]
            scores = self.model.predict(test_pairs)
            
            return len(scores) == 1 and isinstance(scores[0], (float, int))
            
        except Exception as e:
            logger.error(f"Model validation failed: {str(e)}")
            return False
        
    async def warmup(self):
        """
        Warm up the model with a sample query.
        This helps ensure the model is ready for production use.
        """
        logger.info("Warming up reranker model...")
        
        try:
            sample_docs = [
                {
                    "id": "warmup1", 
                    "content": "def authenticate_user(username, password): return True"
                },
                {
                    "id": "warmup2", 
                    "content": "class UserAuth: def login(self, user, pwd): pass"
                }
            ]
            
            results = await self.rerank("user authentication", sample_docs, max_results=2)
            logger.info(f"Warmup complete. Processed {len(results)} results")
            
        except Exception as e:
            logger.error(f"Warmup failed: {str(e)}")
            
    def __del__(self):
        """Clean up resources when the reranker is destroyed."""
        if hasattr(self, '_executor'):
            self._executor.shutdown(wait=False)