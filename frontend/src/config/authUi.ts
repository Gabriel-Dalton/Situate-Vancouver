/**
 * Header auth UI — enabled by default now that the auth API exists.
 * Set VITE_ENABLE_AUTH_UI=false to hide it (e.g. for screenshots).
 */
export const AUTH_UI_ENABLED = import.meta.env.VITE_ENABLE_AUTH_UI !== 'false'
