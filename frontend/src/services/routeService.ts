import { api } from './api'
import type { Incident } from './incidentService'

export interface RouteStep {
  instruction: string
  distance_m: number
  lat: number
  lng: number
}

export interface RouteOption {
  index: number
  summary: string
  distance_km: number
  duration_min: number
  geometry: string  // encoded polyline (Google format, precision 5)
  is_recommended: boolean
  steps: RouteStep[]
}

export interface IncidentAvoided {
  title: string
  severity: string
  incident_type: string
  lat: number
  lng: number
}

export interface RouteFindResult {
  origin_lat: number
  origin_lng: number
  dest_lat: number
  dest_lng: number
  routes: RouteOption[]
  incidents_avoided: IncidentAvoided[]
}

export interface SavedRoute {
  id: string
  name: string
  origin_label: string
  origin_lat: number
  origin_lng: number
  destination_label: string
  destination_lat: number
  destination_lng: number
  departure_time: string  // 'HH:MM'
  active_days: string[]   // ['mon','tue','wed','thu','fri']
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RouteAlert {
  id: string
  route: string
  incident: Incident
  alert_type: 'warning' | 'update' | 'clear'
  sent_at: string
}

export function findRoute(origin: string, destination: string): Promise<RouteFindResult> {
  return api.post<RouteFindResult>('/routes/find/', { origin, destination })
}

export const routeService = {
  list: () =>
    api.get<SavedRoute[]>('/routes/'),

  get: (id: string) =>
    api.get<SavedRoute>(`/routes/${id}/`),

  create: (data: Omit<SavedRoute, 'id' | 'created_at' | 'updated_at'>) =>
    api.post<SavedRoute>('/routes/', data),

  update: (id: string, data: Partial<SavedRoute>) =>
    api.patch<SavedRoute>(`/routes/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/routes/${id}/`),

  alerts: (id: string) =>
    api.get<RouteAlert[]>(`/routes/${id}/alerts/`),
}
