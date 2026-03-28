import { useEffect, useState } from 'react'
import { routeService, type SavedRoute } from '../services/routeService'

export function useRoutes() {
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    routeService
      .list()
      .then(setRoutes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const create = async (data: Omit<SavedRoute, 'id' | 'created_at' | 'updated_at'>) => {
    const route = await routeService.create(data)
    setRoutes(prev => [...prev, route])
    return route
  }

  const update = async (id: string, data: Partial<SavedRoute>) => {
    const updated = await routeService.update(id, data)
    setRoutes(prev => prev.map(r => (r.id === id ? updated : r)))
    return updated
  }

  const remove = async (id: string) => {
    await routeService.delete(id)
    setRoutes(prev => prev.filter(r => r.id !== id))
  }

  return { routes, loading, error, create, update, remove }
}
