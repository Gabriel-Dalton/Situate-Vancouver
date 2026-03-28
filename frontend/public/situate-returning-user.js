/**
 * Returning-user routing for the static marketing page vs the map app (issue: skip landing for return visits).
 * - Loading /app.html marks the browser as "returning" (localStorage).
 * - Loading / or /index.html redirects to /app.html when that marker is set.
 * Sync script in <head> on both entry HTML files; keep paths root-relative for default deploy.
 */
;(function () {
  var STORAGE_KEY = 'situate_returning'
  var raw = window.location.pathname || '/'
  var path = raw.length > 1 && raw[raw.length - 1] === '/' ? raw.slice(0, -1) : raw

  var isApp = path === '/app.html' || path.endsWith('/app.html')
  var isLanding =
    path === '/' || path === '' || path === '/index.html' || path.endsWith('/index.html')

  try {
    if (isApp) {
      localStorage.setItem(STORAGE_KEY, '1')
      return
    }
    if (isLanding && localStorage.getItem(STORAGE_KEY) === '1') {
      window.location.replace('/app.html')
    }
  } catch (_e) {
    /* Storage unavailable (private mode, policy) — show the requested page. */
  }
})()
