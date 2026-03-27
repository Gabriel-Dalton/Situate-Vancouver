import { useEffect, useState } from 'react'
import { Incident, IncidentFilters, incidentService } from '../services/incidentService'

export function useIncidents(filters: IncidentFilters = {}) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    setLoading(true)
    incidentService
      .list(filters)
      .then(setIncidents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [filtersKey])

  const refresh = () => {
    incidentService.list(filters).then(setIncidents).catch(e => setError(e.message))
  }

  const verify = async (id: string) => {
    const updated = await incidentService.verify(id)
    setIncidents(prev => prev.map(i => (i.id === id ? updated : i)))
  }

  const remove = async (id: string) => {
    await incidentService.delete(id)
    setIncidents(prev => prev.filter(i => i.id !== id))
  }

  return { incidents, loading, error, refresh, verify, remove }
}
