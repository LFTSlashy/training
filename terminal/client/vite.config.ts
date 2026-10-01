import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.API_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': target,
      '/ws': { target: target.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { charts: ['lightweight-charts'], react: ['react', 'react-dom'] } },
    },
  },
});
