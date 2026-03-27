# Situate Vancouver — monorepo

Three services: **Django (API)**, **FastAPI (AI)**, **Vite + React (frontend)**.

## Ports

| Service   | Port |
|-----------|------|
| Django    | 1111 |
| FastAPI   | 8001 |
| Frontend  | 5173 |

## Local development

**One terminal — all three:** From the repo root, run `cp .env.example .env`, create a venv and install dependencies once in `backend` and `ai-service`, run `cd frontend && npm install` once, then:

```bash
make run
```

Ports and bind addresses are read from the repo-root `.env` (`DJANGO_DEV_*`, `AI_DEV_*`, `FRONTEND_DEV_*`, `API_PROXY_TARGET`, `AI_PROXY_TARGET`, `AI_SERVICE_URL`, …).

**Three terminals (manual)**

1. **Backend**

   ```bash
   cd backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver 127.0.0.1:1111
   ```

2. **AI service**

   ```bash
   cd ai-service
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8001
   ```

3. **Frontend** (proxies `/api` → Django and `/ai` → FastAPI)

   ```bash
   cd frontend && npm install && npm run dev
   ```

   **Unit tests (Jest):**

   ```bash
   cd frontend && npm test
   ```

   The frontend includes `frontend/.npmrc` with `legacy-peer-deps=true` so `npm install` stays consistent with the current ESLint peer dependency set.

Then open **`http://localhost:5173`** for the marketing landing page. The React insight canvas (map + health checks) is at **`http://localhost:5173/app.html`**.

## Docker Compose

```bash
docker compose up --build
```

## Sample URLs

- Django health: `GET http://localhost:1111/api/health/`
- AI health: `GET http://localhost:8001/health`
- FastAPI docs: `http://localhost:8001/docs`

Environment variables live in the repo-root `.env` file.

## API / Vite proxy (troubleshooting)

The dev server proxies browser requests from `/api/*` to Django. The default target is `http://127.0.0.1:1111`. Vite reads `API_PROXY_TARGET` and `AI_PROXY_TARGET` from the **repository root** `.env` (not only from shell environment).

- **ECONNREFUSED / “API Unreachable”**: Django is not listening on the proxy target. Start it with `cd backend && python manage.py runserver 127.0.0.1:1111`, or `make run` (starts Django + FastAPI + Vite; ports come from repo-root `.env`, default Django **1111**).
- **Custom Django / AI ports**: Set `DJANGO_DEV_PORT`, `AI_DEV_PORT`, `AI_SERVICE_URL`, `API_PROXY_TARGET`, and `AI_PROXY_TARGET` in repo-root `.env` (see `.env.example`).
- **`/api/health/`** is handled in dev by a small Vite plugin that forwards to Django and returns JSON if Django is down, so the terminal is not spammed with proxy connection errors for that route.
