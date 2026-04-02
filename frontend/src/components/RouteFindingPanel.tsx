import { useCallback, useState } from 'react'
import { findRoute } from '../services/routeService'
import type { RouteFindResult, RouteOption } from '../services/routeService'

declare function gtag(...args: unknown[]): void

interface Props {
  onResult: (result: RouteFindResult, selectedIndex: number) => void
  onSelectRoute: (index: number) => void
  result: RouteFindResult | null
  selectedRouteIndex: number
  isMobile?: boolean
  onStartNavigation?: () => void
  onStopNavigation?: () => void
  navigationActive?: boolean
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${m} m`
}

export default function RouteFindingPanel({
  onResult,
  onSelectRoute,
  result,
  selectedRouteIndex,
  isMobile = false,
  onStartNavigation,
  onStopNavigation,
  navigationActive = false,
}: Props) {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    const o = origin.trim()
    const d = destination.trim()
    if (!o || !d || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await findRoute(o, d)
      gtag('event', 'route_search', { origin: o, destination: d, routes_found: res.routes.length })
      onResult(res, 0)
    } catch {
      setError('Traffic data temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }, [origin, destination, loading, onResult])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') void submit()
    },
    [submit],
  )

  const selectedRoute: RouteOption | null =
    result?.routes.find((r) => r.index === selectedRouteIndex) ?? result?.routes[0] ?? null

  return (
    <section className="insight-panel route-panel" aria-label="Route finder">
      <h2 className="insight-panel__heading">Route finder</h2>
      <p className="insight-panel__hint">Find driving routes around active incidents.</p>

      <div className="route-panel__form">
        <label className="route-panel__label" htmlFor="route-origin">From</label>
        <input
          id="route-origin"
          className="route-panel__input"
          type="text"
          value={origin}
          disabled={loading}
          placeholder="e.g. Rogers Arena"
          onChange={(e) => setOrigin(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <label className="route-panel__label" htmlFor="route-dest">To</label>
        <input
          id="route-dest"
          className="route-panel__input"
          type="text"
          value={destination}
          disabled={loading}
          placeholder="e.g. Queen Elizabeth Theatre"
          onChange={(e) => setDestination(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="route-panel__submit"
          disabled={loading || !origin.trim() || !destination.trim()}
          onClick={() => void submit()}
        >
          {loading ? 'Finding routes…' : 'Find route'}
        </button>
      </div>

      {error && (
        <div className="route-panel__error" role="alert">{error}</div>
      )}

      {result && result.routes.length > 0 && (
        <>
          {result.incidents_avoided.length > 0 && (
            <div className="route-panel__avoided">
              {result.incidents_avoided.length} active incident{result.incidents_avoided.length > 1 ? 's' : ''} near this route
            </div>
          )}

          <ul className="route-panel__list" role="list">
            {result.routes.map((route: RouteOption) => (
              <li key={route.index}>
                <button
                  type="button"
                  className={[
                    'route-panel__card',
                    route.index === selectedRouteIndex ? 'route-panel__card--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSelectRoute(route.index)}
                >
                  <span className="route-panel__card-summary">{route.summary}</span>
                  <span className="route-panel__card-meta">{route.distance_km} km · {route.duration_min} min</span>
                </button>
              </li>
            ))}
          </ul>

          {selectedRoute && selectedRoute.steps.length > 0 && (
            <div className="route-panel__directions">
              <h3 className="route-panel__directions-heading">Directions</h3>
              {isMobile && (
                <button
                  type="button"
                  className={`route-panel__nav-btn${navigationActive ? ' route-panel__nav-btn--active' : ''}`}
                  onClick={navigationActive ? onStopNavigation : onStartNavigation}
                >
                  {navigationActive ? 'Stop navigation' : 'Start navigation'}
                </button>
              )}
              <ol className="route-panel__steps">
                {selectedRoute.steps.map((step, i) => (
                  <li key={i} className="route-panel__step">
                    <span className="route-panel__step-num">{i + 1}</span>
                    <span className="route-panel__step-body">
                      <span className="route-panel__step-instruction">{step.instruction}</span>
                      {step.distance_m > 0 && (
                        <span className="route-panel__step-dist">{formatDistance(step.distance_m)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {result && result.routes.length === 0 && (
        <p className="route-panel__empty">No routes found for these addresses.</p>
      )}
    </section>
  )
}
