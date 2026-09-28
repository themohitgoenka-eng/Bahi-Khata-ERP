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
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Split heavy third-party libs into separate, cacheable vendor chunks
          // so the initial payload is smaller and downloads in parallel.
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('xlsx')) return 'vendor-xlsx';
              if (
                id.includes('jspdf') ||
                id.includes('html2canvas') ||
                id.includes('dompurify') ||
                id.includes('html-to-image')
              )
                return 'vendor-pdf';
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('@tanstack')) return 'vendor-query';
              if (id.includes('localforage')) return 'vendor-storage';
              if (id.includes('lucide-react')) return 'vendor-icons';
              return 'vendor';
            }
          },
        },
      },
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
    },
    // Production preview server (no HMR websocket => zero auto-refresh).
    // Supervisor runs `yarn dev` => `vite build && vite preview`.
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      cors: true,
      allowedHosts: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
  };
});
