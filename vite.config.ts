import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // --- ADD THIS SERVER PROXY CONFIGURATION ---
      server: {
        proxy: {
          '/geminiProxy': {
            target: 'http://127.0.0.1:5001/langcampus-exchange/us-central1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/geminiProxy/, '/geminiProxy'),
          },
          '/googleCloudTTS': {
            target: 'http://127.0.0.1:5001/langcampus-exchange/us-central1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/googleCloudTTS/, '/googleCloudTTS'),
          },
          '/transcribeAudio': {
            target: 'http://127.0.0.1:5001/langcampus-exchange/us-central1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/transcribeAudio/, '/transcribeAudio'),
          },
          '/youtubeProxy': {
            target: 'http://127.0.0.1:5001/langcampus-exchange/us-central1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/youtubeProxy/, '/youtubeProxy'),
          },
          '/imagenProxy': {
            target: 'https://127.0.0.1:5001/langcampus-exchange/us-central1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/imagenProxy/, '/imagenProxy')
          },
          '/imageSearchProxy': {
            target: 'http://127.0.0.1:5001/langcampus-exchange/us-central1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/imageSearchProxy/, '/imageSearchProxy')
          },
        },
      },
    };
});