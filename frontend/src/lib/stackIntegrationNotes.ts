/**
 * Local stack wiring (not shown in the product UI):
 *
 * - Vite proxies browser calls to `/api/*` → Django (default http://127.0.0.1:8000).
 * - `API_PROXY_TARGET` / `AI_PROXY_TARGET` are read from the repo-root `.env` (see vite.config.ts).
 * - GET `/api/health/` is forwarded in dev by a small plugin so a down Django returns JSON instead of proxy ECONNREFUSED noise.
 * - Optional `HEALTH_VANCOUVER_OPENDATA_STATUS_URL` (repo-root `.env`): copy `checks.vancouver_opendata` from that aggregate health JSON (e.g. production).
 * - Vite proxies `/ai/*` → FastAPI (default http://127.0.0.1:8001); the `/ai` prefix is stripped
 *   before the request hits FastAPI (see `frontend/vite.config.ts`).
 * - Sanity checks when hooking datasets: `GET /api/health/` (Django) and `GET /ai/health` (AI).
 * - In Docker Compose, set `API_PROXY_TARGET` and `AI_PROXY_TARGET` on the frontend service.
 *
 * Keep the main interface focused on Vancouver insight workflows; use the above when connecting
 * real layers, tiles, or model output to this map shell.
 */

export {}
