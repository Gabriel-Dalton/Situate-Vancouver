import type { MobilityLens } from '../types/mobilityLens'
import { MOBILITY_LENS_META, MOBILITY_LENS_ORDER } from '../types/mobilityLens'

const P = 1.75

function IconCycle() {
  return (
    <svg className="lens-selector__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="7" cy="15.5" r="4" stroke="currentColor" strokeWidth={P} />
      <circle cx="17" cy="15.5" r="4" stroke="currentColor" strokeWidth={P} />
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 15.5l3-7h4l1.5 3.5L17 15.5"
      />
      <path stroke="currentColor" strokeWidth={P} strokeLinecap="round" d="M10 8.5l2.5 0" />
      <circle cx="14" cy="8.5" r="1.1" fill="currentColor" />
    </svg>
  )
}

function IconPedestrian() {
  return (
    <svg className="lens-selector__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="4.5" r="2" stroke="currentColor" strokeWidth={P} />
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 10.5l-1.5 5L10 18.5l1 2.5M14 10.5l1.5 5L14 18.5l-1 2.5"
      />
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.5 8h5a1 1 0 0 1 1 1v2.5h-7V9a1 1 0 0 1 1-1z"
      />
    </svg>
  )
}

function IconDrive() {
  return (
    <svg className="lens-selector__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M3.5 14h17v4.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V14z"
      />
      <path
        stroke="currentColor"
        strokeWidth={P}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.5 14l1.75-5.25A1.5 1.5 0 0 1 8.68 7.75h6.64a1.5 1.5 0 0 1 1.43 1l1.75 5.25"
      />
      <circle cx="7.25" cy="17" r="1.35" stroke="currentColor" strokeWidth={1.35} />
      <circle cx="16.75" cy="17" r="1.35" stroke="currentColor" strokeWidth={1.35} />
      <path stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" d="M9.5 11h5" opacity={0.55} />
    </svg>
  )
}

const ICONS: Record<MobilityLens, React.ReactNode> = {
  cycle: <IconCycle />,
  pedestrian: <IconPedestrian />,
  drive: <IconDrive />,
}

type Props = {
  active: MobilityLens
  onSelect: (lens: MobilityLens) => void
}

export default function LensSelector({ active, onSelect }: Props) {
  return (
    <div className="lens-selector" role="radiogroup" aria-label="Mobility lens">
      {MOBILITY_LENS_ORDER.map((id) => {
        const meta = MOBILITY_LENS_META[id]
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={'lens-selector__btn' + (isActive ? ' lens-selector__btn--active' : '')}
            style={isActive ? { '--lens-accent': meta.color } as React.CSSProperties : undefined}
            onClick={() => onSelect(id)}
            title={meta.label}
            aria-label={meta.label}
          >
            {ICONS[id]}
            <span className="lens-selector__label">{meta.shortLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
