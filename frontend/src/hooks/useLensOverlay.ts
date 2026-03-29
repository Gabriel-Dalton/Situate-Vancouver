import { useEffect, useRef, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import type { MobilityLens } from '../types/mobilityLens'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const cache = new Map<MobilityLens, FeatureCollection>()

export function useLensOverlay(lens: MobilityLens): { data: FeatureCollection; loading: boolean } {
  const [data, setData] = useState<FeatureCollection>(() => cache.get(lens) ?? EMPTY)
  const [loading, setLoading] = useState(() => !cache.has(lens) && lens !== 'drive')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (lens === 'drive') {
      setData(EMPTY)
      setLoading(false)
      return
    }

    const cached = cache.get(lens)
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)

    fetch(`/api/lens/${lens}/`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<FeatureCollection>
      })
      .then((geojson) => {
        cache.set(lens, geojson)
        setData(geojson)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn(`useLensOverlay: failed to load ${lens} overlay`, err)
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [lens])

  return { data, loading }
}
