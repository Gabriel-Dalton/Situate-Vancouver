/**
 * API base URL helper.
 *
 * Web (Vite dev / production served from same origin):
 *   Returns '' so all fetch('/api/...') calls stay relative — Vite proxies them in dev,
 *   and the reverse proxy (nginx / Caddy) routes them in production.
 *
 * Native (Capacitor iOS / Android):
 *   The WebView loads from capacitor://localhost — relative /api paths don't resolve.
 *   VITE_API_BASE_URL must be set to the production Django origin during the native build,
 *   e.g.  VITE_API_BASE_URL=https://api.situatevancouver.ca npm run build:native
 */

const isNative = typeof window !== 'undefined'
  && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.()

export const API_BASE: string = isNative
  ? (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '')
  : ''

/** Build an absolute API path, e.g. apiUrl('/api/outages/') */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}
