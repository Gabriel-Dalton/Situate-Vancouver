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
import BrandLockup from './components/BrandLockup'
import SignInHeader from './components/SignInHeader'
import { AUTH_UI_ENABLED } from './config/authUi'
import StatusPanel from './components/StatusPanel'
import { AiQueryBar, AiResponsePanel } from './components/AiQuery'
import type { AiQueryResponse } from './components/AiQuery'
import RouteFindingPanel from './components/RouteFindingPanel'
import type { RouteFindResult } from './services/routeService'
import './App.css'

const VancouverMap = lazy(() => import('./components/VancouverMap'))

const DEFAULT_LAYERS: InsightLayerState = {
  skytrainNodes: true,
  incidentMarker: true,
}

export default function App() {
  const [layers, setLayers] = useState<InsightLayerState>(DEFAULT_LAYERS)
  const [lens, setLens] = useState<MobilityLens>('cycle')
  const { data: lensData, loading: lensLoading } = useLensOverlay(lens)
  const [aiResponse, setAiResponse] = useState<AiQueryResponse | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [routeResult, setRouteResult] = useState<RouteFindResult | null>(null)
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)

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

  const toggleLayer = useCallback((key: keyof InsightLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleAiResponse = useCallback((response: AiQueryResponse) => {
    setAiResponse(response)
    setAiPanelOpen(true)
  }, [])

  const closeAiPanel = useCallback(() => {
    setAiPanelOpen(false)
  }, [])

  const handleRouteResult = useCallback((result: RouteFindResult, idx: number) => {
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
      <header className="insight-shell__header">
        <div className="insight-shell__brand">
          <BrandLockup variant="onDark" href="/" />
          <p className="insight-shell__subtitle">City-scale insight canvas</p>
        </div>
        <AiQueryBar onResponse={handleAiResponse} />
        <div className="insight-shell__header-meta">
          <div id="situate-lang-mount" className="insight-shell__lang" aria-label="Language" />
          <span className="insight-shell__pill">Metro · Lower Mainland</span>
          <span className="insight-shell__clock" aria-live="polite">
            <LiveClock />
          </span>
          {AUTH_UI_ENABLED ? <SignInHeader /> : null}
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
                incident={aiResponse}
                focusLocation={focusLocation}
                routeResult={routeResult}
                selectedRouteIndex={selectedRouteIndex}
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
        <aside className="insight-shell__rail insight-shell__rail--left" aria-label="Layers and scope">
          <section className="insight-panel">
            <h2 className="insight-panel__heading">Mobility lens</h2>
            <p className="insight-panel__hint">
              Switch mode to filter the map context for your journey type.
            </p>
            <LensSelector active={lens} onSelect={setLens} />
            <p className="insight-panel__hint" style={{ marginTop: '0.5rem', opacity: 0.6 }}>
              {lensLoading
                ? `Loading ${MOBILITY_LENS_META[lens].label.toLowerCase()} overlay…`
                : lens === 'drive'
                  ? 'Drive — traffic flow shown via TomTom layer'
                  : `${MOBILITY_LENS_META[lens].label} overlay — ${lensData.features.length} features loaded`
              }
            </p>
          </section>

          <section className="insight-panel">
            <h2 className="insight-panel__heading">Map layers</h2>
            <LayerToggle
              id="layer-skytrain"
              label="SkyTrain stations"
              description="Expo, Millennium, and Canada Line stops"
              checked={layers.skytrainNodes}
              onChange={() => toggleLayer('skytrainNodes')}
            />
            <LayerToggle
              id="layer-incident"
              label="AI incident marker"
              description="Location pin from the last AI query"
              checked={layers.incidentMarker}
              onChange={() => toggleLayer('incidentMarker')}
            />
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
              incident={aiResponse}
              focusLocation={focusLocation}
            />
          </Suspense>
        </main>

        <aside className="insight-shell__rail insight-shell__rail--right" aria-label="Signals">
          <RouteFindingPanel
            onResult={handleRouteResult}
            onSelectRoute={setSelectedRouteIndex}
            result={routeResult}
            selectedRouteIndex={selectedRouteIndex}
          />
          <section className="insight-panel" aria-label="Systems status">
            <StatusPanel />
          </section>

        </aside>
      </div>
    </div>
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
