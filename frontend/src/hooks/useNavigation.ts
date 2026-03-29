import { useCallback, useEffect, useRef, useState } from 'react'
import type { RouteOption } from '../services/routeService'

export interface NavigationState {
  active: boolean
  currentStepIndex: number
  position: { lat: number; lng: number; heading: number | null } | null
  remainingDistance: number  // metres to end of route
}

const STEP_ADVANCE_THRESHOLD_M = 35  // advance step when within 35m of waypoint

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

  const watchIdRef = useRef<number | null>(null)
  const stepIndexRef = useRef(0)

  const start = useCallback(() => {
    if (!route || !navigator.geolocation) return
    stepIndexRef.current = 0
    setState((s) => ({ ...s, active: true, currentStepIndex: 0, remainingDistance: route.distance_km * 1000 }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading } = pos.coords
        const steps = route.steps

        // Advance steps when close enough to next waypoint
        let idx = stepIndexRef.current
        while (idx < steps.length - 1) {
          const next = steps[idx + 1]
          const dist = haversineM(lat, lng, next.lat, next.lng)
          if (dist < STEP_ADVANCE_THRESHOLD_M) {
            idx++
          } else {
            break
          }
        }
        stepIndexRef.current = idx

        // Estimate remaining distance (sum of remaining step distances)
        const remaining = steps
          .slice(idx)
          .reduce((sum, s) => sum + s.distance_m, 0)

        setState({
          active: true,
          currentStepIndex: idx,
          position: { lat, lng, heading },
          remainingDistance: remaining,
        })
      },
      (err) => console.warn('Geolocation error:', err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
    )
  }, [route])

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    stepIndexRef.current = 0
    setState({ active: false, currentStepIndex: 0, position: null, remainingDistance: 0 })
  }, [])

  // Clean up on unmount or route change
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [route])

  return { state, start, stop }
}
