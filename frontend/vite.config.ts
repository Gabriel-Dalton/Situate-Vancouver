import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { djangoHealthForwardPlugin } from './vite-plugin-django-health'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, repoRoot, '')
  const djangoTarget =
    fileEnv.API_PROXY_TARGET || process.env.API_PROXY_TARGET || 'http://127.0.0.1:1111'
  const aiTarget =
    fileEnv.AI_PROXY_TARGET || process.env.AI_PROXY_TARGET || 'http://127.0.0.1:8001'
  const frontendHost =
    fileEnv.FRONTEND_DEV_HOST || process.env.FRONTEND_DEV_HOST || '127.0.0.1'
  const frontendPortRaw =
    fileEnv.FRONTEND_DEV_PORT || process.env.FRONTEND_DEV_PORT || '5173'
  const frontendPort = Number.parseInt(frontendPortRaw, 10)
  const devPort = Number.isFinite(frontendPort) && frontendPort > 0 ? frontendPort : 5173

  return {
    // Windows: project folders under Documents/GitHub are often locked by OneDrive, Defender,
    // or a second Vite process — rmdir on frontend/.vite/deps then fails with EPERM. Cache in %TEMP%.
    cacheDir:
      process.env.SITUATE_VITE_CACHE_DIR ||
      path.join(os.tmpdir(), 'situate-vancouver-frontend-vite'),
    plugins: [djangoHealthForwardPlugin(djangoTarget), react()],
    optimizeDeps: {
      include: ['maplibre-gl'],
    },
    build: {
      // MapLibre GL is ~1MB minified; lazy-loaded — warn threshold tuned for that.
      chunkSizeWarningLimit: 1200,
    },
    server: {
      host: frontendHost,
      port: devPort,
      proxy: {
        '/api': djangoTarget,
        '/ai': {
          target: aiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai/, ''),
        },
      },
    },
  }
})
