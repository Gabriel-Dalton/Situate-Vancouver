import { useEffect, useState } from 'react'

export type ServiceStatus = 'ok' | 'error' | 'checking'

export interface ServiceHealth {
  django: ServiceStatus
  ai: ServiceStatus
}

const POLL_MS = 60_000

async function fetchHealth(): Promise<ServiceHealth> {
  const res = await fetch('/api/health/', { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return { django: 'error', ai: 'error' }
  const data = await res.json()
  const checks = data?.checks ?? {}
  return {
    django: checks.django?.status === 'ok' ? 'ok' : 'error',
    ai: checks.ai_service?.status === 'ok' ? 'ok' : 'error',
  }
}

export function useServiceHealth(): ServiceHealth {
  const [health, setHealth] = useState<ServiceHealth>({ django: 'checking', ai: 'checking' })

  useEffect(() => {
    let cancelled = false

    const check = () => {
      fetchHealth()
        .then((h) => { if (!cancelled) setHealth(h) })
        .catch(() => { if (!cancelled) setHealth({ django: 'error', ai: 'error' }) })
    }

    check()
    const id = window.setInterval(check, POLL_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  return health
}
