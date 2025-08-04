# Code Reranker Service

A FastAPI-based service for reranking code search results using cross-encoder models. This service is designed to improve the relevance of search results in the Roo-Code codebase indexing feature.

## Overview

The reranker service uses sentence-transformers with cross-encoder models to rerank code search results based on query-document relevance. It provides a simple REST API that accepts a query and a list of candidate documents, then returns them ordered by relevance.

## Prerequisites

- Python 3.10 or higher
- Docker and Docker Compose (for containerized deployment)
- CUDA-capable GPU (optional, for improved performance)

## Quick Start

### Using Docker Compose (Recommended)

1. Navigate to the reranker service directory:

    ```bash
    cd reranker-service
    ```

2. Build and start the service:

    ```bash
    docker-compose up --build
    ```

3. The service will be available at `http://localhost:8080`

### Using Python Directly

1. Create a virtual environment:

    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

2. Install dependencies:

    ```bash
    pip install -r requirements.txt
    ```

3. Run the service:
    ```bash
    uvicorn app:app --host 0.0.0.0 --port 8080
    ```

## API Endpoints

### Health Check

```
GET /health
```

Returns the service health status and model information.

### Rerank

```
POST /rerank
```

Reranks documents based on query relevance.

**Request Body:**

```json
{
	"query": "implement user authentication",
	"documents": [
		{
			"id": "doc1",
			"content": "def authenticate_user(username, password):",
			"metadata": {
				"filePath": "src/auth.py",
				"startLine": 10,
				"endLine": 20
			}
		}
	],
	"max_results": 20
}
```

**Response:**

```json
[
	{
		"id": "doc1",
		"score": 0.95,
		"rank": 1
	}
]
```

### API Documentation

- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`

## Configuration

The service can be configured using environment variables:

| Variable          | Description                              | Default                                |
| ----------------- | ---------------------------------------- | -------------------------------------- |
| `MODEL_NAME`      | Cross-encoder model to use               | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| `API_PORT`        | Port to run the service on               | `8080`                                 |
| `API_WORKERS`     | Number of worker processes               | `1`                                    |
| `REQUEST_TIMEOUT` | Request timeout in seconds               | `30`                                   |
| `BATCH_SIZE`      | Batch size for model inference           | `32`                                   |
| `LOG_LEVEL`       | Logging level                            | `INFO`                                 |
| `FORCE_CPU`       | Force CPU usage even if GPU is available | `false`                                |
| `WARMUP_ON_START` | Warm up model on startup                 | `true`                                 |

## Development

### Running Tests

```bash
pytest tests/
```

### Building Docker Image

```bash
docker build -t code-reranker .
```

### Development Mode

For development, you can mount your local code into the container:

```bash
docker-compose -f docker-compose.yml up
```

This will mount the source files as volumes, allowing you to make changes without rebuilding the image.

## Model Information

The default model (`cross-encoder/ms-marco-MiniLM-L-6-v2`) is a lightweight cross-encoder optimized for passage reranking. It provides a good balance between performance and accuracy.

### Supported Models

- `cross-encoder/ms-marco-MiniLM-L-6-v2` (default)
- `cross-encoder/ms-marco-MiniLM-L-12-v2` (higher accuracy, slower)
- `cross-encoder/ms-marco-TinyBERT-L-2-v2` (faster, lower accuracy)

## Performance Considerations

1. **GPU Usage**: The service will automatically use CUDA if available. For CPU-only deployment, set `FORCE_CPU=true`.

2. **Model Caching**: Models are downloaded and cached in `/app/.cache/models` during the Docker build process.

3. **Batch Processing**: Adjust `BATCH_SIZE` based on your hardware capabilities and memory constraints.

4. **Resource Limits**: The Docker Compose configuration sets memory limits (2GB max, 1GB reserved). Adjust these based on your needs.

## Troubleshooting

### Service won't start

- Check logs: `docker-compose logs reranker`
- Ensure port 8080 is not already in use
- Verify Docker daemon is running

### Out of memory errors

- Reduce `BATCH_SIZE`
- Increase Docker memory limits in `docker-compose.yml`
- Use a smaller model

### Slow performance

- Enable GPU support by ensuring CUDA is available
- Use a smaller model for faster inference
- Increase `API_WORKERS` for parallel processing

## Next Steps

This is a placeholder implementation. The actual implementation should:

1. Integrate the real CrossEncoder model from sentence-transformers
2. Add proper error handling and validation
3. Implement request queuing for high load
4. Add metrics and monitoring
5. Implement model versioning and updates

## License

This service is part of the Roo-Code project.
