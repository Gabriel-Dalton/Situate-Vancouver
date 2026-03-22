import { useCallback, useEffect, useState } from 'react'
import './App.css'

type ProbePhase = 'loading' | 'done'

type ProbeResult = {
  phase: ProbePhase
  ok: boolean
  latencyMs: number | null
  checkedAt: number | null
  httpStatus: number | null
  summary: string
  detail: string | null
  payload: Record<string, unknown> | null
}

function loadingProbe(): ProbeResult {
  return {
    phase: 'loading',
    ok: false,
    latencyMs: null,
    checkedAt: null,
    httpStatus: null,
    summary: 'Probing',
    detail: null,
    payload: null,
  }
}

async function probeHealth(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  const t0 = performance.now()
  try {
    const res = await fetch(url, { signal })
    const latencyMs = Math.round(performance.now() - t0)
    const checkedAt = Date.now()
    const text = await res.text()
    let payload: Record<string, unknown> | null = null
    let parseError: string | null = null

    if (text) {
      try {
        const parsed: unknown = JSON.parse(text)
        payload =
          parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : { value: parsed }
      } catch {
        parseError = 'Response is not valid JSON.'
      }
    }

    if (!res.ok) {
      return {
        phase: 'done',
        ok: false,
        latencyMs,
        checkedAt,
        httpStatus: res.status,
        summary: `HTTP ${res.status}`,
        detail: parseError ?? (text.slice(0, 480) || null),
        payload,
      }
    }

    if (parseError) {
      return {
        phase: 'done',
        ok: false,
        latencyMs,
        checkedAt,
        httpStatus: res.status,
        summary: 'Invalid JSON',
        detail: parseError,
        payload: null,
      }
    }

    const statusField = payload?.status
    const degraded =
      typeof statusField === 'string' && !['ok', 'healthy', 'up'].includes(statusField.toLowerCase())

    return {
      phase: 'done',
      ok: !degraded,
      latencyMs,
      checkedAt,
      httpStatus: res.status,
      summary: degraded ? String(statusField) : 'Operational',
      detail: degraded ? JSON.stringify(payload, null, 2) : null,
      payload,
    }
  } catch (e) {
    const latencyMs = Math.round(performance.now() - t0)
    const checkedAt = Date.now()
    const name = e instanceof Error ? e.name : 'Error'
    const message = e instanceof Error ? e.message : String(e)
    const aborted = e instanceof DOMException && e.name === 'AbortError'
    return {
      phase: 'done',
      ok: false,
      latencyMs: aborted ? null : latencyMs,
      checkedAt,
      httpStatus: null,
      summary: aborted ? 'Cancelled' : 'Unreachable',
      detail: aborted ? null : `${name}: ${message}`,
      payload: null,
    }
  }
}

function formatTime(ts: number | null): string {
  if (ts == null) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleTimeString()
  }
}

type ServiceCardProps = {
  name: string
  role: string
  path: string
  result: ProbeResult
}

function ServiceCard({ name, role, path, result }: ServiceCardProps) {
  const loading = result.phase === 'loading'
  const statusClass =
    loading ? 'is-loading' : result.ok ? 'is-ok' : result.summary === 'Cancelled' ? 'is-muted' : 'is-bad'

  return (
    <article className="svc-card" aria-busy={loading}>
      <header className="svc-card__head">
        <div className="svc-card__titles">
          <h2 className="svc-card__name">{name}</h2>
          <p className="svc-card__role">{role}</p>
        </div>
        <div className={`svc-card__pip ${statusClass}`} title={loading ? 'Checking' : result.summary}>
          <span className="svc-card__pip-dot" />
        </div>
      </header>

      <div className="svc-card__endpoint">
        <span className="svc-card__method">GET</span>
        <code className="svc-card__path">{path}</code>
      </div>

      <dl className="svc-card__metrics">
        <div>
          <dt>State</dt>
          <dd>{loading ? 'Probing…' : result.summary}</dd>
        </div>
        <div>
          <dt>Latency</dt>
          <dd>{result.latencyMs != null ? `${result.latencyMs} ms` : '—'}</dd>
        </div>
        <div>
          <dt>HTTP</dt>
          <dd>{result.httpStatus ?? '—'}</dd>
        </div>
        <div>
          <dt>Checked</dt>
          <dd>{formatTime(result.checkedAt)}</dd>
        </div>
      </dl>

      {!loading && !result.ok && result.detail && (
        <div className="svc-card__issue">
          <span className="svc-card__issue-label">Signal</span>
          <pre className="svc-card__issue-body">{result.detail}</pre>
        </div>
      )}

      {!loading && result.ok && result.payload && (
        <div className="svc-card__payload">
          <span className="svc-card__payload-label">Payload</span>
          <pre className="svc-card__payload-body">{JSON.stringify(result.payload, null, 2)}</pre>
        </div>
      )}

      {!loading && !result.ok && (
        <details className="svc-card__technical">
          <summary>Technical context</summary>
          <ul>
            <li>
              Browser calls <code>{path}</code>; Vite proxies to your local API ports (see README).
            </li>
            <li>
              If this shows “Unreachable”, the target process is likely down or the proxy target env vars
              do not match your setup.
            </li>
          </ul>
        </details>
      )}
    </article>
  )
}

