import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCameras } from '../hooks/useCameras'
import './CameraWatchPanel.css'

interface CameraItem {
  key: string
  name: string
  caption: string
  image_url: string | null
}

const REFRESH_INTERVAL_MS = 30_000

function buildCameras(geojson: GeoJSON.FeatureCollection | null): CameraItem[] {
  if (!geojson) return []
  return geojson.features.map((f, i) => ({
    key: String(f.id ?? f.properties?.name ?? i),
    name: f.properties?.name ?? `Camera ${i + 1}`,
    caption: f.properties?.caption ?? '',
    image_url: f.properties?.image_url ?? null,
  }))
}

function CameraFeedImage({ src, alt }: { src: string; alt: string }) {
  const [refreshKey, setRefreshKey] = useState(() => Date.now())
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
    const id = setInterval(() => {
      setRefreshKey(Date.now())
      setErrored(false)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [src])

  if (errored) {
    return <div className="cam-feed__no-img">Feed unavailable</div>
  }

  return (
    <img
      className="cam-feed__img"
      src={`${src}?t=${refreshKey}`}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  )
}

interface CameraWatchPanelProps {
  pinnedKeys: Set<string>
  onPinnedChange: (next: Set<string>) => void
}

export default function CameraWatchPanel({ pinnedKeys, onPinnedChange }: CameraWatchPanelProps) {
  const geojson = useCameras(true)
  const cameras = useMemo(() => buildCameras(geojson), [geojson])
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const pinned = useMemo(() => cameras.filter((c) => pinnedKeys.has(c.key)), [cameras, pinnedKeys])

  const filtered = useMemo(() => {
    if (!search.trim()) return cameras
    const q = search.toLowerCase()
    return cameras.filter(
      (c) => c.name.toLowerCase().includes(q) || c.caption.toLowerCase().includes(q),
    )
  }, [cameras, search])

  const togglePin = useCallback(
    (key: string) => {
      const next = new Set(pinnedKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      onPinnedChange(next)
    },
    [pinnedKeys, onPinnedChange],
  )

  const openPicker = useCallback(() => {
    setPicking(true)
    setTimeout(() => searchRef.current?.focus(), 60)
  }, [])

  const closePicker = useCallback(() => {
    setPicking(false)
    setSearch('')
  }, [])

  if (picking) {
    return (
      <div className="cam-panel cam-panel--picking">
        <div className="cam-panel__picker-bar">
          <span className="cam-panel__picker-title">Add cameras</span>
          <button type="button" className="cam-panel__done-btn" onClick={closePicker}>
            Done
          </button>
        </div>
        <input
          ref={searchRef}
          className="cam-panel__search"
          type="search"
          placeholder="Search cameras…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {cameras.length === 0 && (
          <p className="cam-panel__hint">Loading cameras…</p>
        )}
        <ul className="cam-panel__pick-list">
          {filtered.map((cam) => {
            const checked = pinnedKeys.has(cam.key)
            return (
              <li key={cam.key} className={`cam-panel__pick-item${checked ? ' cam-panel__pick-item--checked' : ''}`}>
                <label className="cam-panel__pick-label">
                  <input
                    type="checkbox"
                    className="cam-panel__pick-checkbox"
                    checked={checked}
                    onChange={() => togglePin(cam.key)}
                  />
                  <span className="cam-panel__pick-text">
                    <span className="cam-panel__pick-name">{cam.name}</span>
                    {cam.caption && (
                      <span className="cam-panel__pick-caption">{cam.caption}</span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="cam-panel">
      <div className="cam-panel__header">
        <div>
          <h2 className="insight-panel__heading">Live cameras</h2>
          {pinned.length > 0 && (
            <p className="cam-panel__hint">
              {pinned.length} feed{pinned.length !== 1 ? 's' : ''} · refreshes every 30 s
            </p>
          )}
        </div>
        <button type="button" className="cam-panel__edit-btn" onClick={openPicker}>
          {pinned.length === 0 ? '+ Add' : 'Edit'}
        </button>
      </div>

      {pinned.length === 0 ? (
        <div className="cam-panel__empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M23 7 16 12 23 17V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <p className="cam-panel__empty-text">No cameras selected</p>
          <button type="button" className="cam-panel__add-btn" onClick={openPicker}>
            Choose cameras
          </button>
        </div>
      ) : (
        <ul className="cam-panel__feed-list">
          {pinned.map((cam) => (
            <li key={cam.key} className="cam-feed">
              <div className="cam-feed__header">
                <span className="cam-feed__name">{cam.name}</span>
                <button
                  type="button"
                  className="cam-feed__remove"
                  onClick={() => togglePin(cam.key)}
                  aria-label={`Remove ${cam.name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {cam.image_url ? (
                <CameraFeedImage src={cam.image_url} alt={cam.name} />
              ) : (
                <div className="cam-feed__no-img">No feed available</div>
              )}
              {cam.caption && (
                <p className="cam-feed__caption">{cam.caption}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
