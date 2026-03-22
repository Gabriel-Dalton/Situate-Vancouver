/**
 * Situate Vancouver — insight workspace (map-first). Dev/proxy and health-check context for
 * wiring APIs lives in `src/lib/stackIntegrationNotes.ts` (comments only).
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { InsightLayerState } from './components/VancouverMap'
import LensSelector from './components/LensSelector'
import { SKYTRAIN_LEGEND, SKYTRAIN_LINE_COLORS } from './data/skytrainLineKeys'
import type { MobilityLens } from './types/mobilityLens'
import { LENS_SIGNALS, MOBILITY_LENS_META } from './types/mobilityLens'
import BrandLockup from './components/BrandLockup'
import StatusPanel from './components/StatusPanel'
import './App.css'

const VancouverMap = lazy(() => import('./components/VancouverMap'))

const DEFAULT_LAYERS: InsightLayerState = {
  strategicNodes: true,
  movementCorridors: true,
  skytrainNodes: true,
}

export default function App() {
  const [layers, setLayers] = useState<InsightLayerState>(DEFAULT_LAYERS)
  const [lens, setLens] = useState<MobilityLens>('cycle')

  const toggleLayer = useCallback((key: keyof InsightLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <div className="insight-shell">
      <header className="insight-shell__header">
        <div className="insight-shell__brand">
          <BrandLockup variant="onDark" />
          <p className="insight-shell__subtitle">City-scale insight canvas</p>
        </div>
        <div className="insight-shell__header-meta">
          <span className="insight-shell__pill">Metro · Lower Mainland</span>
          <span className="insight-shell__clock" aria-live="polite">
            <LiveClock />
          </span>
        </div>
      </header>

      <div className="insight-shell__body">
        <aside className="insight-shell__rail insight-shell__rail--left" aria-label="Layers and scope">
          <section className="insight-panel">
            <h2 className="insight-panel__heading">Mobility lens</h2>
            <p className="insight-panel__hint">
              Choose how you move — the map and signals adapt to your context.
            </p>
            <LensSelector active={lens} onSelect={setLens} />
          </section>

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
            <VancouverMap layers={layers} onToggleLayer={toggleLayer} lens={lens} />
          </Suspense>
        </main>

        <aside className="insight-shell__rail insight-shell__rail--right" aria-label="Signals">
          <section className="insight-panel">
            <h2 className="insight-panel__heading">Service status</h2>
            <p className="insight-panel__hint">Connection status for the app and city data (refreshes every 30 s).</p>
            <StatusPanel />
          </section>

          <section className="insight-panel">
            <h2 className="insight-panel__heading">
              {MOBILITY_LENS_META[lens].label} signals
            </h2>
            <p className="insight-panel__hint">
              City data scoped to the active mobility lens.
            </p>
            {LENS_SIGNALS[lens].map((sig) => (
              <SignalTile
                key={sig.label}
                label={sig.label}
                value={sig.value}
                trend={sig.trend}
              />
            ))}
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
