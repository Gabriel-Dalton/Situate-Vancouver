// Base fetch wrapper — all API calls go through here
import { API_BASE } from '../lib/api'
const BASE = `${API_BASE}/api`

// ---------------------------------------------------------------------------
// Token storage helpers
// ---------------------------------------------------------------------------

const ACCESS_KEY = 'situate_access'
const REFRESH_KEY = 'situate_refresh'

export const authTokens = {
  getAccess: (): string | null => localStorage.getItem(ACCESS_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// ---------------------------------------------------------------------------
// Silent token refresh — called when a request gets a 401
// ---------------------------------------------------------------------------

let _refreshPromise: Promise<string> | null = null

async function _refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    const refresh = authTokens.getRefresh()
    if (!refresh) throw new Error('No refresh token')

    const res = await fetch(`${BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) {
      authTokens.clear()
      throw new Error('Session expired')
    }
    const data = await res.json()
    authTokens.set(data.access, data.refresh ?? refresh)
    return data.access as string
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
  const access = authTokens.getAccess()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (access) headers['Authorization'] = `Bearer ${access}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  // On 401 — try a silent refresh once, then retry the original request
  if (res.status === 401 && retry) {
    try {
      await _refreshAccessToken()
      return request<T>(path, options, false)
    } catch {
      authTokens.clear()
      // Let the error propagate so UI can react
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