function App() {
  const [django, setDjango] = useState<ProbeResult>(loadingProbe)
  const [ai, setAi] = useState<ProbeResult>(loadingProbe)
  const [tick, setTick] = useState(0)

  const runProbes = useCallback(async (signal: AbortSignal) => {
    setDjango((s) => ({ ...s, phase: 'loading' }))
    setAi((s) => ({ ...s, phase: 'loading' }))

    const [d, a] = await Promise.all([
      probeHealth('/api/health/', signal),
      probeHealth('/ai/health', signal),
    ])

    if (!signal.aborted) {
      setDjango(d)
      setAi(a)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    runProbes(ac.signal)
    return () => ac.abort()
  }, [runProbes, tick])

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15000)
    return () => window.clearInterval(id)
  }, [])

  const refresh = () => setTick((n) => n + 1)

  const anyLoading = django.phase === 'loading' || ai.phase === 'loading'
  const allOk = django.phase === 'done' && ai.phase === 'done' && django.ok && ai.ok

  return (
    <div className="ops">
      <div className="ops__grid" aria-hidden />

      <header className="ops__topbar">
        <div className="ops__brand">
          <span className="ops__brand-mark" aria-hidden />
          <div>
            <span className="ops__brand-name">Situate Vancouver</span>
            <span className="ops__brand-tag">Operations</span>
          </div>
        </div>
        <div className="ops__topbar-actions">
          <span className={`ops__fleet ${allOk ? 'ops__fleet--ok' : ''}`} role="status">
            {anyLoading ? 'Scanning…' : allOk ? 'All services nominal' : 'Attention required'}
          </span>
          <button type="button" className="ops__btn" onClick={refresh} disabled={anyLoading}>
            Refresh
          </button>
        </div>
      </header>

      <main className="ops__main">
        <section className="ops__hero" aria-labelledby="ops-title">
          <p className="ops__eyebrow">Stack health</p>
          <h1 id="ops-title" className="ops__title">
            Integration transparency
          </h1>
          <p className="ops__lede">
            Live probes against Django and the AI service through the Vite dev proxy. When APIs are wired,
            status, latency, and payloads stay visible here.
          </p>
        </section>

        <section className="ops__cards" aria-label="Service endpoints">
          <ServiceCard
            name="Django API"
            role="Core platform · proxied /api → :8000"
            path="/api/health/"
            result={django}
          />
          <ServiceCard
            name="AI service"
            role="FastAPI · proxied /ai → :8001"
            path="/ai/health"
            result={ai}
          />
        </section>

        <section className="ops__infra" aria-label="Expected local topology">
          <h2 className="ops__infra-title">Expected topology (local)</h2>
          <div className="ops__infra-grid">
            <div className="ops__infra-cell">
              <span className="ops__infra-k">Django</span>
              <span className="ops__infra-v">127.0.0.1:8000</span>
            </div>
            <div className="ops__infra-cell">
              <span className="ops__infra-k">FastAPI</span>
              <span className="ops__infra-v">127.0.0.1:8001</span>
            </div>
            <div className="ops__infra-cell">
              <span className="ops__infra-k">Frontend</span>
              <span className="ops__infra-v">Vite (this host)</span>
            </div>
            <div className="ops__infra-cell ops__infra-cell--wide">
              <span className="ops__infra-k">Proxy overrides</span>
              <span className="ops__infra-v mono">
                API_PROXY_TARGET, AI_PROXY_TARGET
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="ops__foot">
        <span>Situate stack · Django + FastAPI + Vite</span>
        <span className="ops__foot-muted">Auto-refresh every 15s</span>
      </footer>
    </div>
  )
}

export default App
