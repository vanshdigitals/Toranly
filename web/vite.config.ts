import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Fonts stay separate files: the production CSP (font-src 'self') blocks data: URIs.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  server: {
    // The Python backend (backend/) serves /api; the browser stays same-origin.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: false },
    },
    watch: {
      ignored: [
        '**/scratch/**',
        '**/.system_generated/**',
        '**/brain/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
  },
});
