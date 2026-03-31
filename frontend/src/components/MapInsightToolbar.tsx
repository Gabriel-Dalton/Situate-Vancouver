import type { ReactNode } from 'react'
import type { InsightLayerKey, InsightLayerState } from '../types/insightLayers'

const ITEMS: { key: InsightLayerKey; label: string }[] = [
  { key: 'buildings', label: 'Layer: 3D buildings' },
  { key: 'skytrainNodes', label: 'Layer: SkyTrain stations' },
  { key: 'incidentMarker', label: 'Layer: incident marker' },
  { key: 'outages', label: 'Layer: power outages' },
]

const P = 1.75
const S = 1.35

/** Buildings — extruded block pair (3D buildings layer). */
function IconBuildings() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="9" width="8" height="12" rx="0.5" stroke="currentColor" strokeWidth={P} />
      <rect x="13" y="5" width="8" height="16" rx="0.5" stroke="currentColor" strokeWidth={P} />
      <path stroke="currentColor" strokeWidth={S} strokeLinecap="round" d="M5 12h4M5 15h4M15 8h4M15 11h4M15 14h4" opacity={0.5} />
    </svg>
  )
}

/** Lightning bolt — power outage indicator. */
function IconOutages() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 3L5 14h7l-1 7 8-11h-7l1-7z"
      />
    </svg>
  )
}

/**
 * Modern rapid transit / LRT — streamlined EMU side profile: wedge nose, ribbon glazing,
 * skirt, bogies (not a classic locomotive silhouette).
 */
function IconSkytrain() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* Car shell — tapered nose, flat roof */}
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M4.25 17.25V12.4L5.35 9.85A1.35 1.35 0 0 1 6.5 9h10.6a1.6 1.6 0 0 1 1.35.75l1.3 2.1v5.4H4.25z"
      />
      {/* Continuous ribbon window (light-rail / metro glazing) */}
      <rect
        x="6.15"
        y="10.65"
        width="11.7"
        height="3.35"
        rx="0.65"
        fill="currentColor"
        fillOpacity={0.22}
        stroke="currentColor"
        strokeWidth={S}
      />
      {/* Window mullions */}
      <path
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.5}
        d="M9.75 10.9v3.15M12 10.9v3.15M14.25 10.9v3.15"
      />
      {/* Pantograph / roof equipment */}
      <path
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap="round"
        d="M10.75 9V7.35M13.25 9V7.35M10.2 7.35h3.6"
      />
      {/* Bogies */}
      <circle cx="9" cy="18.35" r="1.35" stroke="currentColor" strokeWidth={S} />
      <circle cx="16.25" cy="18.35" r="1.35" stroke="currentColor" strokeWidth={S} />
      <circle cx="9" cy="18.35" r="0.55" fill="currentColor" fillOpacity={0.45} />
      <circle cx="16.25" cy="18.35" r="0.55" fill="currentColor" fillOpacity={0.45} />
      {/* Running rail */}
      <path
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.35}
        d="M3 19.6h18"
      />
    </svg>
  )
}

/** Pin + pulse — AI incident location overlay. */
function IconIncidentMarker() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
      />
      <circle cx="12" cy="11" r="2.25" fill="currentColor" fillOpacity={0.85} />
    </svg>
  )
}

const ICONS: Record<InsightLayerKey, ReactNode> = {
  buildings: <IconBuildings />,
  skytrainNodes: <IconSkytrain />,
  incidentMarker: <IconIncidentMarker />,
  outages: <IconOutages />,
}

type Props = {
  layers: InsightLayerState
  onToggleLayer: (key: InsightLayerKey) => void
}

export default function MapInsightToolbar({ layers, onToggleLayer }: Props) {
  return (
    <div className="map-icon-toolbar map-insight-toolbar" role="toolbar" aria-label="Insight layers">
      {ITEMS.map(({ key, label }) => {
        const on = layers[key]
        return (
          <button
            key={key}
            type="button"
            className={'map-icon-toolbar__btn' + (on ? ' map-icon-toolbar__btn--active' : '')}
            onClick={() => onToggleLayer(key)}
            title={label}
            aria-label={label}
            aria-pressed={on}
          >
            {ICONS[key]}
          </button>
        )
      })}
    </div>
  )
}
