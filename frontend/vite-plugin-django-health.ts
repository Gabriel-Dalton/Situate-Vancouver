import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/**
 * Handles GET /api/health/* in dev without the stock Vite proxy.
 * Forwards to Django so connection failures return JSON instead of ECONNREFUSED spam in the terminal.
 */
export function djangoHealthForwardPlugin(djangoTarget: string): Plugin {
  return {
    name: 'django-health-forward',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? ''
        if (req.method !== 'GET' || !raw.startsWith('/api/health')) {
          next()
          return
        }
        void forwardHealth(req, res, djangoTarget)
      })
    },
  }
}

async function forwardHealth(
  req: IncomingMessage,
  res: ServerResponse,
  djangoTarget: string,
): Promise<void> {
  const raw = req.url ?? '/'
  const q = raw.indexOf('?')
  const pathname = q >= 0 ? raw.slice(0, q) : raw
  const search = q >= 0 ? raw.slice(q) : ''
  const base = djangoTarget.replace(/\/$/, '')
  const upstream = `${base}${pathname}${search}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const r = await fetch(upstream, { signal: controller.signal })
    clearTimeout(timeout)
    const body = await r.text()
    res.statusCode = r.status
    const ct = r.headers.get('content-type')
    if (ct) res.setHeader('Content-Type', ct)
    res.end(body)
  } catch {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        status: 'unhealthy',
        service: 'django',
        checks: {
          django: {
            status: 'error',
            message: `Django is not reachable at ${base}. From the repo root run: cd backend && python manage.py runserver 0.0.0.0:8000 — or set API_PROXY_TARGET in .env to match your runserver port.`,
          },
        },
      }),
    )
  }
}
