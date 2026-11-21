import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Forward /api and /ws requests to the FastAPI backend in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
