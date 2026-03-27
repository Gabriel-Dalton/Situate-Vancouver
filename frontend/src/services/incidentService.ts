import { api } from './api'

export interface Incident {
  id: string
  incident_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'resolved' | 'unverified'
  title: string
  description: string
  location: string
  lat: number | null
  lng: number | null
  cause: string
  impact: string
  estimated_duration: string
  recommended_actions: string[]
  related_alerts: string[]
  confidence: number
  source: 'api' | 'user'
  source_api: string
  external_id: string
  reported_by: string | null
  verified: boolean
  verified_at: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
  is_user_reported: boolean
}

export interface IncidentFilters {
  source?: 'api' | 'user'
  incident_type?: string
  severity?: string
  status?: string
  verified?: boolean
  search?: string
}

function buildQuery(filters: IncidentFilters): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const q = params.toString()
  return q ? `?${q}` : ''
}

export const incidentService = {
  list: (filters: IncidentFilters = {}) =>
    api.get<Incident[]>(`/incidents/${buildQuery(filters)}`),

  get: (id: string) =>
    api.get<Incident>(`/incidents/${id}/`),

  create: (data: Partial<Incident>) =>
    api.post<Incident>('/incidents/', data),

  update: (id: string, data: Partial<Incident>) =>
    api.patch<Incident>(`/incidents/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/incidents/${id}/`),

  verify: (id: string) =>
    api.post<Incident>(`/incidents/${id}/verify/`, {}),

  // Ask AI agent a natural language question
  query: (query: string) =>
    api.post<Incident>('/query/', { query }),
}
