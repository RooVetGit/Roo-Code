# GitHub Actions for Evals

This document describes the GitHub Actions workflows available for the Roo Code Evals system.

## Workflows

### 1. `evals.yml` - Full Evaluation Workflow

**Purpose**: Comprehensive testing and evaluation workflow that builds, tests, and optionally runs full evaluations.

**Triggers**:

- Push to `main` or `develop` branches (when evals files change)
- Pull requests to `main` or `develop` branches (when evals files change)
- Manual dispatch with options

**Jobs**:

#### `build-and-test`

- Builds Docker images for web and runner services
- Starts PostgreSQL, Redis, and web services
- Waits for all services to be ready
- Runs database migrations
- Executes test suite
- Provides detailed logging on failure

#### `run-sample-evals` (conditional)

- Only runs when manually triggered with `run_full_evals: true`
- Requires `OPENROUTER_API_KEY` secret to be configured
- Runs a limited set of evaluations for CI testing
- Uploads evaluation results as artifacts
- Configurable concurrency level

#### `security-scan`

- Runs Trivy vulnerability scanner on the evals package
- Uploads results to GitHub Security tab

#### `docker-compose-validate`

- Validates Docker Compose file syntax
- Verifies all expected services are defined

**Required Secrets**:

- `OPENROUTER_API_KEY` (only for full evaluation runs)

### 2. `evals-quick-test.yml` - Quick Networking Test

**Purpose**: Fast validation of Docker Compose networking and basic functionality.

**Triggers**:

- Push to `main` or `develop` branches (when evals files change)
- Pull requests to `main` or `develop` branches (when evals files change)

**Jobs**:

#### `test-docker-compose`

- Tests inter-container networking between all services
- Verifies database and Redis connectivity
- Tests Docker socket access in runner container
- Validates service startup and health

#### `validate-compose-file`

- Validates Docker Compose syntax
- Checks service definitions and profiles

## Usage Examples

### Manual Workflow Dispatch

To run full evaluations manually:

1. Go to Actions tab in GitHub
2. Select "Evals Docker Compose" workflow
3. Click "Run workflow"
4. Configure options:
    - `run_full_evals`: Set to `true` to run actual evaluations
    - `concurrency`: Set evaluation concurrency (default: 2)

### Setting Up Secrets

For full evaluation runs, add the OpenRouter API key:

1. Go to repository Settings → Secrets and variables → Actions
2. Add new repository secret:
    - Name: `OPENROUTER_API_KEY`
    - Value: Your OpenRouter API key (e.g., `sk-or-v1-...`)

## Docker Compose Networking in GitHub Actions

The workflows demonstrate that Docker Compose networking works seamlessly in GitHub Actions:

### Service Communication

- Services communicate using service names as hostnames
- Database: `postgresql://postgres:password@db:5432/evals_development`
- Redis: `redis://redis:6379`
- Web service: `http://web:3000`

### Network Features Tested

- ✅ Container-to-container communication
- ✅ Service discovery via service names
- ✅ Port mapping and internal networking
- ✅ Health checks and service dependencies
- ✅ Docker socket mounting for Docker-in-Docker
- ✅ Volume mounts for data persistence
- ✅ Profile-based service grouping

### Networking Validation

The workflows include comprehensive networking tests:

```bash
# Test database connectivity
docker compose exec -T web sh -c 'nc -z db 5432'

# Test Redis connectivity
docker compose exec -T web sh -c 'nc -z redis 6379'

# Test cross-service communication
docker compose run --rm runner sh -c 'nc -z web 3000'
```

## Resource Considerations

GitHub Actions runners have the following limits:

- **Memory**: 7 GB RAM
- **CPU**: 2-core CPU
- **Disk**: 14 GB SSD space
- **Time**: 6 hours maximum job runtime

For the evals system:

- Quick tests typically complete in 5-10 minutes
- Full evaluation runs may take 30-60 minutes depending on scope
- Resource usage scales with concurrency settings

## Troubleshooting

### Common Issues

1. **Service startup timeouts**

    - Increase timeout values in workflow
    - Check service health check configurations
    - Review service logs in workflow output

2. **Networking failures**

    - Verify service names match docker-compose.yml
    - Check port configurations
    - Ensure services are in the same Docker network

3. **Docker socket access issues**
    - Verify `/var/run/docker.sock` mount in docker-compose.yml
    - Check Docker-in-Docker permissions

### Debugging

The workflows include comprehensive logging:

- Service status and health checks
- Network information and container details
- Service logs on failure
- Artifact uploads for evaluation results

To debug locally, you can run the same commands used in the workflows:

```bash
cd packages/evals

# Build and start services
docker compose --profile server up -d

# Test connectivity
docker compose exec -T web sh -c 'nc -z db 5432'
docker compose exec -T redis redis-cli ping

# View logs
docker compose logs db
docker compose logs redis
docker compose logs web
```

## Performance Optimization

For faster CI runs:

- Use Docker layer caching with `docker/setup-buildx-action`
- Minimize Docker image sizes
- Use health checks to avoid unnecessary wait times
- Run tests in parallel where possible
- Cache dependencies between workflow runs
