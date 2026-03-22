import { useCallback, useEffect, useState } from 'react'

interface ServiceCheck {
  status: 'ok' | 'error' | 'not_configured' | 'skipped'
  message: string
  latency_ms?: number
  base_url?: string
  url?: string
  /** When Vancouver Open Data status is copied from a remote aggregate /api/health. */
  health_source_url?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  service: string
  checks: Record<string, ServiceCheck>
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  error: 'ERR',
  not_configured: 'N/A',
  skipped: 'SKIP',
}

const POLL_INTERVAL_MS = 30_000

/** Checks we still fetch but do not show in the sidebar (backend may still return them). */
const HIDDEN_CHECK_KEYS = new Set(['ai_service'])

const MSG_APP_UNAVAILABLE =
  'We could not connect to the app services. Please try again in a few minutes.'

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

function describeCityDataLatency(ms: number): string {
  if (ms < 300) return 'The city data link responded quickly.'
  if (ms < 1000) return 'The city data link is responding at a normal speed.'
  return 'The city data link is slower than usual, but it is working.'
}

export default function StatusPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/')
      const text = await res.text()
      const data = parseHealthPayload(text)
      setHealth(data ?? syntheticUnhealthy())
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

  const entries = Object.entries(health.checks).filter(([key]) => !HIDDEN_CHECK_KEYS.has(key))

  return (
    <div className="status-panel">
      <div className={`status-panel__overall status-panel__overall--${health.status}`}>
        <span className="status-panel__overall-dot" />
        <span className="status-panel__overall-label">
          {health.status === 'healthy'
            ? 'All systems operational'
            : health.status === 'degraded'
              ? 'Some features are limited'
              : 'Unhealthy'}
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

function getRowPresentation(name: string, check: ServiceCheck) {
  if (name === 'django') {
    return {
      title: 'App server',
      message:
        check.status === 'ok'
          ? 'The app is running and ready to use.'
          : MSG_APP_UNAVAILABLE,
      showLatency: false,
      showSourceUrl: false,
    }
  }
  if (name === 'vancouver_opendata') {
    const byStatus: Partial<Record<ServiceCheck['status'], string>> = {
      ok: 'We can load public information published by the city (datasets, maps, and similar).',
      error:
        'City-published information is not available right now. Other parts of the app may still work.',
      not_configured: 'City data is not set up in this environment yet.',
      skipped: 'City data status was not checked.',
    }
    let message = byStatus[check.status] ?? 'Status details are not available.'
    if (check.status === 'ok' && check.latency_ms != null) {
      message = `${describeCityDataLatency(check.latency_ms)} ${message}`
    }
    return {
      title: 'City information',
      message,
      showLatency: false,
      showSourceUrl: false,
    }
  }

  const title = name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return {
    title,
    message: check.message,
    showLatency: check.latency_ms != null,
    showSourceUrl: Boolean(check.health_source_url),
  }
}

function ServiceCheckRow({ name, check }: { name: string; check: ServiceCheck }) {
  const { title, message, showLatency, showSourceUrl } = getRowPresentation(name, check)

  return (
    <div className={`status-check status-check--${check.status}`}>
      <span className="status-check__dot" />
      <div className="status-check__body">
        <div className="status-check__header">
          <span className="status-check__name">{title}</span>
          <span className="status-check__badge">{STATUS_LABEL[check.status] ?? check.status}</span>
        </div>
        {showLatency && check.latency_ms != null && (
          <span className="status-check__latency">{check.latency_ms.toFixed(0)} ms</span>
        )}
        {message && <span className="status-check__msg">{message}</span>}
        {showSourceUrl && check.health_source_url && (
          <span className="status-check__msg status-check__msg--meta">
            Source: {check.health_source_url}
          </span>
        )}
      </div>
    </div>
  )
}
