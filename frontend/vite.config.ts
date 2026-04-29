import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Base path: /health-/ for GitHub Pages, / for DigitalOcean
// Set VITE_BASE_PATH=/ when building for production (DO)
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/health-/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use generateSW — no custom SW file needed; workbox handles it
      strategies: 'generateSW',
      // Inject the service worker registration into the built index.html
      injectRegister: 'auto',
      manifest: false, // We provide our own public/manifest.webmanifest
      workbox: {
        // ── Cache ONLY static assets — never sensitive API data ──
        // API routes (/api/, /auth/, /admin/, /me) use NetworkOnly:
        // they always hit the server and are never stored in cache.
        runtimeCaching: [
          {
            // Block all backend API / auth routes from being cached
            urlPattern: /^https?:\/\/.*\/(api|auth|admin|me)(\/|$)/,
            handler: 'NetworkOnly',
            options: { cacheName: 'api-no-cache' },
          },
        ],
        // Pre-cache the built JS/CSS/HTML shell (safe static assets)
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,webmanifest}'],
        // Exclude anything that could contain patient data
        globIgnores: ['**/api/**', '**/auth/**'],
        // Don't let the SW intercept cross-origin requests (e.g. DO Spaces CDN)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/auth\//,
          /^\/admin\//,
          /^\/me\b/,
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        // Enable SW in dev so you can test install prompt locally
        enabled: false,
      },
    }),
  ],
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
