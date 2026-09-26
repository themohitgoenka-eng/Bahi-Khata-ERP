import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// NOTE: Kept intentionally standard & portable so the same web build can be
// wrapped by Capacitor (Android APK) and Tauri (Desktop EXE) locally.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Relative base so the built assets work inside Capacitor/Tauri file:// contexts.
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      cors: true,
      allowedHosts: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      hmr: process.env.DISABLE_HMR === 'true' ? false : { clientPort: 443, protocol: 'wss' },
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
