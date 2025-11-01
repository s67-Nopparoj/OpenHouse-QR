import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // ✅ ให้เปิดจาก IP ภายนอกได้
    port: 5173,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.app',
      '.ngrok-free.dev',
    ],
    cors: true, // ✅ เปิด CORS เผื่อ fetch ข้าม domain
  },
})
