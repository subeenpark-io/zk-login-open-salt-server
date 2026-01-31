import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api/salt to Salt Server (hides actual endpoint from browser)
      '/api/salt': {
        target: 'http://zklogin-prod-alb-1474010946.ap-northeast-2.elb.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/salt/, '/v1/salt'),
      },
      // Proxy /api/prover to Mysten Prover
      '/api/prover': {
        target: 'https://prover-dev.mystenlabs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/prover/, '/v1'),
        secure: true,
      },
    },
  },
})
