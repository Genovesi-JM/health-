import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate config from vite.config.ts so the PWA/build plugins don't run
// during tests. jsdom environment + a setup file for jest-dom matchers.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
