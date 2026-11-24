import tailwind from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  // The eval numbers on the page are read from evidence/ at build time, so the page can't drift from the measurement.
  server: { fs: { allow: ['../..'] } },
  build: { target: 'es2022' },
})
