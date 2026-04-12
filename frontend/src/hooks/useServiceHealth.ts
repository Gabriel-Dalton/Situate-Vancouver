import { useEffect, useState } from 'react'

export type ServiceStatus = 'ok' | 'error' | 'checking'

export interface ServiceHealth {
  django: ServiceStatus
  ai: ServiceStatus
  data: ServiceStatus
}

const POLL_MS = 60_000

async function fetchHealth(): Promise<Omit<ServiceHealth, 'data'>> {
  const res = await fetch('/api/health/', { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return { django: 'error', ai: 'error' }
  const data = await res.json()
  const checks = data?.checks ?? {}
  return {
    django: checks.django?.status === 'ok' ? 'ok' : 'error',
    ai: checks.ai_service?.status === 'ok' ? 'ok' : 'error',
  }
}

async function fetchDataStatus(): Promise<ServiceStatus> {
  const res = await fetch('/api/incidents/?status=active&limit=1', { signal: AbortSignal.timeout(6000) })
  if (!res.ok) return 'error'
  const body = await res.json()
  const items: unknown[] = Array.isArray(body) ? body : (body?.results ?? [])
  return items.length > 0 ? 'ok' : 'error'
}

export function useServiceHealth(): ServiceHealth {
  const [health, setHealth] = useState<ServiceHealth>({ django: 'checking', ai: 'checking', data: 'checking' })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const [services, data] = await Promise.allSettled([fetchHealth(), fetchDataStatus()])
      if (cancelled) return
      const s = services.status === 'fulfilled' ? services.value : { django: 'error' as ServiceStatus, ai: 'error' as ServiceStatus }
      const d = data.status === 'fulfilled' ? data.value : 'error' as ServiceStatus
      setHealth({ ...s, data: d })
    }

    void check()
    const id = window.setInterval(() => void check(), POLL_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  return health
}
