import { defineConfig } from 'vite';
import type { Connect, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * بازی‌های استودیو دارایی‌هایشان را نسبی صدا می‌زنند (`icons/coin.png`)، یعنی
 * کنارِ خودشان در `/games/`. دارایی‌ها اما یک‌جا در `/games/assets/` می‌مانند تا
 * دو نسخه از یک فایل نداشته باشیم. این‌جا (و در nginxِ سرور) همان نشانیِ نسبی
 * به پوشه‌ی assets برمی‌گردد. بعضی بازی‌ها مسیر را در جاوااسکریپت می‌سازند، پس
 * بازنویسیِ متنِ فایل‌ها امن نبود.
 */
function gameAssetAlias(): PluginOption {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    // بی‌توجه به بزرگی/کوچکیِ حرف: بعضی بازی‌ها «Icons/…» نوشته‌اند
    if (req.url) {
      req.url = req.url.replace(/^\/games\/(icons|musics|fonts)\//i, (_m, dir: string) => `/games/assets/${dir.toLowerCase()}/`);
    }
    next();
  };
  return {
    name: 'luko-game-asset-alias',
    configureServer: (server) => { server.middlewares.use(rewrite); },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite); },
  };
}

/**
 * `@import`ی که به CSSِ خروجی برسد یعنی Vite آن را حل نکرده (مثلاً فایلی که
 * فقط از راهِ `composes` آمده). مرورگر آن را نسبت به /assets/ می‌گیرد، ۴۰۴
 * می‌خورد، preloadِ CSSِ صفحه‌ی lazy شکست می‌خورد و صفحه سفید می‌ماند — در
 * dev هم دیده نمی‌شود. پس بیلد همین‌جا می‌ایستد.
 */
function noUnresolvedCssImports(): PluginOption {
  return {
    name: 'luko-no-unresolved-css-imports',
    apply: 'build',
    writeBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        const found = String(file.source).match(/@import\s+(?:url\()?\s*["']?(?!https?:|\/\/)[^"')\s;]+/g);
        if (found) this.error(`${file.fileName}: @importِ حل‌نشده در خروجی — ${found.join(' ، ')}`);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gameAssetAlias(), noUnresolvedCssImports()],
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
