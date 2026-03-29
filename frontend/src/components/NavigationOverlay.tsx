import type { NavigationState } from '../hooks/useNavigation'
import type { RouteOption } from '../services/routeService'

interface Props {
  state: NavigationState
  route: RouteOption
  onStop: () => void
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m)} m`
}

export default function NavigationOverlay({ state, route, onStop }: Props) {
  const step = route.steps[state.currentStepIndex]
  const nextStep = route.steps[state.currentStepIndex + 1]
  const isLast = state.currentStepIndex >= route.steps.length - 1

  return (
    <div className="nav-overlay" role="region" aria-label="Navigation">
      <div className="nav-overlay__current">
        <div className="nav-overlay__instruction">
          {isLast ? 'You have arrived' : step?.instruction ?? '—'}
        </div>
        {step && step.distance_m > 0 && !isLast && (
          <div className="nav-overlay__in">
            in {formatDistance(step.distance_m)}
          </div>
        )}
      </div>

      {nextStep && !isLast && (
        <div className="nav-overlay__next">
          <span className="nav-overlay__next-label">Then</span>
          <span className="nav-overlay__next-instruction">{nextStep.instruction}</span>
        </div>
      )}

      <div className="nav-overlay__footer">
        <span className="nav-overlay__remaining">
          {formatDistance(state.remainingDistance)} remaining
        </span>
        <button
          type="button"
          className="nav-overlay__stop"
          onClick={onStop}
        >
          End navigation
        </button>
      </div>
    </div>
  )
}
