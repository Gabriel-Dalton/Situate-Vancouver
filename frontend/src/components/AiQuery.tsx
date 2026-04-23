import { useCallback, useRef, useState, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import { apiUrl } from '../lib/api'
import { authTokens } from '../services/api'
import './AiQuery.css'

export interface AiQueryResponse {
  original_query: string
  query_type: string
  verdict: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  location: string
  coordinates: { lat: number; lng: number }
  cause: string
  impact: string
  recommended_actions: string[]
  estimated_duration: string
  related_alerts: string[]
  cache_hit: boolean
  confidence: number
}

export type ZoomLocation = { lat: number; lng: number; label: string }

interface AiQueryBarProps {
  onResponse: (response: AiQueryResponse) => void
  onZoom?: (loc: ZoomLocation) => void
}

const PLACEHOLDER_QUERIES = [
  'Is there construction on Oak Street?',
  'How busy is the Broadway corridor?',
  'Any road closures near Stanley Park?',
  'Transit delays on the Canada Line?',
]

function buildErrorResponse(query: string, detail: string): AiQueryResponse {
  return {
    original_query: query,
    query_type: 'error',
    verdict: detail,
    severity: 'low',
    location: 'N/A',
    coordinates: { lat: 49.2827, lng: -123.1207 },
    cause: detail,
    impact: 'The query could not be processed right now.',
    recommended_actions: [
      'Make sure the Django backend is running on the expected port',
      'Ensure the AI service (FastAPI) is running and reachable',
      'Check the terminal/logs for error details',
    ],
    estimated_duration: 'Retry in a few moments',
    related_alerts: [],
    cache_hit: false,
    confidence: 0,
  }
}

const ZOOM_PREFIX_RE = /^(?:go\s+to|zoom\s+to|navigate\s+to|take\s+me\s+to|show\s+me|find|where\s+is|where's)\s+/i
// Matches "street and street" intersection queries (no verb prefix required)
const INTERSECTION_RE = /^[\w\s'-]+\s+and\s+[\w\s'-]+$/i

async function geocodePlace(place: string): Promise<ZoomLocation | null> {
  try {
    const params = new URLSearchParams({
      q: `${place}, Vancouver, BC`,
      format: 'json',
      limit: '1',
      countrycodes: 'ca',
      viewbox: '-123.5,49.0,-122.5,49.6',
      bounded: '1',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'SituateVancouver/1.0' },
    })
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name }
  } catch {
    return null
  }
}

export function AiQueryBar({ onResponse, onZoom }: AiQueryBarProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDER_QUERIES.length)
    }, 4000)
    return () => clearInterval(id)
  }, [])

  const submit = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed || loading) return

    const zoomMatch = trimmed.match(ZOOM_PREFIX_RE)
    const intersectionMatch = !zoomMatch && INTERSECTION_RE.test(trimmed)
    if ((zoomMatch || intersectionMatch) && onZoom) {
      const place = zoomMatch ? trimmed.slice(zoomMatch[0].length).trim() : trimmed
      setLoading(true)
      const loc = await geocodePlace(place)
      setLoading(false)
      if (loc) {
        onZoom(loc)
        setQuery('')
      } else {
        onResponse(buildErrorResponse(trimmed, `Could not find "${place}" on the map.`))
        setQuery('')
      }
      return
    }

    setLoading(true)
    try {
      const token = authTokens.getAccess()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(apiUrl('/api/query/'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ query: trimmed }),
      })

      let data: Record<string, unknown> | null = null
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        try { data = await res.json() } catch { /* non-parseable JSON */ }
      }

      if (res.ok && data && data.original_query) {
        onResponse(data as unknown as AiQueryResponse)
        setQuery('')
        return
      }

      const detail = data
        ? String(data.detail || data.error || `Server returned ${res.status}`)
        : `Server returned ${res.status} (${res.statusText})`
      onResponse(buildErrorResponse(trimmed, detail))
      setQuery('')
    } catch {
      onResponse(buildErrorResponse(
        trimmed,
        'Could not reach the backend. Make sure Django is running and the AI service is connected.',
      ))
      setQuery('')
    } finally {
      setLoading(false)
    }
  }, [query, loading, onResponse])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  return (
    <div className="ai-query-bar">
      <button
        className="ai-query-bar__icon-btn"
        onClick={() => inputRef.current?.focus()}
        aria-label="Analyse data"
        type="button"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      <input
        ref={inputRef}
        className="ai-query-bar__input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKey}
        placeholder={PLACEHOLDER_QUERIES[placeholderIdx]}
        aria-label="Ask a question about Vancouver"
        disabled={loading}
      />
      <button
        className="ai-query-bar__submit"
        onClick={submit}
        disabled={!query.trim() || loading}
        type="button"
      >
        {loading ? (
          <span className="ai-query-bar__spinner" />
        ) : (
          <>
            <span className="ai-query-bar__submit-label">Analyse</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </>
        )}
      </button>
    </div>
  )
}

