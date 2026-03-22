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

متغیرهای محیطی نمونه در `.env.example`.
