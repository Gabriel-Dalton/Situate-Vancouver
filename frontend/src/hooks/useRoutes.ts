import { useCallback, useEffect, useState } from 'react'
import { routeService, type SavedRoute } from '../services/routeService'

export function useRoutes(enabled = true) {
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRoutes([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const nextRoutes = await routeService.list()
      setRoutes(nextRoutes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load saved routes.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    const onExternalUpdate = () => {
      void refresh()
    }
    window.addEventListener('saved-routes-updated', onExternalUpdate)
    return () => window.removeEventListener('saved-routes-updated', onExternalUpdate)
  }, [enabled, refresh])

  const create = async (data: Omit<SavedRoute, 'id' | 'created_at' | 'updated_at'>) => {
    const route = await routeService.create(data)
    setRoutes(prev => [...prev, route])
    window.dispatchEvent(new CustomEvent('saved-routes-updated'))
    return route
  }

  const update = async (id: string, data: Partial<SavedRoute>) => {
    const updated = await routeService.update(id, data)
    setRoutes(prev => prev.map(r => (r.id === id ? updated : r)))
    window.dispatchEvent(new CustomEvent('saved-routes-updated'))
    return updated
  }

  const remove = async (id: string) => {
    await routeService.delete(id)
    setRoutes(prev => prev.filter(r => r.id !== id))
    window.dispatchEvent(new CustomEvent('saved-routes-updated'))
  }

  if (!enabled) {
    return { routes: [], loading: false, error: null, create, update, remove, refresh }
  }

  return { routes, loading, error, create, update, remove, refresh }
}
