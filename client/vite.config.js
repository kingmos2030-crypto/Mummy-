import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.CLIENT_PORT) || 3000,
    allowedHosts: true,
    // the browser only ever talks to this dev server; /api is proxied to Express
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/robots.txt': { target: API_TARGET },
      '/sitemap.xml': { target: API_TARGET },
    },
  },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
