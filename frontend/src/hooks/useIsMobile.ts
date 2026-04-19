import { useEffect, useState } from 'react'

/**
 * Narrow portrait, or short viewports typical of phone landscape (wide but not tall).
 * Do not require `(hover: none)` — Safari’s Responsive Design Mode uses a fine pointer, and
 * without this the app fell back to the stacked “tablet” layout (rails under the map).
 * Keep in sync with mobile `@media` blocks in App.css, AiQuery.css, and VancouverMap.css.
 */
export const MOBILE_TOUCH_LAYOUT_MEDIA =
  '(max-width: 768px), (max-height: 560px) and (max-width: 1100px)'

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_TOUCH_LAYOUT_MEDIA).matches
      : false
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_TOUCH_LAYOUT_MEDIA)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return mobile
}
