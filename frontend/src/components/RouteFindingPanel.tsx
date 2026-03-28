import { useCallback, useState } from 'react'
import { findRoute } from '../services/routeService'
import type { RouteFindResult, RouteOption } from '../services/routeService'

interface Props {
  onResult: (result: RouteFindResult, selectedIndex: number) => void
  onSelectRoute: (index: number) => void
  result: RouteFindResult | null
  selectedRouteIndex: number
}

export default function RouteFindingPanel({
  onResult,
  onSelectRoute,
  result,
  selectedRouteIndex,
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
      onResult(res, 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Route request failed.')
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

  return (
    <section className="insight-panel" aria-label="Route finder">
      <h2 className="insight-panel__heading">Route finder</h2>
      <p className="insight-panel__hint">
        Find driving routes avoiding active incidents.
      </p>

      <div className="route-panel__form">
        <label className="route-panel__label" htmlFor="route-origin">
          From
        </label>
        <input
          id="route-origin"
          className="route-panel__input"
          type="text"
          value={origin}
          disabled={loading}
          placeholder="e.g. 1234 Main St, Vancouver"
          onChange={(e) => setOrigin(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <label className="route-panel__label" htmlFor="route-dest">
          To
        </label>
        <input
          id="route-dest"
          className="route-panel__input"
          type="text"
          value={destination}
          disabled={loading}
          placeholder="e.g. Waterfront Station"
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
        <div className="route-panel__error" role="alert">
          {error}
        </div>
      )}

      {result && result.routes.length > 0 && (
        <div className="route-panel__results">
          {result.incidents_avoided.length > 0 && (
            <div className="route-panel__avoided">
              Avoiding {result.incidents_avoided.length} active incident
              {result.incidents_avoided.length > 1 ? 's' : ''}
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
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectRoute(route.index)}
                >
                  <span className="route-panel__card-summary">{route.summary}</span>
                  <span className="route-panel__card-meta">
                    {route.distance_km} km · {route.duration_min} min
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && result.routes.length === 0 && (
        <p className="route-panel__empty">No routes found for these addresses.</p>
      )}
    </section>
  )
}
