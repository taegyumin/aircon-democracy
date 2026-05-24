import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png'],
      manifest: {
        name: '에어컨 민주주의',
        short_name: '에어컨민주',
        description: '지금 이 공간의 에어컨 의견을 모아요',
        lang: 'ko',
        theme_color: '#1B53E5',
        background_color: '#F2F2F7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
