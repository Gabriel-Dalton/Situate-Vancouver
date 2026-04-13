/**
 * Situate Vancouver — insight workspace (map-first). Dev/proxy and health-check context for
 * wiring APIs lives in `src/lib/stackIntegrationNotes.ts` (comments only).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { InsightLayerState, FocusLocation } from './components/VancouverMap'
import LensSelector from './components/LensSelector'
import { SKYTRAIN_LEGEND, SKYTRAIN_LINE_COLORS } from './data/skytrainLineKeys'
import type { MobilityLens } from './types/mobilityLens'
import { MOBILITY_LENS_META } from './types/mobilityLens'
import { useLensOverlay } from './hooks/useLensOverlay'
import { useNavigation } from './hooks/useNavigation'
import { useIsMobile } from './hooks/useIsMobile'
import { useOutages } from './hooks/useOutages'
import { useIncidents } from './hooks/useIncidents'
import { useServiceHealth } from './hooks/useServiceHealth'
import NavigationOverlay from './components/NavigationOverlay'
import BrandLockup from './components/BrandLockup'
import SignInHeader from './components/SignInHeader'
import { AUTH_UI_ENABLED } from './config/authUi'

import { AiQueryBar, AiResponsePanel } from './components/AiQuery'
import type { AiQueryResponse } from './components/AiQuery'
import RouteFindingPanel from './components/RouteFindingPanel'
import ReportIncidentModal from './components/ReportIncidentModal'
import type { RouteFindResult } from './services/routeService'
import './App.css'

const VancouverMap = lazy(() => import('./components/VancouverMap'))

const DEFAULT_LAYERS: InsightLayerState = {
  skytrainNodes: false,
  expoLine: false,
  millenniumLine: false,
  incidentMarker: true,
  buildings: true,
  outages: true,
}

export default function App() {
  const [layers, setLayers] = useState<InsightLayerState>(DEFAULT_LAYERS)
  const [lens, setLens] = useState<MobilityLens>('drive')
  const { data: lensData, loading: lensLoading } = useLensOverlay(lens)
  const { data: outagesData } = useOutages()
  const { incidents: dbIncidents, lastUpdated: incidentsLastUpdated } = useIncidents({ status: 'active' })
  const [aiResponse, setAiResponse] = useState<AiQueryResponse | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [routeResult, setRouteResult] = useState<RouteFindResult | null>(null)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
  const [hiddenIncidentTypes, setHiddenIncidentTypes] = useState<Set<string>>(new Set())
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const serviceHealth = useServiceHealth()

  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTab, setSheetTab] = useState<'layers' | 'route'>('route')
  const isSafariUA = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const isDesktopSafari = isSafariUA && navigator.maxTouchPoints < 1
  const [safariWarningDismissed, setSafariWarningDismissed] = useState(false)
  const selectedRoute = useMemo(
    () => routeResult?.routes.find((r) => r.index === selectedRouteIndex) ?? routeResult?.routes[0] ?? null,
    [routeResult, selectedRouteIndex],
  )
  const { state: navState, start: navStart, stop: navStop } = useNavigation(selectedRoute)

  useEffect(() => {
    /**
     * The language script keeps #ls-bd and #ls-panel inside #ls-root. The map header uses
     * backdrop-filter, which creates a containing block for position:fixed descendants, so
     * the dialog's top:50% becomes half the header height and the panel clips off-screen.
     * Moving the backdrop and dialog to document.body restores viewport-relative centering.
     */
    function portalLangOverlaysToBody() {
      const bd = document.getElementById('ls-bd')
      const panel = document.getElementById('ls-panel')
      if (bd && bd.parentElement !== document.body) document.body.appendChild(bd)
      if (panel && panel.parentElement !== document.body) document.body.appendChild(panel)
    }

    function relocateLangSwitcher() {
      const mount = document.getElementById('situate-lang-mount')
      const root = document.getElementById('ls-root')
      if (!mount || !root) return false
      if (root.parentElement !== mount) {
        root.classList.add('ls-inline')
        mount.appendChild(root)
      }
      portalLangOverlaysToBody()
      return true
    }

    if (relocateLangSwitcher()) return

    const observer = new MutationObserver(() => {
      if (relocateLangSwitcher()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isMobile || !sheetOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('.mobile-sheet')) return
      if (target.closest('.mobile-sheet-toggle')) return
      setSheetOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [isMobile, sheetOpen])

  const toggleLayer = useCallback((key: keyof InsightLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const toggleIncidentType = useCallback((type: string) => {
    setHiddenIncidentTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const handleAiResponse = useCallback((response: AiQueryResponse) => {
    setAiResponse(response)
    setAiPanelOpen(true)
  }, [])

  const closeAiPanel = useCallback(() => {
    setAiPanelOpen(false)
  }, [])

  const handleRouteResult = useCallback((result: RouteFindResult | null, idx: number) => {
    setRouteResult(result)
    setSelectedRouteIndex(idx)
  }, [])

  const focusLocation: FocusLocation = useMemo(() => {
    if (!aiResponse || !aiPanelOpen) return null
    const { lat, lng } = aiResponse.coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (aiResponse.query_type === 'error') return null
    return { lat, lng, label: aiResponse.location }
  }, [aiResponse, aiPanelOpen])

  return (
    <div className="insight-shell">
      {reportModalOpen && <ReportIncidentModal onClose={() => setReportModalOpen(false)} />}
      {isDesktopSafari && !safariWarningDismissed && (
        <div className="safari-warning" role="alert">
          <span>For the best experience, use Chrome or Firefox — Safari has limited WebGL support.</span>
          <button type="button" onClick={() => setSafariWarningDismissed(true)} aria-label="Dismiss">✕</button>
        </div>
      )}
      {navState.active && selectedRoute && (
        <NavigationOverlay state={navState} route={selectedRoute} onStop={navStop} />
      )}
      <header className="insight-shell__header">
        <div className="insight-shell__brand">
          <div className="insight-shell__brand-row">
            <BrandLockup variant="onDark" href="/" />
            <ServiceStatusLights
              django={serviceHealth.django}
              ai={serviceHealth.ai}
              openData={serviceHealth.openData}
            />
          </div>
          <p className="insight-shell__subtitle">City-scale insight canvas <span className="beta-badge">Beta</span></p>
        </div>
        <AiQueryBar onResponse={handleAiResponse} />
        <div className="insight-shell__header-meta">
          <div className="insight-shell__header-meta-row">
            <div id="situate-lang-mount" className="insight-shell__lang" aria-label="Language" />
            <span className="insight-shell__pill">Metro · Lower Mainland</span>
            <span className="insight-shell__clock" aria-live="polite">
              <LiveClock />
            </span>
            {AUTH_UI_ENABLED ? <SignInHeader /> : null}
          </div>
          <button
            type="button"
            className="report-incident-header-link"
            onClick={() => setReportModalOpen(true)}
          >
            + Report an incident
          </button>
        </div>
      </header>

      {aiPanelOpen && (
        <div className="ai-split-view">
          <div className="ai-split-view__map">
            <Suspense
              fallback={
                <div className="map-skeleton" role="status" aria-label="Loading map">
                  <div className="map-skeleton__grid" aria-hidden />
                  <p className="map-skeleton__text">Initializing map canvas…</p>
                </div>
              }
            >
              <VancouverMap
                layers={layers}
                onToggleLayer={toggleLayer}
                lens={lens}
                lensData={lensData}
                outagesData={outagesData}
                incident={aiResponse}
                focusLocation={focusLocation}
                routeResult={routeResult}
                selectedRouteIndex={selectedRouteIndex}
                navigationState={navState}
                hiddenIncidentTypes={hiddenIncidentTypes}
                dbIncidents={dbIncidents}
              />
            </Suspense>
          </div>
          <AiResponsePanel
            response={aiResponse}
            onClose={closeAiPanel}
            visible={aiPanelOpen}
          />
        </div>
      )}

      <div className="insight-shell__body" style={aiPanelOpen ? { display: 'none' } : undefined}>
        {isMobile && !navState.active && (
          <>
            {!sheetOpen && (
              <button
                type="button"
                className="mobile-report-incident-btn"
                onClick={() => setReportModalOpen(true)}
                aria-label="Report an incident"
              >
                Report
              </button>
            )}
            <button
              type="button"
              className={`mobile-sheet-toggle${sheetOpen ? ' mobile-sheet-toggle--open' : ''}`}
              onClick={() => setSheetOpen((o) => (o ? false : true))}
              aria-label={sheetOpen ? 'Close panel' : 'Open panel'}
            >
              {sheetOpen ? '✕' : '☰'}
            </button>
          </>
        )}

        <main className="insight-shell__map-wrap">
          <Suspense
            fallback={
              <div className="map-skeleton" role="status" aria-label="Loading map">
                <div className="map-skeleton__grid" aria-hidden />
                <p className="map-skeleton__text">Initializing map canvas…</p>
              </div>
            }
          >
            <VancouverMap
              layers={layers}
              onToggleLayer={toggleLayer}
              lens={lens}
              lensData={lensData}
              outagesData={outagesData}
              incident={aiResponse}
              focusLocation={focusLocation}
              routeResult={routeResult}
              selectedRouteIndex={selectedRouteIndex}
              navigationState={navState}
              dbIncidents={dbIncidents}
              hiddenIncidentTypes={hiddenIncidentTypes}
            />
          </Suspense>
        </main>

        {/* mobile-sheet is display:contents on desktop (invisible to the grid),
            and a slide-up bottom drawer on mobile */}
        <div className={`mobile-sheet${sheetOpen ? ' mobile-sheet--open' : ''}`}>
          {isMobile && (
            <div className="mobile-sheet-tabs-wrap">
              <button
                type="button"
                className="mobile-sheet-handle"
                aria-label="Close panel"
                onClick={() => setSheetOpen(false)}
              />
              <div className="mobile-sheet-tabs">
                <button
                  type="button"
                  className="mobile-sheet-report-btn"
                  onClick={() => setReportModalOpen(true)}
                >
                  Report
                </button>
                <button
                  type="button"
                  className={`mobile-sheet-tab${sheetTab === 'route' ? ' mobile-sheet-tab--active' : ''}`}
                  onClick={() => setSheetTab('route')}
                >Route finder</button>
                <button
                  type="button"
                  className={`mobile-sheet-tab${sheetTab === 'layers' ? ' mobile-sheet-tab--active' : ''}`}
                  onClick={() => setSheetTab('layers')}
                >Layers</button>
              </div>
            </div>
          )}
          <aside className="insight-shell__rail insight-shell__rail--left" aria-label="Layers and scope" style={isMobile && sheetTab !== 'layers' ? { display: 'none' } : undefined}>
            <section className="insight-panel">
              <h2 className="insight-panel__heading">Mobility lens</h2>
              <p className="insight-panel__hint">
                Switch mode to filter the map context for your journey type.
              </p>
              <LensSelector active={lens} onSelect={setLens} />
              {lensLoading && (
                <p className="insight-panel__hint" style={{ marginTop: '0.5rem', opacity: 0.6 }}>
                  {`Loading ${MOBILITY_LENS_META[lens].label.toLowerCase()} overlay…`}
                </p>
              )}
              {!lensLoading && lens !== 'drive' && (
                <p className="insight-panel__hint" style={{ marginTop: '0.5rem', opacity: 0.6 }}>
                  {`${MOBILITY_LENS_META[lens].label} overlay — ${lensData.features.length} features loaded`}
                </p>
              )}

            </section>

            <section className="insight-panel">
              <Collapsible
                title="Live incidents"
                subtitle={incidentsLastUpdated ? `Updated ${incidentsLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined}
                defaultOpen={true}
              >
                <ul className="traffic-legend__list">
                  {([
                    { type: 'construction',    color: '#fb923c', label: 'Construction' },
                    { type: 'traffic',         color: '#f43f5e', label: 'Traffic' },
                    { type: 'accident',        color: '#f87171', label: 'Accident' },
                    { type: 'obstruction',     color: '#94a3b8', label: 'Obstruction' },
                    { type: 'weather',         color: '#a78bfa', label: 'Weather' },
                    { type: 'natural_disaster', color: '#ff6b35', label: 'Wildfire' },
                    { type: 'earthquake',       color: '#e879f9', label: 'Earthquake' },
                    { type: 'border_wait',      color: '#06b6d4', label: 'Border Wait' },
                  ] as const).map(({ type, color, label }) => {
                    const hidden = hiddenIncidentTypes.has(type)
                    return (
                      <li key={type} className="traffic-legend__item">
                        <button
                          type="button"
                          className="incident-legend-dot"
                          title={hidden ? `Show ${label}` : `Hide ${label}`}
                          onClick={() => toggleIncidentType(type)}
                          style={{
                            background: color,
                            opacity: hidden ? 0.25 : 1,
                          }}
                        />
                        <span style={{ opacity: hidden ? 0.45 : 1 }}>{label}</span>
                      </li>
                    )
                  })}
                </ul>
              </Collapsible>

              <Collapsible title="Map layers">
                <LayerToggle
                  id="layer-buildings"
                  label="3D buildings"
                  description="Extruded building footprints from OpenStreetMap"
                  checked={layers.buildings}
                  onChange={() => toggleLayer('buildings')}
                />
                <LayerToggle
                  id="layer-skytrain"
                  label="SkyTrain stations"
                  description="Expo, Millennium, and Canada Line stops"
                  checked={layers.skytrainNodes}
                  onChange={() => toggleLayer('skytrainNodes')}
                />
                {layers.skytrainNodes && (
                  <div className="layer-sub-toggles">
                    <LayerToggle
                      id="layer-expo"
                      label="Expo Line"
                      description=""
                      checked={layers.expoLine}
                      onChange={() => toggleLayer('expoLine')}
                    />
                    <LayerToggle
                      id="layer-millennium"
                      label="Millennium Line"
                      description=""
                      checked={layers.millenniumLine}
                      onChange={() => toggleLayer('millenniumLine')}
                    />
                  </div>
                )}
                <LayerToggle
                  id="layer-incident"
                  label="AI incident marker"
                  description="Location pin from the last AI query"
                  checked={layers.incidentMarker}
                  onChange={() => toggleLayer('incidentMarker')}
                />
                <LayerToggle
                  id="layer-outages"
                  label="Power outages"
                  description="Live BC Hydro outages · refreshes every 15 min"
                  checked={layers.outages}
                  onChange={() => toggleLayer('outages')}
                />
              </Collapsible>

              {lens === 'drive' && (
                <Collapsible title="Traffic flow" defaultOpen={true}>
                  <ul className="traffic-legend__list">
                    <li className="traffic-legend__item">
                      <span className="traffic-legend__swatch" style={{ background: '#4ade80' }} />
                      <span>Free flow</span>
                    </li>
                    <li className="traffic-legend__item">
                      <span className="traffic-legend__swatch" style={{ background: '#facc15' }} />
                      <span>Moderate</span>
                    </li>
                    <li className="traffic-legend__item">
                      <span className="traffic-legend__swatch" style={{ background: '#fb923c' }} />
                      <span>Heavy</span>
                    </li>
                    <li className="traffic-legend__item">
                      <span className="traffic-legend__swatch" style={{ background: '#f87171' }} />
                      <span>Standstill</span>
                    </li>
                  </ul>
                </Collapsible>
              )}
              <div className="skytrain-legend" role="region" aria-label="SkyTrain line colors">
                {SKYTRAIN_LEGEND.map(({ key, shortLabel }) => (
                  <span key={key} className="skytrain-legend__item">
                    <span
                      className="skytrain-legend__swatch"
                      style={{ background: SKYTRAIN_LINE_COLORS[key] }}
                    />
                    <span className="skytrain-legend__label">{shortLabel}</span>
                  </span>
                ))}
              </div>
            </section>
          </aside>

          <aside className="insight-shell__rail insight-shell__rail--right" aria-label="Signals" style={isMobile && sheetTab !== 'route' ? { display: 'none' } : undefined}>
            <RouteFindingPanel
              onResult={handleRouteResult}
              onSelectRoute={setSelectedRouteIndex}
              result={routeResult}
              selectedRouteIndex={selectedRouteIndex}
              isMobile={isMobile}
              onStartNavigation={navStart}
              onStopNavigation={navStop}
              navigationActive={navState.active}
            />
          </aside>
        </div>{/* end .mobile-sheet */}
      </div>
    </div>
  )
}

function ServiceStatusLights({
  django,
  ai,
  openData,
}: {
  django: string
  ai: string
  openData: string
}) {
  const lights = [
    { key: 'django', label: 'App API', status: django },
    { key: 'ai', label: 'AI service', status: ai },
    { key: 'openData', label: 'Open data API', status: openData },
  ] as const
  return (
    <span className="service-status-lights" aria-label="Service status">
      {lights.map(({ key, label, status }) => (
        <span
          key={key}
          className={`service-status-light service-status-light--${status}`}
          title={`${label}: ${status === 'checking' ? 'checking…' : status}`}
        />
      ))}
    </span>
  )
}

function LayerToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="layer-toggle" htmlFor={id}>
      <input id={id} className="layer-toggle__input" type="checkbox" checked={checked} onChange={onChange} />
      <span className="layer-toggle__ui" aria-hidden />
      <span className="layer-toggle__copy">
        <span className="layer-toggle__label">{label}</span>
        <span className="layer-toggle__desc">{description}</span>
      </span>
    </label>
  )
}


function Collapsible({ title, subtitle, children, defaultOpen = true }: { title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="collapsible">
      <button type="button" className="collapsible__header" onClick={() => setOpen(o => !o)}>
        <span className="collapsible__title-group">
          <span>{title}</span>
          {subtitle && <span className="collapsible__subtitle">{subtitle}</span>}
        </span>
        <span className={`collapsible__chevron${open ? ' collapsible__chevron--open' : ''}`}>›</span>
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </div>
  )
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <>
      {formatClock(now)} <span className="insight-shell__tz">{getTimezone(now)}</span>
    </>
  )
}

function formatClock(d: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return d.toLocaleTimeString()
  }
}

function getTimezone(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(d)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}
