import { api } from './api'

export interface AccountUser {
  id: number
  email: string
  first_name: string
  last_name: string
  date_joined: string
}

export interface AccountProfile {
  notify_via: 'email' | 'push' | 'sms'
  alert_lead_minutes: number
  phone: string
}

export interface MeResponse {
  user: AccountUser
  profile: AccountProfile
}

export interface MeUpdateInput {
  first_name?: string
  last_name?: string
  notify_via?: 'email' | 'push' | 'sms'
  alert_lead_minutes?: number
  phone?: string
}

export const accountService = {
  getMe: () => api.get<MeResponse>('/auth/me/'),
  updateMe: (data: MeUpdateInput) => api.patch<MeResponse>('/auth/me/', data),
}
