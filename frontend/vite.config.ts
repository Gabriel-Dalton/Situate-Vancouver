import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { djangoHealthForwardPlugin } from './vite-plugin-django-health'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

/**
 * Django origin for Vite `/api` proxy and health forward. Uses `API_PROXY_TARGET` when set;
 * otherwise `http://DJANGO_DEV_HOST:DJANGO_DEV_PORT` from repo-root `.env` (defaults 127.0.0.1:1111).
 * Strips a trailing `/api` so `/api/health/` is not requested as `/api/api/health/` (404).
 */
function resolveDjangoProxyOrigin(fileEnv: Record<string, string>): string {
  const explicit = (fileEnv.API_PROXY_TARGET || process.env.API_PROXY_TARGET || '').trim()
  const host = (fileEnv.DJANGO_DEV_HOST || '127.0.0.1').trim() || '127.0.0.1'
  const port = (fileEnv.DJANGO_DEV_PORT || '1111').trim() || '1111'
  let base = explicit || `http://${host}:${port}`
  base = base.replace(/\/+$/, '')
  if (base.endsWith('/api')) base = base.slice(0, -4)
  return base
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, repoRoot, '')
  const djangoTarget = resolveDjangoProxyOrigin(fileEnv)
  const prodHealthUrl = `${djangoTarget}/api/health/`
  const prodQueryUrl = `${djangoTarget}/api/query/`
  const aiTarget =
    fileEnv.AI_PROXY_TARGET || process.env.AI_PROXY_TARGET || 'http://127.0.0.1:8001'
  // Optional: Host header sent to Django (e.g. 127.0.0.1:1111) when API_PROXY_TARGET uses a public hostname.
  const apiProxyForwardHost =
    (fileEnv.API_PROXY_FORWARD_HOST || process.env.API_PROXY_FORWARD_HOST || '').trim() ||
    undefined
  const frontendHost =
    fileEnv.FRONTEND_DEV_HOST || process.env.FRONTEND_DEV_HOST || '127.0.0.1'
  const frontendPortRaw =
    fileEnv.FRONTEND_DEV_PORT || process.env.FRONTEND_DEV_PORT || '5173'
  const frontendPort = Number.parseInt(frontendPortRaw, 10)
  const devPort = Number.isFinite(frontendPort) && frontendPort > 0 ? frontendPort : 5173

  // Tunnel / public hostname hits the dev server with Host: www.example.com — Vite blocks unknown hosts (DNS rebinding).
  const viteAllowedHostsExtra = (
    fileEnv.VITE_ALLOWED_HOSTS ||
    process.env.VITE_ALLOWED_HOSTS ||
    ''
  )
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  const viteAllowedHostsDefaults = [
    'www.ageforty.com',
    'ageforty.com',
    'api.ageforty.com',
  ]
  const allowedHosts = [...new Set([...viteAllowedHostsDefaults, ...viteAllowedHostsExtra])]

  return {
    // Windows: project folders under Documents/GitHub are often locked by OneDrive, Defender,
    // or a second Vite process — rmdir on frontend/.vite/deps then fails with EPERM. Cache in %TEMP%.
    cacheDir:
      process.env.SITUATE_VITE_CACHE_DIR ||
      path.join(os.tmpdir(), 'situate-vancouver-frontend-vite'),
    define: {
      __SITUATE_PROD_HEALTH_URL__: JSON.stringify(prodHealthUrl),
      __SITUATE_PROD_QUERY_URL__: JSON.stringify(prodQueryUrl),
    },
    plugins: [djangoHealthForwardPlugin(djangoTarget, apiProxyForwardHost), react()],
    optimizeDeps: {
      include: ['maplibre-gl'],
    },
    build: {
      // MapLibre GL is ~1MB minified; lazy-loaded — warn threshold tuned for that.
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          app: path.resolve(__dirname, 'app.html'),
        },
      },
    },
    server: {
      host: frontendHost,
      port: devPort,
      allowedHosts,
      proxy: {
        '/api': {
          target: djangoTarget,
          changeOrigin: true,
          configure(proxy) {
            if (!apiProxyForwardHost) return
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('host', apiProxyForwardHost)
            })
          },
        },
        '/ai': {
          target: aiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai/, ''),
        },
      },
    },
  }
})
