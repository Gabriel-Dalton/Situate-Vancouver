/**
 * Local stack wiring (not shown in the product UI):
 *
 * - Vite proxies browser calls to `/api/*` → Django (default http://127.0.0.1:8000).
 * - Vite proxies `/ai/*` → FastAPI (default http://127.0.0.1:8001); the `/ai` prefix is stripped
 *   before the request hits FastAPI (see `frontend/vite.config.ts`).
 * - Sanity checks when hooking datasets: `GET /api/health/` (Django) and `GET /ai/health` (AI).
 * - In Docker Compose, set `API_PROXY_TARGET` and `AI_PROXY_TARGET` on the frontend service.
 *
 * Keep the main interface focused on Vancouver insight workflows; use the above when connecting
 * real layers, tiles, or model output to this map shell.
 */

export {}
