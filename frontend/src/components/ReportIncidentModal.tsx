import { useState, useId, type FormEvent } from 'react'
import { incidentService } from '../services/incidentService'

interface Props {
  onClose: () => void
}

const INCIDENT_TYPES = [
  { value: 'traffic',         label: 'Traffic' },
  { value: 'accident',        label: 'Accident' },
  { value: 'construction',    label: 'Construction' },
  { value: 'obstruction',     label: 'Obstruction' },
  { value: 'weather',         label: 'Weather' },
  { value: 'natural_disaster', label: 'Wildfire' },
  { value: 'earthquake',      label: 'Earthquake' },
  { value: 'other',           label: 'Other' },
] as const

const SEVERITIES = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

export default function ReportIncidentModal({ onClose }: Props) {
  const titleId = useId()
  const [type, setType] = useState('traffic')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) { setError('Please add a short title.'); return }
    if (!location.trim()) { setError('Please enter a location.'); return }
    setSubmitting(true)
    try {
      await incidentService.create({
        incident_type: type,
        severity,
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        source: 'user',
        is_user_reported: true,
        status: 'unverified',
      })
      setSubmitted(true)
    } catch {
      setError('Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="sign-in-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sign-in-modal report-incident-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sign-in-modal__head">
          <h2 id={titleId} className="sign-in-modal__title">Report an incident</h2>
          <button type="button" className="sign-in-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {submitted ? (
          <div className="report-incident-modal__success">
            <span className="report-incident-modal__success-icon">✓</span>
            <p>Thanks — your report has been submitted for review.</p>
            <button type="button" className="sign-in-modal__submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="sign-in-modal__form" onSubmit={(e) => void handleSubmit(e)} noValidate>
            <div className="report-incident-modal__row">
              <label className="sign-in-modal__label">
                <span>Type</span>
                <select
                  className="sign-in-modal__input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {INCIDENT_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="sign-in-modal__label">
                <span>Severity</span>
                <select
                  className="sign-in-modal__input"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as typeof severity)}
                >
                  {SEVERITIES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="sign-in-modal__label">
              <span>Title</span>
              <input
                className="sign-in-modal__input"
                type="text"
                placeholder="e.g. Lane closure on Granville St"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </label>

            <label className="sign-in-modal__label">
              <span>Location</span>
              <input
                className="sign-in-modal__input"
                type="text"
                placeholder="Intersection, street, or neighbourhood"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
              />
            </label>

            <label className="sign-in-modal__label">
              <span>Details <span className="report-incident-modal__optional">(optional)</span></span>
              <textarea
                className="sign-in-modal__input report-incident-modal__textarea"
                placeholder="Any additional context…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </label>

            {error && <p className="sign-in-modal__error" role="alert">{error}</p>}

            <div className="sign-in-modal__actions">
              <button type="submit" className="sign-in-modal__submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
              <button type="button" className="sign-in-modal__secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
