import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE } from '../lib/api'
import { USER_EMAIL_KEY } from '../config/authSession'
import { authTokens, refreshAccessToken } from '../services/api'
import { accountService } from '../services/accountService'
import { findRoute, routeService } from '../services/routeService'

type AuthModalMode = 'signin' | 'signup'

function truncateEmail(s: string, max = 22): string {
  if (s.length <= max) return s
  const [user, domain] = s.split('@')
  if (!domain) return s.slice(0, max - 1) + '…'
  return `${user.slice(0, 8)}…@${domain}`
}

function IconAccountGlyph() {
  return (
    <svg
      className="sign-in-header__icon-glyph"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

const BASE = `${API_BASE}/api`

type SignInHeaderProps = {
  onAuthEmailChange?: (email: string | null) => void
}

export default function SignInHeader({ onAuthEmailChange }: SignInHeaderProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthModalMode>('signup')
  const [userEmail, setUserEmail] = useState<string | null>(() =>
    localStorage.getItem(USER_EMAIL_KEY),
  )
  const titleId = useId()

  // On mount — silently restore session from the httpOnly refresh cookie
  const setSessionEmail = useCallback((email: string | null) => {
    setUserEmail(email)
    onAuthEmailChange?.(email)
  }, [onAuthEmailChange])

  useEffect(() => {
    const storedEmail = localStorage.getItem(USER_EMAIL_KEY)
    if (!storedEmail) return  // not previously signed in
    if (authTokens.getAccess()) return  // already have an access token in memory

    refreshAccessToken().catch(() => {
      // Refresh cookie expired or invalid — clear the stored email
      localStorage.removeItem(USER_EMAIL_KEY)
      setSessionEmail(null)
    })
  }, [setSessionEmail])

  const openAccountModal = useCallback(() => {
    setAuthMode('signup')
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => setModalOpen(false), [])

  const signOut = useCallback(async () => {
    // Backend blacklists the refresh cookie and clears it
    await fetch(`${BASE}/auth/logout/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authTokens.getAccess() ? { Authorization: `Bearer ${authTokens.getAccess()}` } : {}),
      },
    }).catch(() => {})
    authTokens.clear()
    localStorage.removeItem(USER_EMAIL_KEY)
    setSessionEmail(null)
  }, [setSessionEmail])

  useEffect(() => {
    if (!modalOpen && !accountOpen && !onboardingOpen && !forgotOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setModalOpen(false)
      setAccountOpen(false)
      setOnboardingOpen(false)
      setForgotOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [accountOpen, forgotOpen, modalOpen, onboardingOpen])

  return (
    <>
      <div className="sign-in-header">
        {userEmail ? (
          <>
            <span className="sign-in-header__session" title={userEmail}>
              <span className="sign-in-header__session-dot" aria-hidden />
              <span className="sign-in-header__session-email">{truncateEmail(userEmail)}</span>
            </span>
            <button type="button" className="sign-in-header__btn sign-in-header__btn--ghost" onClick={() => setAccountOpen(true)}>
              Account
            </button>
            <button type="button" className="sign-in-header__btn sign-in-header__btn--ghost" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            className="sign-in-header__icon-btn"
            onClick={openAccountModal}
            title="Account — sign in or create account"
            aria-label="Account: sign in or create account"
          >
            <IconAccountGlyph />
          </button>
        )}
      </div>

      {modalOpen &&
        createPortal(
          <AuthModal
            titleId={titleId}
            mode={authMode}
            onModeChange={setAuthMode}
            onClose={closeModal}
            onForgotPassword={() => {
              setModalOpen(false)
              setForgotOpen(true)
            }}
            onSignedIn={(email, onboardingRequired) => {
              localStorage.setItem(USER_EMAIL_KEY, email)
              setSessionEmail(email)
              setModalOpen(false)
              if (onboardingRequired) setOnboardingOpen(true)
            }}
          />,
          document.body,
        )}
      {accountOpen &&
        createPortal(
          <AccountModal titleId={titleId} onClose={() => setAccountOpen(false)} />,
          document.body,
        )}
      {onboardingOpen &&
        createPortal(
          <OnboardingModal
            titleId={titleId}
            onClose={() => setOnboardingOpen(false)}
          />,
          document.body,
        )}
      {forgotOpen &&
        createPortal(
          <ForgotPasswordModal titleId={titleId} onClose={() => setForgotOpen(false)} />,
          document.body,
        )}
    </>
  )
}

function AuthModal({
  titleId,
  mode,
  onModeChange,
  onClose,
  onForgotPassword,
  onSignedIn,
}: {
  titleId: string
  mode: AuthModalMode
  onModeChange: (m: AuthModalMode) => void
  onClose: () => void
  onForgotPassword: () => void
  onSignedIn: (email: string, onboardingRequired: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailInputRef.current?.focus()
    setError(null)
  }, [mode])

  const handleSignIn = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) { setError('Enter a valid email address.'); return }
    if (!password) { setError('Password is required.'); return }

    setLoading(true)
    try {
      const res = await fetch(`${BASE}/auth/login/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? data.non_field_errors?.[0] ?? 'Incorrect email or password.')
        return
      }
      authTokens.set(data.access)
      onSignedIn(trimmed, false)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) { setError('Enter a valid email address.'); return }
    if (!password) { setError('Password is required.'); return }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const res = await fetch(`${BASE}/auth/register/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          data.email?.[0] ??
          data.password?.[0] ??
          data.detail ??
          'Registration failed. Please try again.'
        setError(msg)
        return
      }
      authTokens.set(data.access)
      onSignedIn(trimmed, true)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'signin' ? 'Sign in' : 'Create account'

  return (
    <div className="sign-in-modal-backdrop" role="presentation" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sign-in-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sign-in-modal__head">
          <h2 id={titleId} className="sign-in-modal__title">{title}</h2>
          <button type="button" className="sign-in-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="sign-in-modal__tabs" role="tablist" aria-label="Account">
          <button
            type="button" role="tab"
            aria-selected={mode === 'signup'}
            id="auth-tab-signup" aria-controls="auth-panel-signup"
            className={'sign-in-modal__tab' + (mode === 'signup' ? ' sign-in-modal__tab--active' : '')}
            onClick={() => onModeChange('signup')}
          >
            Create account
          </button>
          <button
            type="button" role="tab"
            aria-selected={mode === 'signin'}
            id="auth-tab-signin" aria-controls="auth-panel-signin"
            className={'sign-in-modal__tab' + (mode === 'signin' ? ' sign-in-modal__tab--active' : '')}
            onClick={() => onModeChange('signin')}
          >
            Sign in
          </button>
        </div>

        <p className="sign-in-modal__lede">
          Save your usual routes and commutes — we'll surface traffic and incidents along your trips.
        </p>

        {mode === 'signin' ? (
          <form id="auth-panel-signin" role="tabpanel" aria-labelledby="auth-tab-signin"
            className="sign-in-modal__form" onSubmit={handleSignIn} noValidate>
            <label className="sign-in-modal__label">
              <span>Email</span>
              <input ref={emailInputRef} className="sign-in-modal__input" type="email"
                name="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="sign-in-modal__label">
              <span>Password</span>
              <input className="sign-in-modal__input" type="password"
                name="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </label>
            {error && <p className="sign-in-modal__error" role="alert">{error}</p>}
            <div className="sign-in-modal__actions">
              <button type="submit" className="sign-in-modal__submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" className="sign-in-modal__secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="sign-in-modal__secondary" onClick={onForgotPassword}>
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <form id="auth-panel-signup" role="tabpanel" aria-labelledby="auth-tab-signup"
            className="sign-in-modal__form" onSubmit={handleSignUp} noValidate>
            <label className="sign-in-modal__label">
              <span>Email</span>
              <input ref={emailInputRef} className="sign-in-modal__input" type="email"
                name="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="sign-in-modal__label">
              <span>Password</span>
              <input className="sign-in-modal__input" type="password"
                name="new-password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </label>
            <label className="sign-in-modal__label">
              <span>Confirm password</span>
              <input className="sign-in-modal__input" type="password"
                name="confirm-password" autoComplete="new-password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
            </label>
            {error && <p className="sign-in-modal__error" role="alert">{error}</p>}
            <div className="sign-in-modal__actions">
              <button type="submit" className="sign-in-modal__submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
              <button type="button" className="sign-in-modal__secondary" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const LEAD_PRESETS = [15, 30, 60, 90]

function AccountModal({
  titleId,
  onClose,
}: {
  titleId: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [notifyVia, setNotifyVia] = useState<'email' | 'push' | 'sms'>('push')
  const [leadMinutes, setLeadMinutes] = useState(30)
  const [emailVerified, setEmailVerified] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)
  const [verifySent, setVerifySent] = useState(false)
  const [homeAddress, setHomeAddress] = useState('')
  const [homeGeocoding, setHomeGeocoding] = useState(false)
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [homeGeoError, setHomeGeoError] = useState<string | null>(null)

  useEffect(() => {
    accountService
      .getMe()
      .then((data) => {
        setFirstName(data.user.first_name ?? '')
        setLastName(data.user.last_name ?? '')
        setPhone(data.profile.phone ?? '')
        setNotifyVia(data.profile.notify_via)
        setLeadMinutes(data.profile.alert_lead_minutes)
        setEmailVerified(data.profile.email_verified)
        setHomeAddress(data.profile.home_label ?? '')
        if (data.profile.home_lat != null && data.profile.home_lng != null) {
          setHomeCoords({ lat: data.profile.home_lat, lng: data.profile.home_lng })
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load account details.'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await accountService.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        notify_via: notifyVia,
        alert_lead_minutes: leadMinutes,
        home_label: homeAddress.trim(),
        home_lat: homeCoords?.lat ?? null,
        home_lng: homeCoords?.lng ?? null,
      })
      setSaved(true)
      setTimeout(() => onClose(), 900)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save preferences.')
    } finally {
      setSaving(false)
    }
  }

  const lookupHomeAddress = async () => {
    const trimmed = homeAddress.trim()
    if (!trimmed) return
    setHomeGeocoding(true)
    setHomeGeoError(null)
    const result = await geocodeAddress(trimmed)
    setHomeGeocoding(false)
    if (!result) {
      setHomeGeoError('Address not found — try adding the city or street number.')
      setHomeCoords(null)
      return
    }
    setHomeCoords({ lat: result.lat, lng: result.lng })
    setHomeAddress(result.label)
  }

  const requestVerification = async () => {
    setVerifyMessage(null)
    setVerifySent(false)
    try {
      const data = await accountService.requestEmailVerification()
      setVerifySent(true)
      setVerifyMessage(data.detail)
    } catch (e) {
      setVerifyMessage(e instanceof Error ? e.message : 'Could not send verification email.')
    }
  }

  return (
    <div className="sign-in-modal-backdrop" role="presentation" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="sign-in-modal account-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sign-in-modal__head">
          <h2 id={titleId} className="sign-in-modal__title">Preferences</h2>
          <button type="button" className="sign-in-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sign-in-modal__form">
          {loading ? (
            <p className="sign-in-modal__lede">Loading…</p>
          ) : (
            <>
              {/* ── Profile ── */}
              <p className="account-modal__section">Profile</p>
              <div className="account-modal__row">
                <label className="sign-in-modal__label">
                  <span>First name</span>
                  <input className="sign-in-modal__input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" />
                </label>
                <label className="sign-in-modal__label">
                  <span>Last name</span>
                  <input className="sign-in-modal__input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" />
                </label>
              </div>
              <label className="sign-in-modal__label">
                <span>Phone <em className="account-modal__optional">for SMS alerts</em></span>
                <input className="sign-in-modal__input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 604 123 4567" />
              </label>
              <div className="sign-in-modal__label">
                <span>Home address <em className="account-modal__optional">for nearby alerts</em></span>
                <div className="account-modal__addr-row">
                  <input
                    className="sign-in-modal__input account-modal__addr-input"
                    value={homeAddress}
                    onChange={(e) => { setHomeAddress(e.target.value); setHomeCoords(null); setHomeGeoError(null) }}
                    placeholder="e.g. 1234 Granville St, Vancouver"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lookupHomeAddress() } }}
                  />
                  <button type="button" className="account-modal__addr-btn" onClick={() => void lookupHomeAddress()} disabled={homeGeocoding || !homeAddress.trim()} title="Look up address">
                    {homeGeocoding ? '…' : homeCoords ? '✓' : '↵'}
                  </button>
                </div>
                {homeGeoError && <p className="sign-in-modal__error">{homeGeoError}</p>}
              </div>

              {/* ── Email ── */}
              <p className="account-modal__section">Email</p>
              <div className="account-modal__verify-row">
                <span className={`account-modal__verify-badge${emailVerified ? ' account-modal__verify-badge--ok' : ''}`}>
                  {emailVerified ? '✓ Verified' : 'Not verified'}
                </span>
                {!emailVerified && !verifySent && (
                  <button type="button" className="sign-in-modal__secondary account-modal__verify-btn" onClick={() => void requestVerification()}>
                    Send verification email
                  </button>
                )}
              </div>
              {verifyMessage && (
                <p className="sign-in-modal__lede account-modal__verify-msg">{verifyMessage}</p>
              )}

              {/* ── Notifications ── */}
              <p className="account-modal__section">Notifications</p>
              <div className="sign-in-modal__label">
                <span>Alert channel</span>
                <div className="account-modal__radio-group">
                  {(['push', 'email', 'sms'] as const).map((ch) => (
                    <label key={ch} className={`account-modal__radio${notifyVia === ch ? ' account-modal__radio--active' : ''}`}>
                      <input type="radio" name="notify_via" value={ch} checked={notifyVia === ch} onChange={() => setNotifyVia(ch)} />
                      {ch === 'push' ? 'Push' : ch === 'email' ? 'Email' : 'SMS'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="sign-in-modal__label">
                <span>Alert me <strong className="account-modal__lead-val">{leadMinutes} min</strong> before disruptions</span>
                <div className="account-modal__lead-row">
                  {LEAD_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`account-modal__preset${leadMinutes === m ? ' account-modal__preset--active' : ''}`}
                      onClick={() => setLeadMinutes(m)}
                    >
                      {m}m
                    </button>
                  ))}
                  <input
                    type="number"
                    className="sign-in-modal__input account-modal__lead-custom"
                    min={5}
                    max={180}
                    value={leadMinutes}
                    onChange={(e) => setLeadMinutes(Number(e.target.value) || 30)}
                    aria-label="Custom minutes"
                  />
                </div>
              </div>

              {error && <p className="sign-in-modal__error">{error}</p>}
              <div className="sign-in-modal__actions">
                <button
                  type="button"
                  className={`sign-in-modal__submit${saved ? ' account-modal__submit--saved' : ''}`}
                  onClick={() => void save()}
                  disabled={saving || saved}
                >
                  {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save preferences'}
                </button>
                <button type="button" className="sign-in-modal__secondary" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'ca',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'SituateVancouver/1.0' },
    })
    const results = await res.json() as Array<{ lat: string; lon: string; display_name: string }>
    if (!results.length) return null
    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      label: results[0].display_name,
    }
  } catch {
    return null
  }
}

function OnboardingModal({
  titleId,
  onClose,
}: {
  titleId: string
  onClose: () => void
}) {
  const [step, setStep] = useState<'home' | 'route'>('home')
  // Home address
  const [homeAddress, setHomeAddress] = useState('')
  const [homeGeocoding, setHomeGeocoding] = useState(false)
  const [homeGeocodedLabel, setHomeGeocodedLabel] = useState<string | null>(null)
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [homeError, setHomeError] = useState<string | null>(null)
  // Route
  const [name, setName] = useState('My commute')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureTime, setDepartureTime] = useState('08:30')
  const [notifyVia, setNotifyVia] = useState<'email' | 'push' | 'sms'>('push')
  const [leadMinutes, setLeadMinutes] = useState(30)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const geocodeHome = async () => {
    const trimmed = homeAddress.trim()
    if (!trimmed) { setStep('route'); return }
    setHomeGeocoding(true)
    setHomeError(null)
    const result = await geocodeAddress(trimmed)
    setHomeGeocoding(false)
    if (!result) {
      setHomeError('Could not find that address — try being more specific, e.g. "1234 Main St, Vancouver"')
      return
    }
    setHomeCoords({ lat: result.lat, lng: result.lng })
    setHomeGeocodedLabel(result.label)
    setStep('route')
  }

  const complete = async () => {
    setError(null)
    setLoading(true)
    try {
      await accountService.updateMe({
        notify_via: notifyVia,
        alert_lead_minutes: leadMinutes,
        ...(homeCoords
          ? { home_label: homeGeocodedLabel ?? homeAddress.trim(), home_lat: homeCoords.lat, home_lng: homeCoords.lng }
          : {}),
      })
      if (origin.trim() && destination.trim()) {
        const routeResult = await findRoute(origin.trim(), destination.trim())
        await routeService.create({
          name: name.trim() || 'My commute',
          origin_label: origin.trim(),
          origin_lat: routeResult.origin_lat,
          origin_lng: routeResult.origin_lng,
          destination_label: destination.trim(),
          destination_lat: routeResult.dest_lat,
          destination_lng: routeResult.dest_lng,
          departure_time: departureTime,
          active_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          is_active: true,
        })
        window.dispatchEvent(new CustomEvent('saved-routes-updated'))
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish onboarding.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sign-in-modal-backdrop" role="presentation" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="sign-in-modal account-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sign-in-modal__head">
          <h2 id={titleId} className="sign-in-modal__title">Set up your account</h2>
          <button type="button" className="sign-in-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {step === 'home' ? (
          <>
            <p className="sign-in-modal__lede">
              Where do you live? We'll use this to surface nearby incidents and calibrate your alerts.
            </p>
            <div className="sign-in-modal__form">
              <label className="sign-in-modal__label">
                <span>Home address</span>
                <input
                  className="sign-in-modal__input"
                  value={homeAddress}
                  onChange={(e) => { setHomeAddress(e.target.value); setHomeError(null) }}
                  placeholder="e.g. 1234 Granville St, Vancouver"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void geocodeHome() } }}
                />
              </label>
              {homeError && <p className="sign-in-modal__error">{homeError}</p>}
              <div className="sign-in-modal__actions">
                <button type="button" className="sign-in-modal__submit" onClick={() => void geocodeHome()} disabled={homeGeocoding}>
                  {homeGeocoding ? 'Looking up…' : 'Continue'}
                </button>
                <button type="button" className="sign-in-modal__secondary" onClick={() => setStep('route')}>Skip</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="sign-in-modal__lede">
              {homeGeocodedLabel
                ? <><strong className="account-modal__lead-val">Home set.</strong> Add your first commute route (optional) and choose alert preferences.</>
                : 'Add your first commute route (optional) and choose how early you want alerts.'}
            </p>
            <div className="sign-in-modal__form">
              <p className="account-modal__section">Route <em className="account-modal__optional">optional</em></p>
              <label className="sign-in-modal__label">
                <span>Route name</span>
                <input className="sign-in-modal__input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="sign-in-modal__label">
                <span>From</span>
                <input className="sign-in-modal__input" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. Kitsilano" />
              </label>
              <label className="sign-in-modal__label">
                <span>To</span>
                <input className="sign-in-modal__input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Downtown Vancouver" />
              </label>
              <label className="sign-in-modal__label">
                <span>Departure time</span>
                <input className="sign-in-modal__input" type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
              </label>

              <p className="account-modal__section">Notifications</p>
              <div className="sign-in-modal__label">
                <span>Alert channel</span>
                <div className="account-modal__radio-group">
                  {(['push', 'email', 'sms'] as const).map((ch) => (
                    <label key={ch} className={`account-modal__radio${notifyVia === ch ? ' account-modal__radio--active' : ''}`}>
                      <input type="radio" name="ob_notify_via" value={ch} checked={notifyVia === ch} onChange={() => setNotifyVia(ch)} />
                      {ch === 'push' ? 'Push' : ch === 'email' ? 'Email' : 'SMS'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="sign-in-modal__label">
                <span>Alert me <strong className="account-modal__lead-val">{leadMinutes} min</strong> before disruptions</span>
                <div className="account-modal__lead-row">
                  {LEAD_PRESETS.map((m) => (
                    <button key={m} type="button"
                      className={`account-modal__preset${leadMinutes === m ? ' account-modal__preset--active' : ''}`}
                      onClick={() => setLeadMinutes(m)}
                    >{m}m</button>
                  ))}
                  <input type="number" className="sign-in-modal__input account-modal__lead-custom"
                    min={5} max={180} value={leadMinutes}
                    onChange={(e) => setLeadMinutes(Number(e.target.value) || 30)}
                    aria-label="Custom minutes"
                  />
                </div>
              </div>

              {error && <p className="sign-in-modal__error">{error}</p>}
              <div className="sign-in-modal__actions">
                <button type="button" className="sign-in-modal__submit" onClick={() => void complete()} disabled={loading}>
                  {loading ? 'Saving…' : 'Finish setup'}
                </button>
                <button type="button" className="sign-in-modal__secondary" onClick={onClose}>Skip for now</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ForgotPasswordModal({
  titleId,
  onClose,
}: {
  titleId: string
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [uid, setUid] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const requestReset = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const data = await accountService.passwordForgot(email.trim().toLowerCase())
      if (data.dev_reset) {
        setUid(data.dev_reset.uid)
        setToken(data.dev_reset.token)
      }
      setMessage(data.detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not request password reset.')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const data = await accountService.passwordReset({
        uid: uid.trim(),
        token: token.trim(),
        new_password: newPassword,
      })
      setMessage(data.detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sign-in-modal-backdrop" role="presentation" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="sign-in-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sign-in-modal__head">
          <h2 id={titleId} className="sign-in-modal__title">Reset password</h2>
          <button type="button" className="sign-in-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="sign-in-modal__lede">
          Enter your account email to request reset instructions. In local debug mode, UID/token will be returned here.
        </p>
        <div className="sign-in-modal__form">
          <label className="sign-in-modal__label">
            <span>Email</span>
            <input
              className="sign-in-modal__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button type="button" className="sign-in-modal__secondary" onClick={() => void requestReset()} disabled={loading}>
            {loading ? 'Requesting…' : 'Request reset'}
          </button>
          <label className="sign-in-modal__label">
            <span>UID</span>
            <input className="sign-in-modal__input" value={uid} onChange={(e) => setUid(e.target.value)} />
          </label>
          <label className="sign-in-modal__label">
            <span>Token</span>
            <input className="sign-in-modal__input" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label className="sign-in-modal__label">
            <span>New password</span>
            <input
              className="sign-in-modal__input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          <button type="button" className="sign-in-modal__submit" onClick={() => void resetPassword()} disabled={loading}>
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
          {message && <p className="sign-in-modal__lede">{message}</p>}
          {error && <p className="sign-in-modal__error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
