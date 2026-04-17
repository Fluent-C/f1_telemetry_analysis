import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // 0.0.0.0 바인딩 — 같은 네트워크 기기에서 접속 가능
    port: 5173,
  },
})
