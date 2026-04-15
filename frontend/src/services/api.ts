// Base fetch wrapper — all API calls go through here
import { API_BASE } from '../lib/api'
const BASE = `${API_BASE}/api`

// ---------------------------------------------------------------------------
// Access token — stored in memory only (never localStorage/sessionStorage).
// Refresh token lives in an httpOnly cookie set by the backend — JS cannot read it.
// ---------------------------------------------------------------------------

let _accessToken: string | null = null

export const authTokens = {
  getAccess: (): string | null => _accessToken,
  setAccess: (token: string) => { _accessToken = token },
  clearAccess: () => { _accessToken = null },
  // Called on register/login — backend sets the refresh cookie, we store the access token
  set: (access: string) => { _accessToken = access },
  clear: () => { _accessToken = null },
}

// ---------------------------------------------------------------------------
// Silent token refresh — POSTs to /auth/refresh/ (sends cookie automatically)
// ---------------------------------------------------------------------------

let _refreshPromise: Promise<string> | null = null

export async function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    const res = await fetch(`${BASE}/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',   // sends the httpOnly refresh cookie
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      authTokens.clear()
      throw new Error('Session expired')
    }
    const data = await res.json()
    _accessToken = data.access as string
    return _accessToken
  })()

  _refreshPromise.finally(() => { _refreshPromise = null })
  return _refreshPromise
}

// ---------------------------------------------------------------------------
// Core request — attaches Bearer token, retries once after refresh on 401
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',   // always include cookies for auth endpoints
  })

  // On 401 — try a silent refresh once, then retry the original request
  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken()
      return request<T>(path, options, false)
    } catch {
      authTokens.clear()
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
}
