#!/bin/sh
# TauX Production Deployment Script (Go Project)
# Modeled after tslmai angular deployment script

set -e

echo "=== [1/5] Pulling latest code from Git ==="
git pull

echo "=== [2/5] Building Docker image for Go App ==="
# Referencing the project's existing Dockerfile (multi-stage build)
docker build -f ./Dockerfile -t taux-website-prod:latest .

echo "=== [3/5] Cleaning up old container if running ==="
# Stop and remove existing container if it exists
docker ps -a -q --filter "name=taux-website-prod" | grep -q . && docker rm -f taux-website-prod

echo "=== [4/5] Checking Docker Network ==="
# Ensure the network matching nginx-proxy exists
docker network inspect taux_frontend >/dev/null 2>&1 || docker network create taux_frontend

echo "=== [5/5] Running new Go App container ==="
# Run the Go app in production mode
# VIRTUAL_HOST and LETSENCRYPT_HOST hook it into the host's nginx-proxy (listening on 80/443)
docker run --detach \
    --name taux-website-prod \
    --env "GIN_MODE=release" \
    --env "PORT=8080" \
    --env "VIRTUAL_HOST=taux.io,www.taux.io" \
    --env "VIRTUAL_PORT=8080" \
    --env "LETSENCRYPT_HOST=taux.io,www.taux.io" \
    --env "LETSENCRYPT_EMAIL=app-service@bonbondi.com" \
    --network taux_frontend \
    --restart unless-stopped \
    taux-website-prod:latest

echo "=== [Clean] Pruning unused Docker images ==="
docker image prune -f

echo "=== Deployment Completed Successfully! ==="