/* ---------- Response Panel ---------- */

interface AiResponsePanelProps {
  response: AiQueryResponse | null
  onClose: () => void
  visible: boolean
}

const SEVERITY_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  low: { label: 'Low', color: 'var(--ok)', bg: 'var(--ok-bg)' },
  medium: { label: 'Medium', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  high: { label: 'High', color: 'var(--danger)', bg: 'var(--danger-bg)' },
  critical: {
    label: 'Critical',
    color: '#ff3b3b',
    bg: 'rgba(255, 59, 59, 0.15)',
  },
}

export function AiResponsePanel({
  response,
  onClose,
  visible,
}: AiResponsePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [visible, onClose])

  useEffect(() => {
    if (visible && panelRef.current) {
      panelRef.current.focus()
    }
  }, [visible])

  if (!response || !visible) return null

  const sev = SEVERITY_META[response.severity] ?? SEVERITY_META.low
  const confidencePct = Math.round(response.confidence * 100)

  return (
      <aside
        className="ai-response-panel"
        ref={panelRef}
        role="region"
        aria-label="AI Analysis Result"
        tabIndex={-1}
      >
        <header className="ai-response-panel__header">
          <div className="ai-response-panel__header-left">
            <svg
              className="ai-response-panel__ai-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--data-cyan)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a4 4 0 0 0-4 4v2H6a4 4 0 0 0-4 4v0a4 4 0 0 0 4 4h1l1 4h8l1-4h1a4 4 0 0 0 4-4v0a4 4 0 0 0-4-4h-2V6a4 4 0 0 0-4-4Z" />
              <circle cx="9" cy="12" r="1" fill="var(--data-cyan)" stroke="none" />
              <circle cx="15" cy="12" r="1" fill="var(--data-cyan)" stroke="none" />
            </svg>
            <span className="ai-response-panel__title">AI Analysis</span>
          </div>
          <button
            className="ai-response-panel__close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <div className="ai-response-panel__body">
          {/* User query echo */}
          <div className="ai-chat__user">
            <span className="ai-chat__user-label">You asked</span>
            <p className="ai-chat__user-query">{response.original_query}</p>
          </div>

          {/* Verdict */}
          <div className="ai-chat__assistant">
            <p className="ai-chat__verdict">{response.verdict}</p>
          </div>

          {/* Metadata row */}
          <div className="ai-meta-row">
            <span
              className="ai-meta-row__severity"
              style={{ color: sev.color, background: sev.bg }}
            >
              {sev.label} severity
            </span>
            <span className="ai-meta-row__type">{response.query_type}</span>
            {response.confidence > 0 && (
              <span className="ai-meta-row__confidence">
                <span
                  className="ai-meta-row__confidence-bar"
                  style={{ width: `${confidencePct}%` }}
                />
                {confidencePct}% confidence
              </span>
            )}
            {response.cache_hit && (
              <span className="ai-meta-row__cache">cached</span>
            )}
          </div>

          {/* Location */}
          <section className="ai-section">
            <h3 className="ai-section__heading">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Location
            </h3>
            <p className="ai-section__text">{response.location}</p>
            <span className="ai-section__coords">
              {response.coordinates.lat.toFixed(4)}, {response.coordinates.lng.toFixed(4)}
            </span>
          </section>

          {/* Cause */}
          <section className="ai-section">
            <h3 className="ai-section__heading">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              Cause
            </h3>
            <p className="ai-section__text">{response.cause}</p>
          </section>

          {/* Impact */}
          <section className="ai-section">
            <h3 className="ai-section__heading">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20h.01" />
                <path d="M7 20v-4" />
                <path d="M12 20v-8" />
                <path d="M17 20V8" />
                <path d="M22 4v16" />
              </svg>
              Impact
            </h3>
            <p className="ai-section__text">{response.impact}</p>
          </section>

          {/* Recommended actions */}
          {response.recommended_actions.length > 0 && (
            <section className="ai-section">
              <h3 className="ai-section__heading">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
                Recommended Actions
              </h3>
              <ul className="ai-actions-list">
                {response.recommended_actions.map((action, i) => (
                  <li key={i} className="ai-actions-list__item">
                    <span className="ai-actions-list__num">{i + 1}</span>
                    {action}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Duration */}
          <section className="ai-section">
            <h3 className="ai-section__heading">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Estimated Duration
            </h3>
            <p className="ai-section__text">{response.estimated_duration}</p>
          </section>

          {/* Related alerts */}
          {response.related_alerts.length > 0 && (
            <section className="ai-section ai-section--alerts">
              <h3 className="ai-section__heading">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                Related Alerts
              </h3>
              {response.related_alerts.map((alert, i) => (
                <p key={i} className="ai-section__alert">{alert}</p>
              ))}
            </section>
          )}
        </div>
      </aside>
  )
}
