import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] as const;

/**
 * 开发服务器把 /en/... 重写到 /pages/en.html，
 * 让 dev 与生产构建（dist/en/index.html）的 URL 结构保持一致。
 */
function localeDevRewrite(): Plugin {
  return {
    name: 'locale-dev-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '';
        const match = new RegExp(`^/(${LOCALES.join('|')})/?(index\\.html)?$`).exec(url.split('?')[0] ?? '');
        if (match) {
          req.url = `/pages/${match[1]}.html`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), localeDevRewrite()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(
          LOCALES.map((locale) => [locale, resolve(__dirname, `pages/${locale}.html`)]),
        ),
      },
    },
  },
  server: {
    port: 5173,
  },
});
