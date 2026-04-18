import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@backend': resolve(__dirname, '../backend'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
})