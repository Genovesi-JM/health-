import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createShellPrecache, isOnDemandScript } from './build/shellPrecache'

const shellPrecache = createShellPrecache()

// Base path: /health-/ for GitHub Pages, / for Azure (served at domain root).
// Set VITE_BASE_PATH=/ when building for the Azure Container Apps / static deploy.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/health-/',
  plugins: [
    react(),
    tailwindcss(),
    shellPrecache.plugin,
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
            // The standalone demo must never fall back to the authenticated SPA.
            urlPattern: /\/prototype(?:\/|$)/,
            handler: 'NetworkOnly',
          },
          {
            // Block all backend API / auth routes from being cached
            urlPattern: /^https?:\/\/.*\/(api|auth|admin|me)(\/|$)/,
            handler: 'NetworkOnly',
            options: { cacheName: 'api-no-cache' },
          },
          {
            // Only requested, same-origin hashed build scripts are stored here.
            // Unvisited page code is never downloaded during worker installation.
            urlPattern: isOnDemandScript,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kaya-page-code-v1',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        // Pre-cache the shell's static import graph; page JS is cached on use.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,webmanifest}'],
        manifestTransforms: [shellPrecache.transform],
        // Exclude anything that could contain patient data
        globIgnores: ['**/api/**', '**/auth/**', '**/prototype/**'],
        // Don't let the SW intercept cross-origin requests (e.g. DO Spaces CDN)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /\/prototype(?:\/|$)/,
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
