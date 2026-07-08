import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // QA tooling writes audit logs into .gstack/ — don't reload the app for them
      ignored: ['**/.gstack/**'],
    },
  },
})
