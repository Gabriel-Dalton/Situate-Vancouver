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
  email_verified: boolean
  email_verified_at: string | null
  home_label: string
  home_lat: number | null
  home_lng: number | null
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
  home_label?: string
  home_lat?: number | null
  home_lng?: number | null
}

export const accountService = {
  getMe: () => api.get<MeResponse>('/auth/me/'),
  updateMe: (data: MeUpdateInput) => api.patch<MeResponse>('/auth/me/', data),
  passwordForgot: (email: string) =>
    api.post<{ detail: string; dev_reset?: { uid: string; token: string } }>('/auth/password/forgot/', { email }),
  passwordReset: (data: { uid: string; token: string; new_password: string }) =>
    api.post<{ detail: string }>('/auth/password/reset/', data),
  requestEmailVerification: () =>
    api.post<{ detail: string; dev_verification?: { uid: string; token: string } }>(
      '/auth/verify-email/request/',
      {},
    ),
  confirmEmailVerification: (data: { uid: string; token: string }) =>
    api.post<{ detail: string }>('/auth/verify-email/confirm/', data),
}
