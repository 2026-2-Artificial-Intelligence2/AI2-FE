import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 게임 연결(/ws/lobby)은 백엔드로 넘긴다. 그래서 터널로 이 화면 주소 하나만 열면 게임까지 된다.
const proxy = {
  '/ws/lobby': {
    target: process.env.OFFICE_STOCK_BACKEND || 'http://127.0.0.1:8080',
    ws: true,
    changeOrigin: false
  }
};

// Vite는 모르는 주소로 들어온 접속을 막는다. Cloudflare 터널 주소(https://….trycloudflare.com)는 받아 준다.
const allowedHosts = ['.trycloudflare.com'];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts,
    proxy
  },
  // 빌드한 화면(npm run build 뒤 npm run preview). 터널 너머에서는 개발 서버보다 훨씬 빨리 뜬다.
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    allowedHosts,
    proxy
  }
});
