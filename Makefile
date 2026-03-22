# Django API (backend)
BACKEND_DIR := backend
HOST ?= 127.0.0.1
PORT ?= 1111

# Prefer backend venv when present (path is relative to BACKEND_DIR because we `cd` there)
PYTHON := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null)
ifneq (,$(wildcard $(BACKEND_DIR)/.venv/bin/python))
  PYTHON := .venv/bin/python
endif

.PHONY: run install help

help:
	@echo "Targets:"
	@echo "  make install      pip install -r backend/requirements.txt (uses .venv if present)"
	@echo "  make run          Start Django (default $(HOST):$(PORT))"
	@echo "  make run PORT=8000   Use another port"
	@echo "Env: shared variables live in repo-root .env (tracked in git)."

install:
	cd $(BACKEND_DIR) && $(PYTHON) -m pip install -r requirements.txt

run:
	cd $(BACKEND_DIR) && $(PYTHON) manage.py runserver $(HOST):$(PORT)
