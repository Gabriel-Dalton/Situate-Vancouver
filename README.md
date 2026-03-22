# Situate Vancouver — monorepo

سه سرویس: **Django (API)**، **FastAPI (AI)**، **Vite + React (frontend)**.

## پورت‌ها

| سرویس    | پورت |
|----------|------|
| Django   | 8000 |
| FastAPI  | 8001 |
| Frontend | 5173 |

## اجرای محلی (سه ترمینال)

1. **Backend**

   ```bash
   cd backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

2. **AI service**

   ```bash
   cd ai-service
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8001
   ```

3. **Frontend** (پروکسی `/api` → Django و `/ai` → FastAPI)

   ```bash
   cd frontend && npm install && npm run dev
   ```

سپس `http://localhost:5173` را باز کنید؛ وضعیت هر دو health روی صفحه نمایش داده می‌شود.

## Docker Compose

```bash
docker compose up --build
```

## مسیرهای نمونه

- Django health: `GET http://localhost:8000/api/health/`
- AI health: `GET http://localhost:8001/health`
- FastAPI docs: `http://localhost:8001/docs`

متغیرهای محیطی در روت ریپو در فایل `.env`.

## API / Vite proxy (troubleshooting)

The dev server proxies browser requests from `/api/*` to Django. The default target is `http://127.0.0.1:8000`. Vite reads `API_PROXY_TARGET` and `AI_PROXY_TARGET` from the **repository root** `.env` (not only from shell environment).

- **ECONNREFUSED / “API Unreachable”**: Django is not listening on the proxy target. Start it with `cd backend && python manage.py runserver` (port **8000** by default), or `make run` (Makefile default port is **8000** and matches Vite).
- **Custom Django port**: Set `API_PROXY_TARGET=http://127.0.0.1:<port>` in repo-root `.env`.
- **`/api/health/`** is handled in dev by a small Vite plugin that forwards to Django and returns JSON if Django is down, so the terminal is not spammed with proxy connection errors for that route.
