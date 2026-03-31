import { useCallback, useEffect, useRef, useState } from 'react'
import type { RouteOption } from '../services/routeService'

// Use Capacitor geolocation on native (proper permission dialog + background location).
// Fall back to browser geolocation API on web.
// Detect native at runtime via the Capacitor bridge rather than a top-level await.
import { Geolocation as CapGeolocation } from '@capacitor/geolocation'

const isNative = typeof window !== 'undefined'
  && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.()

const capGeo = isNative ? CapGeolocation : null

export interface NavigationState {
  active: boolean
  currentStepIndex: number
  position: { lat: number; lng: number; heading: number | null } | null
  remainingDistance: number  // metres to end of route
}

const STEP_ADVANCE_THRESHOLD_M = 35

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useNavigation(route: RouteOption | null) {
  const [state, setState] = useState<NavigationState>({
    active: false,
    currentStepIndex: 0,
    position: null,
    remainingDistance: 0,
  })

  const watchIdRef = useRef<string | number | null>(null)
  const stepIndexRef = useRef(0)

  const handlePosition = useCallback(
    (lat: number, lng: number, heading: number | null, steps: RouteOption['steps']) => {
      let idx = stepIndexRef.current
      while (idx < steps.length - 1) {
        const next = steps[idx + 1]
        if (haversineM(lat, lng, next.lat, next.lng) < STEP_ADVANCE_THRESHOLD_M) {
          idx++
        } else {
          break
        }
      }
      stepIndexRef.current = idx

      const remaining = steps.slice(idx).reduce((sum, s) => sum + s.distance_m, 0)

      setState({
        active: true,
        currentStepIndex: idx,
        position: { lat, lng, heading },
        remainingDistance: remaining,
      })
    },
    [],
  )

  const start = useCallback(async () => {
    if (!route) return
    stepIndexRef.current = 0
    setState((s) => ({
      ...s,
      active: true,
      currentStepIndex: 0,
      remainingDistance: route.distance_km * 1000,
    }))

    if (capGeo) {
      // Native — request permission explicitly so the system dialog shows
      const perm = await capGeo.requestPermissions({ permissions: ['location'] })
      if (perm.location !== 'granted') {
        console.warn('useNavigation: location permission denied')
        setState((s) => ({ ...s, active: false }))
        return
      }

      const watchId = await capGeo.watchPosition(
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
        (pos, err) => {
          if (err || !pos) {
            console.warn('useNavigation: position error', err)
            return
          }
          handlePosition(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.heading,
            route.steps,
          )
        },
      )
      watchIdRef.current = watchId
    } else {
      // Web fallback
      if (!navigator.geolocation) return
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          handlePosition(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.heading,
            route.steps,
          )
        },
        (err) => console.warn('useNavigation: geolocation error', err.message),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
      )
    }
  }, [route, handlePosition])

  const stop = useCallback(async () => {
    if (watchIdRef.current !== null) {
      if (capGeo) {
        await capGeo.clearWatch({ id: watchIdRef.current as string })
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current as number)
      }
      watchIdRef.current = null
    }
    stepIndexRef.current = 0
    setState({ active: false, currentStepIndex: 0, position: null, remainingDistance: 0 })
  }, [])

  // Clean up on unmount or route change
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        if (capGeo) {
          void capGeo.clearWatch({ id: watchIdRef.current as string })
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current as number)
        }
        watchIdRef.current = null
      }
    }
  }, [route])

  return { state, start, stop }
}
