/**
 * Vite configuration for the frontend.
 * - Enables React + Tailwind (via @tailwindcss/vite)
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Export the Vite config object.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
