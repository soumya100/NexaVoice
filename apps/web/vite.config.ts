import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@nexavoice/domain-types': path.resolve(__dirname, '../../packages/domain-types/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/realtime': {
        target: 'http://127.0.0.1:4000',
        ws: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        ws: true,
      },
    },
  },
});
