# Django API (backend)
BACKEND_DIR := backend
HOST ?= 127.0.0.1
# Align with frontend/vite.config.ts default API_PROXY_TARGET (127.0.0.1:8000).
PORT ?= 8000

# Prefer backend venv when present (path is relative to BACKEND_DIR because we `cd` there)
PYTHON := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)
ifneq (,$(wildcard $(BACKEND_DIR)/.venv/bin/python))
  PYTHON := .venv/bin/python
endif

.PHONY: dev dev-bg down build logs ps run install help

help:
	@echo "Targets:"
	@echo "  make dev          Build and start all services (Docker)"
	@echo "  make dev-bg       Same but run in background"
	@echo "  make down         Stop and remove all containers"
	@echo "  make build        Rebuild all images without cache"
	@echo "  make logs         Tail logs (all services, or service=<name> for one)"
	@echo "  make ps           Show running containers and ports"
	@echo "  make install      pip/npm install for all three services (local)"
	@echo "  make run          Start Django only (default $(HOST):$(PORT))"

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
	cd $(BACKEND_DIR) && $(PYTHON) manage.py runserver $(HOST):$(PORT)
