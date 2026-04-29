import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ZoomLocation } from './AiQuery'
import './MapSearchBar.css'

// Metro Vancouver bounding box for Overpass queries
const BBOX = '49.0,-123.5,49.5,-122.5'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Strip common street-type suffixes so "main" also matches "Main Street"
function toStreetPrefix(name: string): string {
  return name.trim().replace(/\s+(street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|way|crescent|cres|court|ct|place|pl|lane|ln)\.?$/i, '').trim()
}

async function geocodeIntersection(raw1: string, raw2: string): Promise<ZoomLocation | null> {
  const p1 = escapeRegex(toStreetPrefix(raw1))
  const p2 = escapeRegex(toStreetPrefix(raw2))

  const query = `[out:json][timeout:12];
way["name"~"${p1}","i"]["highway"](${BBOX})->.a;
way["name"~"${p2}","i"]["highway"](${BBOX})->.b;
node(w.a)(w.b);
out;`

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (res.ok) {
      const data = await res.json()
      const node = data.elements?.[0]
      if (node?.lat != null) {
        return {
          lat: node.lat,
          lng: node.lon,
          label: `${raw1.trim()} & ${raw2.trim()}, Vancouver`,
        }
      }
    }
  } catch {
    // fall through
  }

  // Nominatim fallback — "X at Y" works better than "X and Y" for intersections
  try {
    const params = new URLSearchParams({
      q: `${raw1.trim()} at ${raw2.trim()}, Vancouver, BC`,
      format: 'json',
      limit: '1',
      countrycodes: 'ca',
      viewbox: '-123.5,49.0,-122.5,49.6',
      bounded: '1',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'SituateVancouver/1.0' },
    })
    const data = await res.json()
    if (data?.[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: `${raw1.trim()} & ${raw2.trim()}, Vancouver`,
      }
    }
  } catch {
    // fall through
  }

  return null
}

async function geocodePlace(place: string): Promise<ZoomLocation | null> {
  // Detect "X and Y" intersection pattern
  const andMatch = place.match(/^(.+?)\s+and\s+(.+)$/i)
  if (andMatch) {
    const loc = await geocodeIntersection(andMatch[1], andMatch[2])
    if (loc) return loc
  }

  // General Nominatim geocoding (places, addresses, landmarks)
  try {
    const params = new URLSearchParams({
      q: `${place}, Vancouver, BC`,
      format: 'json',
      limit: '1',
      countrycodes: 'ca',
      viewbox: '-123.5,49.0,-122.5,49.6',
      bounded: '1',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'SituateVancouver/1.0' },
    })
    const data = await res.json()
    if (!data?.[0]) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      label: data[0].display_name,
    }
  } catch {
    return null
  }
}

interface MapSearchBarProps {
  onZoom: (loc: ZoomLocation) => void
}

export default function MapSearchBar({ onZoom }: MapSearchBarProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async () => {
    const place = query.trim()
    if (!place || loading) return
    setLoading(true)
    setNotFound(false)
    const loc = await geocodePlace(place)
    setLoading(false)
    if (loc) {
      onZoom(loc)
      setQuery('')
    } else {
      setNotFound(true)
    }
  }, [query, loading, onZoom])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); search() }
      if (e.key === 'Escape') { setQuery(''); setNotFound(false) }
    },
    [search],
  )

  const clear = useCallback(() => {
    setQuery('')
    setNotFound(false)
    inputRef.current?.focus()
  }, [])

  return (
    <div className="map-search-bar">
      <div className={`map-search-bar__wrap${notFound ? ' map-search-bar__wrap--error' : ''}`}>
        <svg className="map-search-bar__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <input
          ref={inputRef}
          className="map-search-bar__input"
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setNotFound(false) }}
          onKeyDown={handleKey}
          placeholder="Search location or intersection…"
          aria-label="Navigate to location"
        />
        {query && !loading && (
          <button type="button" className="map-search-bar__clear" onClick={clear} aria-label="Clear">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="map-search-bar__go"
          onClick={search}
          disabled={!query.trim() || loading}
          aria-label="Go"
        >
          {loading
            ? <span className="map-search-bar__spinner" />
            : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )
          }
        </button>
      </div>
      {notFound && (
        <p className="map-search-bar__error">Location not found — try adding a street type (Ave, St…)</p>
      )}
    </div>
  )
}
