import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project from https://vicky2315.github.io/lila-assessment/
export default defineConfig({
  base: '/lila-assessment/',
  plugins: [react()],
})
