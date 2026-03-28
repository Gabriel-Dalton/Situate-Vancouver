# Django (backend) + FastAPI (ai-service) + Vite (frontend); bind addresses/ports from repo-root `.env`.
# See `.env.example` (DJANGO_DEV_*, AI_DEV_*, FRONTEND_DEV_*, API_PROXY_TARGET, AI_PROXY_TARGET, …).
BACKEND_DIR := backend
HOST ?= 127.0.0.1
# Align with frontend/vite.config.ts default API_PROXY_TARGET (127.0.0.1:8000).
PORT ?= 8000

# Prefer backend venv when present (BSD make has no ifneq; use one shell test).
PYTHON := $(shell if [ -x "$(BACKEND_DIR)/.venv/bin/python" ]; then echo "$(BACKEND_DIR)/.venv/bin/python"; else command -v python3 2>/dev/null || command -v python 2>/dev/null; fi)

.PHONY: dev dev-bg down build logs ps run stop worker beat celery poll install help

help:
	@echo "Targets:"
	@echo "  make dev          Build and start all services (Docker)"
	@echo "  make dev-bg       Same but run in background"
	@echo "  make down         Stop and remove all containers"
	@echo "  make build        Rebuild all images without cache"
	@echo "  make logs         Tail logs (all services, or service=<name> for one)"
	@echo "  make ps           Show running containers and ports"
	@echo "  make install      pip/npm install for all three services (local)"
	@echo "  make run          Start FastAPI + Vite + Django (repo-root .env via scripts/dev-run.sh)"
	@echo "  make stop         Kill all local dev servers (Django :1111, FastAPI :8001, Vite :5173)"
	@echo "  make celery       Start Celery worker + beat together in one terminal"
	@echo "  make worker       Start Celery worker only"
	@echo "  make beat         Start Celery Beat scheduler only"
	@echo "  make poll         Run all polling tasks once right now (no Celery needed)"
	@echo "Env: copy .env.example to .env at repo root (Django and dev-run.sh load it)."

# ── Docker (full stack) ────────────────────────────────────────────────────

dev:
	docker compose up --build

dev-bg:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f $(service)

ps:
	docker compose ps

# ── Local (no Docker) ─────────────────────────────────────────────────────

install:
	cd backend && pip3 install -r requirements.txt
	cd ai-service && pip3 install -r requirements.txt
	cd frontend && npm install

run:
	bash scripts/dev-run.sh

celery:
	cd backend && celery -A config worker --beat --loglevel=info --pool=solo --scheduler django_celery_beat.schedulers:DatabaseScheduler

worker:
	cd backend && celery -A config worker --loglevel=info --pool=solo

beat:
	cd backend && celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler

poll:
	cd backend && python3 manage.py shell -c "\
from apps.core.tasks import poll_drivebc, poll_vancouver_opendata, poll_surrey; \
print('Polling DriveBC...'); r1 = poll_drivebc(); print(r1); \
print('Polling Vancouver Open Data...'); r2 = poll_vancouver_opendata(); print(r2); \
print('Polling Surrey...'); r3 = poll_surrey(); print(r3)"

stop:
	@echo "Stopping all services..."
	@lsof -tiTCP:1111 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
	@lsof -tiTCP:8001 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
	@lsof -tiTCP:5173 -sTCP:LISTEN | xargs kill -9 2>/dev/null || true
	@pkill -f "celery -A config" 2>/dev/null || true
	@echo "Done."
