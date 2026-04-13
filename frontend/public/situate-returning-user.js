/**
 * Returning-user routing for the static marketing page vs the map app.
 * - Loading /app.html marks the browser as "returning" (localStorage).
 * - Loading / or /index.html redirects to /app.html when that marker is set.
 * - Capacitor native shells (iOS / Android) always open the map app from the
 *   marketing URL: the WebView starts at / (index.html) before Capacitor may
 *   be defined, so we also poll briefly for window.Capacitor.
 * Sync script in <head> on both entry HTML files; keep paths root-relative for default deploy.
 */
;(function () {
  var STORAGE_KEY = 'situate_returning'
  var raw = window.location.pathname || '/'
  var path = raw.length > 1 && raw[raw.length - 1] === '/' ? raw.slice(0, -1) : raw

  var isApp = path === '/app.html' || path.endsWith('/app.html')
  var isLanding =
    path === '/' || path === '' || path === '/index.html' || path.endsWith('/index.html')

  var pollId = null

  function isCapacitorNative() {
    try {
      var c = window.Capacitor
      return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform())
    } catch (_e) {
      return false
    }
  }

  /** Android WebView (including Capacitor) — distinct from Chrome browser UA. */
  function looksLikeAndroidWebView() {
    try {
      var ua = navigator.userAgent || ''
      return /Android/i.test(ua) && /; wv\)/.test(ua)
    } catch (_e) {
      return false
    }
  }

  function redirectToApp() {
    try {
      window.location.replace('/app.html')
    } catch (_e) {
      window.location.href = '/app.html'
    }
  }

  function tryNativeShellRedirect() {
    if (!isCapacitorNative() && !looksLikeAndroidWebView()) return false
    if (pollId != null) {
      window.clearInterval(pollId)
      pollId = null
    }
    redirectToApp()
    return true
  }

  try {
    if (isApp) {
      localStorage.setItem(STORAGE_KEY, '1')
      return
    }
  } catch (_e) {
    /* Storage unavailable — still allow native redirect below. */
  }

  try {
    if (isLanding && localStorage.getItem(STORAGE_KEY) === '1') {
      redirectToApp()
      return
    }
  } catch (_e) {
    /* Storage unavailable — fall through to native detection. */
  }

  if (!isLanding) return

  if (tryNativeShellRedirect()) return

  var attempts = 0
  pollId = window.setInterval(function () {
    attempts += 1
    if (tryNativeShellRedirect()) return
    if (attempts >= 24 && pollId != null) {
      window.clearInterval(pollId)
      pollId = null
    }
  }, 25)
})()
