import { useEffect, useState, useCallback } from 'react'

interface ServiceCheck {
  status: 'ok' | 'error' | 'not_configured' | 'skipped'
  message: string
  latency_ms?: number
  base_url?: string
  url?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  service: string
  checks: Record<string, ServiceCheck>
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'Operational',
  error: 'Error',
  not_configured: 'Not configured',
  skipped: 'Skipped',
}

const POLL_INTERVAL_MS = 30_000

export default function StatusPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/')
      if (!res.ok && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data: HealthResponse = await res.json()
      setHealth(data)
      setError(null)
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
        <p className="status-panel__loading">Checking services…</p>
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
          {health.status === 'healthy' ? 'All systems operational' :
           health.status === 'degraded' ? 'Degraded' : 'Unhealthy'}
        </span>
      </div>

      {entries.map(([name, check]) => (
        <ServiceCheckRow key={name} name={name} check={check} />
      ))}
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
        <span className="status-check__msg">{check.message}</span>
      </div>
    </div>
  )
}
