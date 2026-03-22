/**
 * Situate Vancouver — insight workspace (map-first). Dev/proxy and health-check context for
 * wiring APIs lives in `src/lib/stackIntegrationNotes.ts` (comments only).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { InsightLayerState, FocusLocation } from './components/VancouverMap'
import { SKYTRAIN_LEGEND, SKYTRAIN_LINE_COLORS } from './data/skytrainLineKeys'
import BrandLockup from './components/BrandLockup'
import StatusPanel from './components/StatusPanel'
import { AiQueryBar, AiResponsePanel } from './components/AiQuery'
import type { AiQueryResponse } from './components/AiQuery'
import './App.css'

const VancouverMap = lazy(() => import('./components/VancouverMap'))

const DEFAULT_LAYERS: InsightLayerState = {
  strategicNodes: true,
  movementCorridors: true,
  skytrainNodes: true,
}

export default function App() {
  const [layers, setLayers] = useState<InsightLayerState>(DEFAULT_LAYERS)
  const [aiResponse, setAiResponse] = useState<AiQueryResponse | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  useEffect(() => {
    function relocate() {
      const mount = document.getElementById('situate-lang-mount')
      const root = document.getElementById('ls-root')
      if (mount && root && root.parentElement !== mount) {
        root.classList.add('ls-inline')
        mount.appendChild(root)
        return true
      }
      return false
    }
    if (relocate()) return

    const observer = new MutationObserver(() => {
      if (relocate()) observer.disconnect()
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
              <VancouverMap layers={layers} focusLocation={focusLocation} />
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
            <h2 className="insight-panel__heading">Insight layers</h2>
            <p className="insight-panel__hint">
              Toggle geometry that will later bind to Django / AI outputs. Data is local seed GeoJSON
              for now.
            </p>
            <LayerToggle
              id="layer-nodes"
              label="Strategic nodes"
              description="Priority places and narrative lenses"
              checked={layers.strategicNodes}
              onChange={() => toggleLayer('strategicNodes')}
            />
            <LayerToggle
              id="layer-corridors"
              label="Movement corridors"
              description="Spines for mobility / planning overlays"
              checked={layers.movementCorridors}
              onChange={() => toggleLayer('movementCorridors')}
            />
            <LayerToggle
              id="layer-skytrain"
              label="SkyTrain stations"
              description="Expo, Millennium, and Canada Line stops (public transit nodes)"
              checked={layers.skytrainNodes}
              onChange={() => toggleLayer('skytrainNodes')}
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

          <section className="insight-panel">
            <h2 className="insight-panel__heading">Scope</h2>
            <ul className="insight-scope">
              <li>
                <span className="insight-scope__k">Bounding box</span>
                <span className="insight-scope__v">City of Vancouver core + inner burbs</span>
              </li>
              <li>
                <span className="insight-scope__k">Basemap</span>
                <span className="insight-scope__v">CARTO Dark Matter (vector)</span>
              </li>
            </ul>
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
            <VancouverMap layers={layers} onToggleLayer={toggleLayer} focusLocation={focusLocation} />
          </Suspense>
        </main>

        <aside className="insight-shell__rail insight-shell__rail--right" aria-label="Signals">
          <section className="insight-panel" aria-label="Systems status">
            <StatusPanel />
          </section>

          <section className="insight-panel">
            <h2 className="insight-panel__heading">City signals</h2>
            <p className="insight-panel__hint">Placeholder tiles until API feeds land.</p>
            <SignalTile label="Activity index" value="—" trend="Awaiting stream" />
            <SignalTile label="Mobility stress" value="—" trend="Awaiting stream" />
            <SignalTile label="Equity lens" value="—" trend="Awaiting stream" />
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

function SignalTile({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="signal-tile">
      <span className="signal-tile__label">{label}</span>
      <span className="signal-tile__value">{value}</span>
      <span className="signal-tile__trend">{trend}</span>
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
