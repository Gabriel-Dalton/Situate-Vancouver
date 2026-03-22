import http from 'node:http'
import https from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

/**
 * Handles GET /api/health/* in dev before the stock `/api` proxy.
 * If this ran after the proxy, a down Django would yield non-JSON errors and the UI could not parse status.
 */
export function djangoHealthForwardPlugin(
  djangoTarget: string,
  forwardHost?: string,
): Plugin {
  return {
    name: 'django-health-forward',
    enforce: 'pre',
    configureServer(server) {
      const handler: Connect.NextHandleFunction = (req, res, next) => {
        const raw = req.url ?? ''
        if (req.method !== 'GET' || !raw.startsWith('/api/health')) {
          next()
          return
        }
        void forwardHealth(req, res, djangoTarget, forwardHost)
      }

      const stack = (server.middlewares as Connect.Server & { stack?: Connect.ServerStackItem[] }).stack
      if (Array.isArray(stack)) {
        stack.unshift({ route: '', handle: handler })
      } else {
        server.middlewares.use(handler)
      }
    },
  }
}

async function forwardHealth(
  req: IncomingMessage,
  res: ServerResponse,
  djangoTarget: string,
  forwardHost?: string,
): Promise<void> {
  const raw = req.url ?? '/'
  const q = raw.indexOf('?')
  const pathname = q >= 0 ? raw.slice(0, q) : raw
  const search = q >= 0 ? raw.slice(q) : ''
  const base = djangoTarget.replace(/\/$/, '')
  const upstream = `${base}${pathname}${search}`

  try {
    if (forwardHost) {
      await forwardHealthWithHostHeader(upstream, forwardHost, res)
      return
    }
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
            message:
              'The app could not reach the server. Please try again in a few minutes.',
          },
        },
      }),
    )
  }
}

function forwardHealthWithHostHeader(
  upstreamUrl: string,
  hostHeader: string,
  res: ServerResponse,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const fail = () => {
      if (res.writableEnded) {
        done()
        return
      }
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          status: 'unhealthy',
          service: 'django',
          checks: {
            django: {
              status: 'error',
              message:
                'The app could not reach the server. Please try again in a few minutes.',
            },
          },
        }),
      )
      done()
    }

    let u: URL
    try {
      u = new URL(upstreamUrl)
    } catch {
      fail()
      return
    }

    const lib = u.protocol === 'https:' ? https : http
    const port = u.port || (u.protocol === 'https:' ? '443' : '80')
    const req = lib.request(
      {
        hostname: u.hostname,
        port,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        headers: { host: hostHeader },
        timeout: 5000,
      },
      (upstreamRes) => {
        const chunks: Buffer[] = []
        upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk))
        upstreamRes.on('end', () => {
          if (res.writableEnded) {
            done()
            return
          }
          res.statusCode = upstreamRes.statusCode ?? 502
          const ct = upstreamRes.headers['content-type']
          if (typeof ct === 'string') res.setHeader('Content-Type', ct)
          res.end(Buffer.concat(chunks))
          done()
        })
      },
    )
    req.on('error', fail)
    req.on('timeout', () => {
      req.destroy()
      fail()
    })
    req.end()
  })
}
