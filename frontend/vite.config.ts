import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const djangoTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000'
const aiTarget = process.env.AI_PROXY_TARGET ?? 'http://127.0.0.1:8001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
