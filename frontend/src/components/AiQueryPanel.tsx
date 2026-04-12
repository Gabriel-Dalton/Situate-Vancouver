import { useCallback, useState } from 'react'

declare function gtag(...args: unknown[]): void

interface QueryCoordinates {
  lat: number
  lng: number
}

/** Subset of FastAPI `QueryResponse` returned via Django `POST /api/query/`. */
interface AiQueryResponse {
  original_query: string
  query_type: string
  verdict: string
  severity: string
  location: string
  coordinates: QueryCoordinates
  cause: string
  impact: string
  recommended_actions: string[]
  estimated_duration: string
  related_alerts: string[]
  cache_hit?: boolean
  confidence?: number
  data_sources?: string[]
}

/**
 * Browser URL for `POST /api/query/`. Dev: same-origin `/api/query/` (Vite → Django).
 * Prod build: baked from `API_PROXY_TARGET` / `DJANGO_DEV_*` like aggregate health.
 * Override with `VITE_QUERY_URL` when the static app and API use different hosts.
 */
function queryEndpointUrl(): string {
  const fromEnv = import.meta.env.VITE_QUERY_URL as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim()
  if (import.meta.env.DEV) return '/api/query/'
  return __SITUATE_PROD_QUERY_URL__
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function parseAiPayload(data: unknown): AiQueryResponse | null {
  if (!isRecord(data)) return null
  const coords = data.coordinates
  if (!isRecord(coords)) return null
  const lat = coords.lat
  const lng = coords.lng
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  const verdict = data.verdict
  const original_query = data.original_query
  if (typeof verdict !== 'string' || typeof original_query !== 'string') return null
  return data as unknown as AiQueryResponse
}


function severityClass(sev: string): string {
  const s = sev.toLowerCase()
  if (s === 'critical' || s === 'high') return 'ai-query-panel__sev ai-query-panel__sev--high'
  if (s === 'medium') return 'ai-query-panel__sev ai-query-panel__sev--medium'
  return 'ai-query-panel__sev ai-query-panel__sev--low'
}

export default function AiQueryPanel() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AiQueryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    const q = text.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    const url = queryEndpointUrl()
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      let payload: unknown
      try {
        payload = await res.json()
      } catch {
        payload = { detail: res.statusText || `HTTP ${res.status}` }
      }
      if (!res.ok) {
        setError('Traffic data temporarily unavailable.')
        return
      }
      const parsed = parseAiPayload(payload)
      if (!parsed) {
        setError('Traffic data temporarily unavailable.')
        return
      }
      setResult(parsed)
      if (typeof gtag !== 'undefined') gtag('event', 'ai_query', { query: q, query_type: parsed.query_type, severity: parsed.severity, cache_hit: parsed.cache_hit })
    } catch {
      setError('Traffic data temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }, [text, loading])

  return (
    <section className="insight-panel" aria-label="Natural language city query">
      <h2 className="insight-panel__heading">AI analysis</h2>
      <p className="insight-panel__hint">
        Ask about Vancouver conditions. Answers come from the AI service via Django{' '}
        <code className="ai-query-panel__code">POST /api/query/</code>.
      </p>
      <div className="ai-query-panel__form">
        <label className="ai-query-panel__label" htmlFor="ai-query-input">
          Your question
        </label>
        <textarea
          id="ai-query-input"
          className="ai-query-panel__input"
          rows={3}
          value={text}
          disabled={loading}
          placeholder="e.g. How busy is downtown Vancouver right now?"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void submit()
            }
          }}
        />
        <button
          type="button"
          className="ai-query-panel__submit"
          disabled={loading || !text.trim()}
          onClick={() => void submit()}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        <span className="ai-query-panel__kbd-hint">⌘/Ctrl + Enter to submit</span>
      </div>

      {error && (
        <div className="ai-query-panel__error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="ai-query-panel__result">
          <p className="ai-query-panel__q">{result.original_query}</p>
          <div className="ai-query-panel__tags">
            <span className={severityClass(result.severity)}>{result.severity} severity</span>
            <span className="ai-query-panel__tag">{result.query_type}</span>
            {result.cache_hit === true && <span className="ai-query-panel__tag">cached</span>}
          </div>
          <p className="ai-query-panel__verdict">{result.verdict}</p>
          <dl className="ai-query-panel__dl">
            <dt>Location</dt>
            <dd>
              {result.location || '—'}
              <span className="ai-query-panel__coords">
                {result.coordinates.lat.toFixed(4)}, {result.coordinates.lng.toFixed(4)}
              </span>
            </dd>
            <dt>Cause</dt>
            <dd>{result.cause}</dd>
            <dt>Impact</dt>
            <dd>{result.impact}</dd>
            {result.estimated_duration ? (
              <>
                <dt>Duration</dt>
                <dd>{result.estimated_duration}</dd>
              </>
            ) : null}
          </dl>
          {(result.recommended_actions ?? []).length > 0 && (
            <>
              <h3 className="ai-query-panel__sub">Recommended actions</h3>
              <ul className="ai-query-panel__list">
                {(result.recommended_actions ?? []).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}
          {(result.related_alerts ?? []).length > 0 && (
            <>
              <h3 className="ai-query-panel__sub">Related alerts</h3>
              <ul className="ai-query-panel__list">
                {(result.related_alerts ?? []).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}
          {(result.data_sources ?? []).length > 0 && (
            <p className="ai-query-panel__sources">
              Source: {result.data_sources!.join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
