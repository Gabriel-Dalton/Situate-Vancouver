import { useEffect, useState, useCallback } from 'react'

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

export default function StatusPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/')
      // Always try to parse JSON — backend may return valid health data with 500
      const data: HealthResponse = await res.json()
      setHealth(data)
      setError(null)
      setLastChecked(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach API')
      setHealth(null)
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
        <p className="status-panel__loading">Probing…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="status-panel">
        <div className="status-check status-check--error">
          <span className="status-check__dot" />
          <div className="status-check__body">
            <span className="status-check__name">API</span>
            <span className="status-check__msg">Unreachable — {error}</span>
          </div>
        </div>
      </div>
    )
  }

  if (!health) return null

  const entries = Object.entries(health.checks)

  return (
    <div className="status-panel">
      <div className={`status-panel__overall status-panel__overall--${health.status}`}>
        <span className="status-panel__overall-dot" />
        <span className="status-panel__overall-label">
          {health.status === 'healthy' ? 'All systems nominal' :
           health.status === 'degraded' ? 'Degraded' : 'Unhealthy'}
        </span>
      </div>

      {entries.map(([name, check]) => (
        <ServiceCheckRow key={name} name={name} check={check} />
      ))}

      {lastChecked && (
        <span className="status-panel__timestamp">
          Last probe {lastChecked.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      )}
    </div>
  )
}

function ServiceCheckRow({ name, check }: { name: string; check: ServiceCheck }) {
  const displayName = name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className={`status-check status-check--${check.status}`}>
      <span className="status-check__dot" />
      <div className="status-check__body">
        <div className="status-check__header">
          <span className="status-check__name">{displayName}</span>
          <span className="status-check__badge">{STATUS_LABEL[check.status] ?? check.status}</span>
        </div>
        {check.latency_ms != null && (
          <span className="status-check__latency">{check.latency_ms.toFixed(0)} ms</span>
        )}
        {check.message && (
          <span className="status-check__msg">{check.message}</span>
        )}
        {check.health_source_url && (
          <span className="status-check__msg status-check__msg--meta">
            Source: {check.health_source_url}
          </span>
        )}
      </div>
    </div>
  )
}
