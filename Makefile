# Django (backend) + FastAPI (ai-service) + Vite (frontend); bind addresses/ports from repo-root `.env`.
# See `.env.example` (DJANGO_DEV_*, AI_DEV_*, FRONTEND_DEV_*, API_PROXY_TARGET, AI_PROXY_TARGET, …).
BACKEND_DIR := backend

# Prefer backend venv when present (path is relative to BACKEND_DIR because we `cd` there)
PYTHON := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)
ifneq (,$(wildcard $(BACKEND_DIR)/.venv/bin/python))
  PYTHON := .venv/bin/python
endif

.PHONY: run install help

help:
	@echo "Targets:"
	@echo "  make install      pip install -r backend/requirements.txt (uses .venv if present)"
	@echo "  make run          Start FastAPI + Vite frontend + Django (repo-root .env)"
	@echo "Env: copy .env.example to .env at repo root (Django and dev-run.sh load it)."

install:
	cd $(BACKEND_DIR) && $(PYTHON) -m pip install -r requirements.txt

run:
	bash scripts/dev-run.sh
