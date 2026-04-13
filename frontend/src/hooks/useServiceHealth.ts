import { useEffect, useState } from 'react'

export type ServiceStatus = 'ok' | 'error' | 'checking'

export interface ServiceHealth {
  django: ServiceStatus
  ai: ServiceStatus
  /** Vancouver Open Data (CKAN) — third light, matches `/api/health/` `vancouver_opendata`. */
  openData: ServiceStatus
}

const POLL_MS = 60_000

function checkToLightStatus(status: string | undefined): ServiceStatus {
  if (status === 'ok') return 'ok'
  if (status === 'skipped' || status === 'not_configured') return 'checking'
  return 'error'
}

async function fetchHealth(): Promise<ServiceHealth> {
  const res = await fetch('/api/health/', { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return { django: 'error', ai: 'error', openData: 'error' }
  const data = await res.json()
  const checks = data?.checks ?? {}
  return {
    django: checkToLightStatus(checks.django?.status),
    ai: checkToLightStatus(checks.ai_service?.status),
    openData: checkToLightStatus(checks.vancouver_opendata?.status),
  }
}

export function useServiceHealth(): ServiceHealth {
  const [health, setHealth] = useState<ServiceHealth>({
    django: 'checking',
    ai: 'checking',
    openData: 'checking',
  })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const result = await fetchHealth().catch(() => ({
        django: 'error' as ServiceStatus,
        ai: 'error' as ServiceStatus,
        openData: 'error' as ServiceStatus,
      }))
      if (cancelled) return
      setHealth(result)
    }

    void check()
    const id = window.setInterval(() => void check(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return health
}
