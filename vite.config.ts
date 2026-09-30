import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // relative asset URLs so the build works under any sub-path (e.g. GitHub Pages /<repo>/)
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
  },
})
