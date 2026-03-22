import { useCallback, useEffect, useState } from 'react'

export interface Open511MapEvent {
  id: string
  headline: string
  description: string
  /** MAJOR | MODERATE | MINOR */
  severity: string
  /** INCIDENT | CONSTRUCTION | WEATHER_CONDITION | ROAD_CONDITION */
  event_type: string
  coordinates: { lat: number; lng: number }
  roads: string
  updated: string
}

const BBOX = '-123.5,49.0,-122.5,49.5'
const POLL_URL =
  `/api/open511-bc/events/?event_type=INCIDENT&bbox=${BBOX}&limit=100`

function parseEvent(raw: Record<string, unknown>): Open511MapEvent | null {
  const geo = raw.geography as { coordinates?: [number, number] } | undefined
  const coords = geo?.coordinates
  if (!coords || coords.length < 2) return null
  const [lng, lat] = coords
  if (typeof lng !== 'number' || typeof lat !== 'number') return null
  return {
    id: String(raw.id ?? ''),
    headline: String(raw.headline ?? ''),
    description: String(raw.description ?? ''),
    severity: String(raw.severity ?? ''),
    event_type: String(raw.event_type ?? ''),
    coordinates: { lat, lng },
    roads: ((raw.roads as Array<{ name: string }>) ?? []).map((r) => r.name).join(', '),
    updated: String(raw.updated ?? ''),
  }
}

/**
 * Polls the Open511 BC /events endpoint on mount and every `pollIntervalMs`
 * (default 5 minutes). Returns all parsed incidents with coordinates.
 */
export function useOpen511Events(pollIntervalMs = 5 * 60 * 1000): Open511MapEvent[] {
  const [events, setEvents] = useState<Open511MapEvent[]>([])

  const refresh = useCallback(async () => {
    try {
      const res = await window.fetch(POLL_URL, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return
      const data = (await res.json()) as { open511?: { events?: unknown[] } }
      const raw = data?.open511?.events ?? []
      const parsed = (raw as Record<string, unknown>[])
        .map(parseEvent)
        .filter((e): e is Open511MapEvent => e !== null)
      setEvents(parsed)
    } catch {
      // Keep existing events on transient errors; don't clear the map.
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, pollIntervalMs)
    return () => window.clearInterval(id)
  }, [refresh, pollIntervalMs])

  return events
}
