import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../lib/api'

const REFRESH_MS = 15 * 60 * 1000  // 15 minutes — matches BC Hydro RSS cadence

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export function useOutages(): { data: GeoJSON.FeatureCollection; loading: boolean } {
  const [data, setData] = useState<GeoJSON.FeatureCollection>(EMPTY)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    async function fetch_() {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      try {
        const resp = await fetch(apiUrl('/api/outages/'), { signal: ctrl.signal })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json() as GeoJSON.FeatureCollection
        setData(json)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('useOutages: fetch failed', err)
        }
      } finally {
        setLoading(false)
      }
      timer = setTimeout(fetch_, REFRESH_MS)
    }

    void fetch_()
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [])

  return { data, loading }
}
