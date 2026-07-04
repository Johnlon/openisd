import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';
import { join } from 'path';

// Deployed as a GitHub Pages project site at johnlon.github.io/openisd/, so the
// production build is served under the /openisd/ path. Local dev serves at root.
const base = process.env.GITHUB_PAGES ? '/openisd/' : '/';
const UI_ROOT = join(fileURLToPath(import.meta.url), '..', 'packages', 'ui');

// In dev mode, inject a script that unregisters any stale PWA service worker on every
// page load. Prevents cached compiled JS from masking source changes after a prod build.
const clearSwInDev = {
  name: 'clear-sw-in-dev',
  transformIndexHtml(html, ctx) {
    if (!ctx.server) return html; // prod build — leave SW alone
    return html.replace(
      '<head>',
      `<head><script>navigator.serviceWorker?.getRegistrations().then(rs=>{if(rs.length)console.info('[dev] unregistered',rs.length,'stale SW(s)');rs.forEach(r=>r.unregister())})</script>`,
    );
  },
};

export default defineConfig({
  root: UI_ROOT,
  base,
  server: {
    watch: {
      ignored: ['**/drivers/**/_html/**', '**/drivers/**/datasheets/**'],
    },
  },
  plugins: [
    clearSwInDev,
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      base,
      manifest: {
        name: 'Resonate',
        short_name: 'Resonate',
        description: 'Open loudspeaker enclosure simulator — community-owned, runs anywhere',
        theme_color: '#11151c',
        background_color: '#11151c',
        display: 'standalone',
        start_url: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
