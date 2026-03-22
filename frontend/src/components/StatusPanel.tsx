import { useCallback, useEffect, useState } from 'react'

interface ServiceCheck {
  status: 'ok' | 'error' | 'not_configured' | 'skipped'
  message: string
  latency_ms?: number
  base_url?: string
  url?: string
  catalog_probe?: string
  /** When Vancouver Open Data status is copied from a remote aggregate /api/health. */
  health_source_url?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  service: string
  checks: Record<string, ServiceCheck>
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'Online',
  error: 'Offline',
  not_configured: 'Not set',
  skipped: 'Skipped',
}

/** Display order for known checks; any extra keys from the API are listed after, sorted. */
const CHECK_ORDER = ['django', 'vancouver_opendata', 'ai_service'] as const

const POLL_INTERVAL_MS = 30_000

const MSG_APP_UNAVAILABLE =
  'We could not reach the app. Please try again in a few minutes or check your connection.'

/**
 * Production aggregate health JSON. In dev, Vite proxies `/__situate_health` to this URL (see
 * vite.config). Override at build time with `VITE_HEALTH_URL` if your deploy needs a different
 * path (for example same-origin `/api/health/`).
 */
function healthEndpointUrl(): string {
  const fromEnv = import.meta.env.VITE_HEALTH_URL as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim()
  if (import.meta.env.DEV) return '/__situate_health'
  return 'https://www.ageforty.com/api/health/'
}

function parseHealthPayload(text: string): HealthResponse | null {
  try {
    const data = JSON.parse(text) as unknown
    if (!data || typeof data !== 'object') return null
    const o = data as Record<string, unknown>
    if (typeof o.status !== 'string') return null
    if (!o.checks || typeof o.checks !== 'object') return null
    return data as HealthResponse
  } catch {
    return null
  }
}

function syntheticUnhealthy(): HealthResponse {
  return {
    status: 'unhealthy',
    service: 'django',
    checks: {
      django: { status: 'error', message: MSG_APP_UNAVAILABLE },
    },
  }
}

function orderedCheckEntries(checks: Record<string, ServiceCheck>): [string, ServiceCheck][] {
  const known = new Set<string>(CHECK_ORDER)
  const primary = CHECK_ORDER.filter((key) => checks[key] != null).map(
    (key) => [key, checks[key]] as [string, ServiceCheck],
  )
  const rest = Object.keys(checks)
    .filter((k) => !known.has(k))
    .sort()
    .map((key) => [key, checks[key]] as [string, ServiceCheck])
  return [...primary, ...rest]
}

function friendlyServiceTitle(key: string): string {
  const map: Record<string, string> = {
    django: 'App server',
    vancouver_opendata: 'City open data',
    ai_service: 'AI features',
  }
  return (
    map[key] ??
    key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/** Plain-language description for non-technical readers; prefers API `message` when it is clear. */
function userFacingCheckMessage(key: string, check: ServiceCheck): string {
  const raw = check.message?.trim() ?? ''

  if (check.status === 'ok') {
    if (key === 'django' && /django/i.test(raw)) {
      return 'The app is running normally.'
    }
    if (key === 'ai_service' && (raw.includes('/health') || /AI service/i.test(raw))) {
      return 'AI-assisted features are connected and working.'
    }
    if (raw) return raw
    return 'This part of the system is working.'
  }

  if (check.status === 'error') {
    if (key === 'django') return MSG_APP_UNAVAILABLE
    if (raw) return raw
    return 'This service is not responding right now.'
  }

  if (check.status === 'not_configured') {
    return raw || 'This option is not set up in this environment.'
  }

  if (check.status === 'skipped') {
    return raw || 'This check was not run.'
  }

  return raw || 'Status is not available.'
}

function technicalLines(check: ServiceCheck): string[] {
  const lines: string[] = []
  if (check.latency_ms != null) {
    lines.push(`Response time: ${check.latency_ms.toFixed(0)} ms`)
  }
  if (check.base_url) {
    lines.push(`Data source: ${check.base_url}`)
  }
  if (check.url) {
    lines.push(`Health URL: ${check.url}`)
  }
  if (check.health_source_url) {
    lines.push(`Status copied from: ${check.health_source_url}`)
  }
  if (check.catalog_probe) {
    lines.push(`Probe: ${check.catalog_probe}`)
  }
  return lines
}

export default function StatusPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    const url = healthEndpointUrl()
    try {
      const res = await fetch(url)
      const text = await res.text()
      const data = parseHealthPayload(text)
      setHealth(data && res.ok ? data : syntheticUnhealthy())
      setLastChecked(new Date())
    } catch {
      setHealth(syntheticUnhealthy())
      setLastChecked(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const id = window.setInterval(fetchHealth, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [fetchHealth])

  if (loading) {
    return (
      <div className="status-panel">
        <p className="status-panel__loading">Checking status…</p>
      </div>
    )
  }

  if (!health) return null

  const entries = orderedCheckEntries(health.checks)

  return (
    <div className="status-panel">
      <div className={`status-panel__overall status-panel__overall--${health.status}`}>
        <span className="status-panel__overall-dot" />
        <span className="status-panel__overall-label">
          {health.status === 'healthy'
            ? 'All systems operational'
            : health.status === 'degraded'
              ? 'Some features are limited'
              : 'Something is not reachable'}
        </span>
      </div>

      {entries.map(([name, check]) => (
        <ServiceCheckRow key={name} name={name} check={check} />
      ))}

      {lastChecked && (
        <span className="status-panel__timestamp">
          Last checked{' '}
          {lastChecked.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })}
        </span>
      )}
    </div>
  )
}

function ServiceCheckRow({ name, check }: { name: string; check: ServiceCheck }) {
  const title = friendlyServiceTitle(name)
  const message = userFacingCheckMessage(name, check)
  const tech = technicalLines(check)

  return (
    <div className={`status-check status-check--${check.status}`}>
      <span className="status-check__dot" />
      <div className="status-check__body">
        <div className="status-check__header">
          <span className="status-check__name">{title}</span>
          <span className="status-check__badge">{STATUS_LABEL[check.status] ?? check.status}</span>
        </div>
        {message && <span className="status-check__msg">{message}</span>}
        {tech.length > 0 && (
          <details className="status-check__details">
            <summary className="status-check__details-summary">Technical details</summary>
            <ul className="status-check__details-list">
              {tech.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}
