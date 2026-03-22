import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const djangoTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000'
const aiTarget = process.env.AI_PROXY_TARGET ?? 'http://127.0.0.1:8001'

// https://vite.dev/config/
export default defineConfig({
  // Keep prebundle cache under frontend/.vite (not node_modules/.vite) to avoid Windows EPERM
  // when another process locks files inside node_modules.
  cacheDir: path.resolve(__dirname, '.vite'),
  plugins: [react()],
  optimizeDeps: {
    include: ['maplibre-gl'],
  },
  build: {
    // MapLibre GL is ~1MB minified; lazy-loaded — warn threshold tuned for that.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    proxy: {
      '/api': djangoTarget,
      '/ai': {
        target: aiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, ''),
      },
    },
  },
})
