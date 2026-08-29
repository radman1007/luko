import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // کتابخانه‌ها جدا از کدِ اپ بسته می‌شوند: با هر انتشارِ تازه، مرورگر فقط
    // چانکِ اپ را دوباره می‌گیرد و ری‌اکت/روتر/کوئری از کش می‌آید.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react';
          }
          if (/[\\/]node_modules[\\/](@tanstack|axios)[\\/]/.test(id)) return 'vendor-data';
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // در dev درخواست‌های /api به بک‌اند پروکسی می‌شوند (same-origin، بدون CORS)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // `npm run preview` نسخه‌ی build‌شده را سرو می‌کند — برای سنجشِ رفتارِ
  // واقعی، چون StrictMode فقط در dev افکت‌ها را دوبار اجرا می‌کند.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
