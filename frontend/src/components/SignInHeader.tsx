import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE } from '../lib/api'
import { authTokens, refreshAccessToken } from '../services/api'

const BASE = `${API_BASE}/api`
const USER_EMAIL_KEY = 'situate_user_email'

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

export default function SignInHeader() {
  const [modalOpen, setModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthModalMode>('signup')
  const [userEmail, setUserEmail] = useState<string | null>(() =>
    localStorage.getItem(USER_EMAIL_KEY),
  )
  const titleId = useId()

  // On mount — silently restore session from the httpOnly refresh cookie
  useEffect(() => {
    const storedEmail = localStorage.getItem(USER_EMAIL_KEY)
    if (!storedEmail) return  // not previously signed in
    if (authTokens.getAccess()) return  // already have an access token in memory

    refreshAccessToken().catch(() => {
      // Refresh cookie expired or invalid — clear the stored email
      localStorage.removeItem(USER_EMAIL_KEY)
      setUserEmail(null)
    })
  }, [])

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
    setUserEmail(null)
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [modalOpen, closeModal])

  return (
    <>
      <div className="sign-in-header">
        {userEmail ? (
          <>
            <span className="sign-in-header__session" title={userEmail}>
              <span className="sign-in-header__session-dot" aria-hidden />
              <span className="sign-in-header__session-email">{truncateEmail(userEmail)}</span>
            </span>
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
            onSignedIn={(email) => {
              localStorage.setItem(USER_EMAIL_KEY, email)
              setUserEmail(email)
              setModalOpen(false)
            }}
          />,
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
  onSignedIn,
}: {
  titleId: string
  mode: AuthModalMode
  onModeChange: (m: AuthModalMode) => void
  onClose: () => void
  onSignedIn: (email: string) => void
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? data.non_field_errors?.[0] ?? 'Incorrect email or password.')
        return
      }
      authTokens.set(data.access, data.refresh)
      onSignedIn(trimmed)
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
      authTokens.set(data.access, data.refresh)
      onSignedIn(trimmed)
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
