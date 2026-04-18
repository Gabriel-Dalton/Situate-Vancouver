import { useCallback, useEffect, useState } from 'react'
import { findRoute } from '../services/routeService'
import type { RouteFindResult, RouteOption } from '../services/routeService'
import { useRoutes } from '../hooks/useRoutes'

declare function gtag(...args: unknown[]): void

export interface QuickRoute {
  key: number   // increment to re-trigger even for the same origin/destination
  origin: string
  destination: string
}

interface Props {
  onResult: (result: RouteFindResult | null, selectedIndex: number) => void
  onSelectRoute: (index: number) => void
  result: RouteFindResult | null
  selectedRouteIndex: number
  isMobile?: boolean
  onStartNavigation?: () => void
  onStopNavigation?: () => void
  navigationActive?: boolean
  isSignedIn?: boolean
  quickRoute?: QuickRoute | null
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
  isSignedIn = false,
  quickRoute = null,
}: Props) {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [departureTime, setDepartureTime] = useState('08:30')
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [editingRouteName, setEditingRouteName] = useState('')
  const {
    routes: savedRoutes,
    loading: savedRoutesLoading,
    error: savedRoutesError,
    create: createRoute,
    update: updateRoute,
    remove: removeRoute,
  } = useRoutes(isSignedIn)

  // Auto-populate and submit when a quick route is triggered from outside
  useEffect(() => {
    if (!quickRoute) return
    setOrigin(quickRoute.origin)
    setDestination(quickRoute.destination)
    setError(null)
    setLoading(true)
    findRoute(quickRoute.origin, quickRoute.destination)
      .then((res) => onResult(res, 0))
      .catch((err) => setError(err instanceof Error ? err.message : 'Routing unavailable.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickRoute?.key])

  const submit = useCallback(async () => {
    const o = origin.trim()
    const d = destination.trim()
    if (!o || !d || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await findRoute(o, d)
      onResult(res, 0)
      if (typeof gtag !== 'undefined') gtag('event', 'route_search', { origin: o, destination: d, routes_found: res.routes.length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('geocode') || msg.includes('Could not geocode')) {
        setError(`Address not found — try a more specific location (e.g. "Rogers Arena, Vancouver").`)
      } else if (msg.includes('reach route service') || msg.includes('502') || msg.includes('503')) {
        setError('Routing service is temporarily unavailable. Please try again shortly.')
      } else if (msg.includes('timed out') || msg.includes('timeout')) {
        setError('Request timed out — please try again.')
      } else {
        setError(msg || 'Routing is temporarily unavailable. Please try again.')
      }
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

  const saveCurrentRoute = useCallback(async () => {
    if (!isSignedIn || !result) return
    const resolvedName =
      routeName.trim() ||
      `${origin.trim() || result.routes[0]?.summary || 'Route'} to ${destination.trim() || 'Destination'}`
    setSaveLoading(true)
    setSaveError(null)
    setSaveSuccess(null)
    try {
      await createRoute({
        name: resolvedName.slice(0, 100),
        origin_label: origin.trim(),
        origin_lat: result.origin_lat,
        origin_lng: result.origin_lng,
        destination_label: destination.trim(),
        destination_lat: result.dest_lat,
        destination_lng: result.dest_lng,
        departure_time: departureTime,
        active_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        is_active: true,
      })
      setSaveSuccess('Route saved to your account.')
      setRouteName('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save route right now.')
    } finally {
      setSaveLoading(false)
    }
  }, [createRoute, departureTime, destination, isSignedIn, origin, result, routeName])

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

      {result && (
        <button
          type="button"
          className="route-panel__clear"
          onClick={() => onResult(null, 0)}
        >
          Clear route
        </button>
      )}

      {result && result.routes.length > 0 && (
        <>
          {isSignedIn && (
            <div className="route-panel__save-box">
              <h3 className="route-panel__save-heading">Save this route</h3>
              <label className="route-panel__label" htmlFor="route-save-name">Route name</label>
              <input
                id="route-save-name"
                className="route-panel__input"
                type="text"
                value={routeName}
                placeholder="e.g. Morning commute"
                onChange={(e) => setRouteName(e.target.value)}
                maxLength={100}
              />
              <label className="route-panel__label" htmlFor="route-save-time">Departure time</label>
              <input
                id="route-save-time"
                className="route-panel__input"
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
              <button
                type="button"
                className="route-panel__submit"
                onClick={() => void saveCurrentRoute()}
                disabled={saveLoading}
              >
                {saveLoading ? 'Saving…' : 'Save route'}
              </button>
              {saveError && <p className="route-panel__error" role="alert">{saveError}</p>}
              {saveSuccess && <p className="route-panel__success">{saveSuccess}</p>}
            </div>
          )}

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

      {isSignedIn && (
        <section className="route-panel__saved-routes">
          <h3 className="route-panel__directions-heading">My saved routes</h3>
          {savedRoutesLoading && <p className="route-panel__empty">Loading your routes…</p>}
          {savedRoutesError && <p className="route-panel__error">{savedRoutesError}</p>}
          {!savedRoutesLoading && savedRoutes.length === 0 && (
            <p className="route-panel__empty">
              Start onboarding: find a route above, then save it to build your personalized commute feed.
            </p>
          )}
          {savedRoutes.length > 0 && (
            <ul className="route-panel__saved-list" role="list">
              {savedRoutes.map((savedRoute) => (
                <li key={savedRoute.id} className="route-panel__saved-item">
                  <div className="route-panel__saved-main">
                    {editingRouteId === savedRoute.id ? (
                      <input
                        className="route-panel__input"
                        type="text"
                        value={editingRouteName}
                        onChange={(e) => setEditingRouteName(e.target.value)}
                        maxLength={100}
                      />
                    ) : (
                      <p className="route-panel__saved-name">{savedRoute.name}</p>
                    )}
                    <p className="route-panel__saved-meta">
                      {savedRoute.origin_label} to {savedRoute.destination_label} at {savedRoute.departure_time.slice(0, 5)}
                    </p>
                  </div>
                  <div className="route-panel__saved-actions">
                    {editingRouteId === savedRoute.id ? (
                      <>
                        <button
                          type="button"
                          className="route-panel__secondary-btn"
                          onClick={() => {
                            void updateRoute(savedRoute.id, { name: editingRouteName.trim() || savedRoute.name })
                            setEditingRouteId(null)
                            setEditingRouteName('')
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="route-panel__secondary-btn"
                          onClick={() => {
                            setEditingRouteId(null)
                            setEditingRouteName('')
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="route-panel__secondary-btn"
                          onClick={() => {
                            setEditingRouteId(savedRoute.id)
                            setEditingRouteName(savedRoute.name)
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="route-panel__secondary-btn"
                          onClick={() => void updateRoute(savedRoute.id, { is_active: !savedRoute.is_active })}
                        >
                          {savedRoute.is_active ? 'Pause' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="route-panel__secondary-btn route-panel__secondary-btn--danger"
                          onClick={() => void removeRoute(savedRoute.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  )
}
