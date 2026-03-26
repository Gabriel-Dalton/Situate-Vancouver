# Monitoring (Sentry)

This repo supports frontend monitoring via **Sentry**.

## Frontend (Vite + React)

### 1) Add the DSN

Set this in the **repo-root** `.env`:

- `VITE_SENTRY_DSN`: Sentry project DSN (leave empty to disable Sentry)

Optional:

- `VITE_SENTRY_ENV`: environment label (defaults to Vite mode)
- `VITE_SENTRY_RELEASE`: release label (e.g. git SHA)

### 2) (Optional) Upload source maps

If you want readable stack traces in Sentry, configure source map upload by setting:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

When these are present, the Vite build will upload source maps from `frontend/dist/`.

## Notes

- If `VITE_SENTRY_DSN` is not set, Sentry does nothing (safe for local dev).
- The SDK is initialized in `frontend/src/main.tsx`.
- The upload hook is configured in `frontend/vite.config.ts`.

