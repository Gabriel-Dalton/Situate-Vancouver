import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SESSION_KEY = 'situate_session_email'

function truncateEmail(s: string, max = 22): string {
  if (s.length <= max) return s
  const [user, domain] = s.split('@')
  if (!domain) return s.slice(0, max - 1) + '…'
  return `${user.slice(0, 8)}…@${domain}`
}

export default function SignInHeader() {
  const [modalOpen, setModalOpen] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(() =>
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null,
  )
  const titleId = useId()

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setSessionEmail(null)
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [modalOpen, closeModal])

  const showSignedIn = Boolean(sessionEmail)

  return (
    <>
      <div className="sign-in-header">
        {showSignedIn ? (
          <>
            <span className="sign-in-header__session" title={sessionEmail ?? ''}>
              <span className="sign-in-header__session-dot" aria-hidden />
              <span className="sign-in-header__session-email">{truncateEmail(sessionEmail!)}</span>
            </span>
            <button type="button" className="sign-in-header__btn sign-in-header__btn--ghost" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className="sign-in-header__btn sign-in-header__btn--primary" onClick={openModal}>
            Sign in
          </button>
        )}
      </div>

      {modalOpen &&
        createPortal(
          <SignInModal
            titleId={titleId}
            onClose={closeModal}
            onSignedIn={(email) => {
              sessionStorage.setItem(SESSION_KEY, email)
              setSessionEmail(email)
              setModalOpen(false)
            }}
          />,
          document.body,
        )}
    </>
  )
}

function SignInModal({
  titleId,
  onClose,
  onSignedIn,
}: {
  titleId: string
  onClose: () => void
  onSignedIn: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) {
      setError('Password is required.')
      return
    }
    // UI-only until Django auth is wired — session is stored in this tab only.
    onSignedIn(trimmed)
    setPassword('')
  }

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
          <h2 id={titleId} className="sign-in-modal__title">
            Sign in
          </h2>
          <button type="button" className="sign-in-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="sign-in-modal__lede">
          Save your usual routes and commutes — when the service is connected, we can surface traffic and incidents along
          your trips.
        </p>
        <form className="sign-in-modal__form" onSubmit={handleSubmit} noValidate>
          <label className="sign-in-modal__label">
            <span>Email</span>
            <input
              ref={emailInputRef}
              className="sign-in-modal__input"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="sign-in-modal__label">
            <span>Password</span>
            <input
              className="sign-in-modal__input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {error ? (
            <p className="sign-in-modal__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sign-in-modal__actions">
            <button type="submit" className="sign-in-modal__submit">
              Sign in
            </button>
            <button type="button" className="sign-in-modal__secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
        <p className="sign-in-modal__footnote">
          Account backend is in progress — this sign-in updates your workspace preview in this browser tab only.
        </p>
      </div>
    </div>
  )
}
