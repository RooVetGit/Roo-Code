#!/bin/bash

echo "🧹 Cleaning up Docker resources for evals..."

echo "Stopping containers..."
docker compose down --remove-orphans

echo "Removing dangling networks..."
docker network prune -f

echo "Removing unused volumes..."
docker volume prune -f

echo "Removing dangling images..."
docker image prune -f

echo "✅ Cleanup complete!"
