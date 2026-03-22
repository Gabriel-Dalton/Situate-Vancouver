import type { ReactNode } from 'react'
import type { BasemapId } from '../map/basemapConfig'
import { BASEMAP_ORDER } from '../map/basemapConfig'

const LABELS: Record<BasemapId, string> = {
  dark: 'Basemap: dark (CARTO Dark Matter)',
  light: 'Basemap: light (CARTO Positron)',
  streets: 'Basemap: streets (CARTO Voyager)',
  satellite: 'Basemap: satellite (Esri World Imagery)',
}

/** Primary stroke — tuned for 20px glyphs on retina UI. */
const P = 1.75
const S = 1.35

function IconDark() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      />
    </svg>
  )
}

function IconLight() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={P} />
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        d="M12 2.25v2.5M12 19.25v2.5M2.25 12h2.5M19.25 12h2.5M4.75 4.75l1.77 1.77M17.48 17.48l1.77 1.77M4.75 19.25l1.77-1.77M17.48 6.52l1.77-1.77"
      />
    </svg>
  )
}

/** Vector street map — primary grid + diagonal boulevard + frame. */
function IconStreets() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.25" stroke="currentColor" strokeWidth={P} />
      <path stroke="currentColor" strokeWidth={S} strokeLinecap="round" d="M3.5 9.5h17M9.5 3.5v17" />
      <path
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap="round"
        opacity={0.45}
        d="M15.5 3.5v17M3.5 15.5h17"
      />
      <path
        stroke="currentColor"
        strokeWidth={1.15}
        strokeLinecap="round"
        opacity={0.35}
        d="M5 19L19 5"
      />
    </svg>
  )
}

/** Orbital imagery — globe + orbit ring (reads “satellite / earth” at small sizes). */
function IconSatellite() {
  return (
    <svg className="map-icon-toolbar__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth={P} />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="4"
        stroke="currentColor"
        strokeWidth={S}
        transform="rotate(-24 12 12)"
        opacity={0.55}
      />
      <path
        stroke="currentColor"
        strokeWidth={S}
        strokeLinecap="round"
        d="M7 9.5c2 1.5 4 1.5 8 0.5s6-0.5 7 1"
        opacity={0.45}
      />
    </svg>
  )
}

const ICONS: Record<BasemapId, ReactNode> = {
  dark: <IconDark />,
  light: <IconLight />,
  streets: <IconStreets />,
  satellite: <IconSatellite />,
}

type Props = {
  active: BasemapId
  onSelect: (id: BasemapId) => void
}

export default function MapBasemapToolbar({ active, onSelect }: Props) {
  return (
    <div className="map-icon-toolbar map-basemap-toolbar" role="toolbar" aria-label="Basemap mode">
      {BASEMAP_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className={
            'map-icon-toolbar__btn' + (active === id ? ' map-icon-toolbar__btn--active' : '')
          }
          onClick={() => onSelect(id)}
          title={LABELS[id]}
          aria-label={LABELS[id]}
          aria-pressed={active === id}
        >
          {ICONS[id]}
        </button>
      ))}
    </div>
  )
}
