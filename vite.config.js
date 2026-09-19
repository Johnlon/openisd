import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import {VitePWA} from 'vite-plugin-pwa';
import {fileURLToPath} from 'url';
import {join} from 'path';
import {createReadStream, existsSync} from 'fs';

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

// The bundled catalogue (docs/design/BUNDLED_CATALOGUE_API.md) is served as static files from
// packages/ui/public/: /drivers-index.json, /passive-radiators-index.json, /drivers/<path>.json.
// The browser suite runs against a small catalogue cut from the tracked one
// (scripts/test-bundle.mjs): with OPENISD_DRIVERS_BUNDLE_DIR set, those paths are answered from
// that directory instead of public/, so every spec boots against six reference devices rather
// than two thousand. Dev-server only — a production build serves public/ and nothing else.
const CATALOGUE_DIR = process.env.OPENISD_DRIVERS_BUNDLE_DIR;
const CATALOGUE_PATH = /^\/(drivers-index\.json|passive-radiators-index\.json|drivers\/.+\.json)$/;
const serveCatalogue = {
  name: 'serve-catalogue',
  configureServer(server) {
    if (!CATALOGUE_DIR) return;
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? '').split('?')[0];
      const m = CATALOGUE_PATH.exec(url);
      if (!m) return next();
      const file = join(CATALOGUE_DIR, m[1]);
      if (!existsSync(file)) { res.statusCode = 404; res.end(`${url}: not in ${CATALOGUE_DIR}`); return; }
      res.setHeader('Content-Type', 'application/json');
      createReadStream(file).pipe(res);
    });
  },
};

// The browser suite's vite serves a fixed tree for one run: it needs no file watcher, and the
// polling watcher below is steady CPU it would otherwise spend for nothing.
const TEST_SERVER = process.env.OPENISD_TEST_SERVER === '1';

// Paths the dev watcher never needs to track: generated/scratch output and the static driver
// catalogue. Kept in one list so the inotify and polling paths share it.
const WATCH_IGNORED = [
  '**/build/**',
  '**/dist/**',
  '**/test-results/**',
  '**/drivers/**/_*/**',
  '**/packages/ui/public/**',
];

export default defineConfig(({ command }) => ({
  root: UI_ROOT,
  base,
  define: {
    __BUILD_DATETIME__: JSON.stringify(new Date().toISOString().replace('T', ' ').substring(0, 19)),
  },
  server: {
    // Native inotify is reliable on this WSL2 (native ext4, kernel 6.18) and costs ~0% CPU
    // idle — polling the ~2,000-file catalogue at 100ms burned ~29% CPU for nothing. The
    // polling path stays reachable via OPENISD_POLL_WATCH=1 for any mount where inotify is
    // unreliable (e.g. a drvfs/9p Windows mount).
    //
    // The ignored set stays on BOTH paths: build/ is the repo's scratch space (throwaway
    // scripts, probe output, logs — writing there must never reload the dev server), the
    // driver catalogue in public/ and drivers/ is static (it never changes in dev), and
    // dist/test-results are generated. Watching them is wasted work.
    watch: TEST_SERVER
      ? null
      : process.env.OPENISD_POLL_WATCH === '1'
        ? {
            usePolling: true,
            interval: 100,
            ignored: WATCH_IGNORED,
          }
        : { ignored: WATCH_IGNORED },
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
    serveCatalogue,
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
        // The catalogue indexes and record files are NOT precached (2000 files, 14 MB): they are
        // cached as they are used, and re-validated in the background on every use, so a
        // republished catalogue reaches an installed app without a reinstall and nothing is
        // held longer than maxAgeSeconds. The app shell itself is precached and revision-hashed;
        // registerType 'autoUpdate' reloads open pages onto a new build.
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        globIgnores: ['drivers/**', 'drivers-index.json', 'passive-radiators-index.json'],
        // A RegExp, not a function: workbox serialises this into sw.js, where a closure over
        // this file's variables would not exist.
        runtimeCaching: [{
          urlPattern: /\/(drivers-index\.json|passive-radiators-index\.json|drivers\/.+\.json)$/,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'openisd-catalogue', expiration: { maxAgeSeconds: 7 * 24 * 3600 } },
        }],
      },
    })]),
  ],
}));
