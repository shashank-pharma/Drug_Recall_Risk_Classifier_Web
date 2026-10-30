import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // FastAPI runs on :8000 (see CLAUDE.md); the browser only talks to Vite.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
