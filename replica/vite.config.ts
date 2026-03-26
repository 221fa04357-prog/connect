import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  base: "./",
  plugins: [react()],

  server: {
    host: true,   // ✅ VERY IMPORTANT (expose to network)
    port: 5173,

    allowedHosts: [
      '.ngrok-free.app'   // ✅ allow ALL ngrok domains
    ],

    watch: { usePolling: true, interval: 800 },

    proxy: {
      '/api': {
        target: 'http://localhost:5000',  // ✅ backend port
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',  // ✅ backend
        ws: true,
      },
      '/transcribe': {
        target: 'ws://localhost:8765',
        ws: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})