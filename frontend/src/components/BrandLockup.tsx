import '../brand-lockup.css'

const LOGO_SRC = '/situate-vancouver-logo-standard-icon.svg'

type BrandLockupProps = {
  className?: string
  /** Light wordmark for dark headers / chrome. */
  variant?: 'default' | 'onDark'
  /** When set, the lockup renders as a link. */
  href?: string
}

/**
 * Horizontal lockup: geometric icon + "SITUATE VANCOUVER".
 */
export default function BrandLockup({ className, variant = 'default', href }: BrandLockupProps) {
  const rootClass = ['brand-lockup', 'notranslate', variant === 'onDark' && 'brand-lockup--on-dark', className]
    .filter(Boolean)
    .join(' ')

  const inner = (
    <>
      <div className="brand-lockup__icon-wrap" aria-hidden>
        <img src={LOGO_SRC} alt="" width={42} height={42} decoding="async" />
      </div>
      <span className="brand-lockup__wordmark" aria-hidden>
        Situate Vancouver
      </span>
    </>
  )

  if (href) {
    return (
      <a className={rootClass} href={href} aria-label="Situate Vancouver" translate="no">
        {inner}
      </a>
    )
  }

  return (
    <div className={rootClass} role="img" aria-label="Situate Vancouver" translate="no">
      {inner}
    </div>
  )
}
