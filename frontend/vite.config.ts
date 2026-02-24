import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Base path: /health-/ for GitHub Pages, / for DigitalOcean
// Set VITE_BASE_PATH=/ when building for production (DO)
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/health-/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/me': 'http://localhost:8000',
    },
  },
})
