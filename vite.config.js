import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';
import { join } from 'path';

// Optional desktop target, built by `make electron`. It shares the entire UI and engine
// with the web app and differs only in how the assets are addressed and cached:
//   - base './' so every asset resolves relative to the app:// document electron/main.cjs
//     serves, instead of the web server root;
//   - a separate outDir, so a desktop build never overwrites the web build;
//   - NO service worker — a precaching SW inside a packaged app pins stale JS with no
//     address bar for the user to hard-reload from.
// With ELECTRON unset every one of these falls back to the web behaviour.
const ELECTRON = !!process.env.ELECTRON;

// Deployed as a GitHub Pages project site at johnlon.github.io/openisd/, so the
// production build is served under the /openisd/ path. Local dev serves at root.
function resolveBase() {
  if (ELECTRON) return './';
  return process.env.GITHUB_PAGES ? '/openisd/' : '/';
}
const base = resolveBase();
const UI_ROOT = join(fileURLToPath(import.meta.url), '..', 'packages', 'ui');

// In dev mode, inject a script that unregisters any stale PWA service worker on every
// page load. Prevents cached compiled JS from masking source changes after a prod build.
const clearSwInDev = {
  name: 'clear-sw-in-dev',
  transformIndexHtml(html, ctx) {
    if (!ctx.server) return html; // prod build — leave SW alone
    return html.replace(
      '<head>',
      `<head><script>navigator.serviceWorker?.getRegistrations().then(async rs=>{if(!rs.length)return;console.info('[dev] unregistered',rs.length,'stale SW(s)');await Promise.all(rs.map(r=>r.unregister()));location.reload()})</script>`,
    );
  },
};

export default defineConfig(({ command }) => ({
  root: UI_ROOT,
  base,
  define: {
    __BUILD_DATETIME__: JSON.stringify(new Date().toISOString().replace('T', ' ').substring(0, 19)),
  },
  server: {
    // WSL/Windows filesystem events are not reliable for every editor and mount. Polling keeps
    // the canonical 4000 dev server live when inotify misses a source edit.
    watch: {
      usePolling: true,
      interval: 100,
      // build/ is the repo's scratch space — throwaway scripts, probe output, logs.
      // Writing there must never reload the dev server. Driver collections may also
      // arrive carrying `_`-prefixed cache dirs from the pipeline that produced them.
      ignored: ['**/build/**', '**/drivers/**/_*/**'],
    },
    // Do not add an `hmr` block with `port: 4000` here. Vite's dev HTTP server already owns
    // 4000 and multiplexes HMR on it; overriding the port makes ordinary `/` requests return
    // `426 Upgrade Required` instead of the app document.
  },
  build: {
    // Explicit, so the desktop build lands beside the web build rather than replacing it.
    outDir: ELECTRON ? 'dist-electron' : 'dist',
    emptyOutDir: true,
  },
  plugins: [
    clearSwInDev,
    vue(),
    ...(ELECTRON || command === 'serve' ? [] : [VitePWA({
      registerType: 'autoUpdate',
      base,
      manifest: {
        name: 'OpenISD',
        short_name: 'OpenISD',
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
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
    })]),
  ],
}));
