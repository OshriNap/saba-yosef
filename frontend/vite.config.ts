import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/dvar-tora/',
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['code-agents-server.local'],
    proxy: {
      '/dvar-tora/api': {
        target: 'http://localhost:8086',
        rewrite: (path) => path.replace(/^\/dvar-tora/, ''),
      },
    },
  },
})
