import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API is proxied, so cookies stay first-party (no CORS or SameSite headaches).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: false } } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
        },
      },
    },
  },
});
