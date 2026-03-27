/**
 * Header auth UI (sign-in / sign-up modal) stays implemented but hidden until the auth API exists.
 * Set `VITE_ENABLE_AUTH_UI=true` in `.env.development.local` (or env) to preview it locally.
 */
export const AUTH_UI_ENABLED = import.meta.env.VITE_ENABLE_AUTH_UI === 'true'
