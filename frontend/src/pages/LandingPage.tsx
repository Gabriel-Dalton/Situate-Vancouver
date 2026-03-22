import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'

const PITCH_TEXT =
  'Situate Vancouver is a lightweight, map-based platform that turns real-time city data into clear, human explanations of what is happening, where it is affecting people, and what will happen next.'

export default function LandingPage() {
  const [toast, setToast] = useState('')

  const copyPitch = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PITCH_TEXT)
      setToast('Copied')
    } catch {
      setToast('Copy manually')
    }
    window.setTimeout(() => setToast(''), 2200)
  }, [])

  return (
    <div className="landing-page">
      <div className="landing-page__container">
      <header className="landing-page__header">
        <div className="landing-page__brand">
          <span className="landing-page__mark" aria-hidden />
          <span className="landing-page__name">Situate Vancouver</span>
        </div>
        <nav className="landing-page__nav" aria-label="Main navigation">
          <a href="#features" className="landing-page__link">
            Features
          </a>
          <a href="#about" className="landing-page__link">
            About
          </a>
          <Link to="/map" className="landing-page__cta">
            Open map
          </Link>
        </nav>
      </header>

      <section className="landing-page__hero">
        <span className="landing-page__badge">City intelligence platform</span>
        <h1 className="landing-page__title">Understand your city, instantly.</h1>
        <p className="landing-page__desc">
          A real-time map that turns open city data into clear, human explanations of what is happening, where it
          matters, and what comes next.
        </p>
        <div className="landing-page__actions">
          <Link to="/map" className="landing-page__btn landing-page__btn--primary">
            Open the map
            <svg className="landing-page__btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <a href="#about" className="landing-page__btn landing-page__btn--secondary">
            How it works
          </a>
        </div>
      </section>

      <div className="landing-page__features" id="features">
        <div className="landing-page__feature">
          <span className="landing-page__feature-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <path d="M12 5v2M12 17v2M5 12h2M17 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <p className="landing-page__feature-name">Real-time data</p>
          <p className="landing-page__feature-text">Live context from open data feeds, built for everyone.</p>
        </div>
        <div className="landing-page__feature">
          <span className="landing-page__feature-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <p className="landing-page__feature-name">Clear insights</p>
          <p className="landing-page__feature-text">See what is happening, where, and what it means next.</p>
        </div>
        <div className="landing-page__feature">
          <span className="landing-page__feature-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2 3 14h8l-1 8L21 10h-8l1-8Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="landing-page__feature-name">Lightweight</p>
          <p className="landing-page__feature-text">Fast pages, minimal footprint, data where you need it.</p>
        </div>
      </div>

      <div className="landing-page__split" id="about">
        <div className="landing-page__card">
          <p className="landing-page__card-label">Pitch</p>
          <p className="landing-page__card-body">{PITCH_TEXT}</p>
          <div className="landing-page__card-actions">
            <button type="button" className="landing-page__btn landing-page__btn--secondary landing-page__btn--small" onClick={copyPitch}>
              Copy pitch
            </button>
            <span className={`landing-page__toast ${toast ? 'landing-page__toast--on' : ''}`} role="status" aria-live="polite">
              {toast}
            </span>
          </div>
        </div>

        <div className="landing-page__card">
          <div className="landing-page__sustain-head">
            <p className="landing-page__sustain-title">Sustainable by design</p>
            <span className="landing-page__sustain-badge">Carbon aware</span>
          </div>
          <p className="landing-page__sustain-copy">
            We keep the experience <strong>lightweight</strong> so maps load quickly and use less energy. Offset and
            efficiency details can plug in here as your program matures.
          </p>
        </div>
      </div>

      <footer className="landing-page__footer">
        <span className="landing-page__footer-copy">&copy; {new Date().getFullYear()} Situate Vancouver</span>
        <nav className="landing-page__footer-links" aria-label="Footer navigation">
          <a href="https://github.com" className="landing-page__footer-link" rel="noreferrer">
            GitHub
          </a>
          <a href="mailto:hello@example.com" className="landing-page__footer-link">
            Contact
          </a>
        </nav>
      </footer>
      </div>
    </div>
  )
}
