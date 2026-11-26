import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws/lobby': {
        target: process.env.OFFICE_STOCK_BACKEND || 'http://127.0.0.1:8080',
        ws: true,
        changeOrigin: false
      }
    }
  }
});
