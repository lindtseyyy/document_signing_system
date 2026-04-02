/**
 * Vite configuration for the frontend.
 * - Enables React + Tailwind (via @tailwindcss/vite)
 * - Proxies /api/* to the backend during local development to avoid CORS.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Export the Vite config object.
 * The dev server proxy allows the frontend to call '/api/...' directly.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
