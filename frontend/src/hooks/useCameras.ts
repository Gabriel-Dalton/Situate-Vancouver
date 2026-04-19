import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/api'

const CACHE_TTL = 10 * 60 * 1000  // 10 min — matches backend cache

let _cached: GeoJSON.FeatureCollection | null = null
let _fetchedAt = 0

export function useCameras(enabled: boolean): GeoJSON.FeatureCollection | null {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(_cached)

  useEffect(() => {
    if (!enabled) return
    const age = Date.now() - _fetchedAt
    if (_cached && age < CACHE_TTL) { setData(_cached); return }

    fetch(`${API_BASE}/api/cameras/`)
      .then((r) => r.json())
      .then((d: GeoJSON.FeatureCollection) => {
        _cached = d
        _fetchedAt = Date.now()
        setData(d)
      })
      .catch(() => {})
  }, [enabled])

  return data
}
