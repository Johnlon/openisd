import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import {VitePWA} from 'vite-plugin-pwa';
import {fileURLToPath} from 'url';
import {join} from 'path';
import {createReadStream, existsSync, readFileSync, writeFileSync} from 'fs';
import {execFileSync} from 'child_process';

// Optional desktop target, built by `make electron`. It shares the entire UI and engine
// with the web app and differs only in how the assets are addressed and cached:
//   - base './' so every asset resolves relative to the app:// document electron/main.cjs
//     serves, instead of the web server root;
//   - a separate outDir, so a desktop build never overwrites the web build;
//   - NO service worker — a precaching SW inside a packaged app pins stale JS with no
//     address bar for the user to hard-reload from.
// With ELECTRON unset every one of these falls back to the web behaviour.
const ELECTRON = !!process.env.ELECTRON;

// Hosting (T056): one build is served from several places — https://openisd.app/ (the Latest
// release), /v/<stamp>/ (every release) and /snap/<stamp>/ (snapshot builds) — and is the SAME
// bytes in each, so a published build uses the relative base './' (OPENISD_RELATIVE_BASE=1,
// set by scripts/snap.sh). Local dev and the browser suite keep '/'. Electron addresses its
// assets relative to the app:// document `electron/main.cjs` serves, which './' also gives it.
const RELATIVE_BASE = process.env.OPENISD_RELATIVE_BASE === '1';
function resolveBase() {
  return ELECTRON || RELATIVE_BASE ? './' : '/';
}
const base = resolveBase();

// The build's own version (scripts/version-info.mjs writes it before every build), baked into the
// bundle so a running app can tell when a newer build is published. '' when the file is absent.
// In dev mode ('serve') it is '', so a dev server shows no version. OPENISD_BUILD_VERSION names the
// build outright: the app-update end-to-end test builds twice and tells the two builds apart by it.
export function buildVersion(command, env = process.env) {
  if (command === 'serve') return '';
  if (typeof env.OPENISD_BUILD_VERSION === 'string' && env.OPENISD_BUILD_VERSION !== '') return env.OPENISD_BUILD_VERSION;
  try {
    const info = JSON.parse(readFileSync(join(fileURLToPath(import.meta.url), '..', 'packages', 'ui', 'public', 'build-info.json'), 'utf8'));
    return typeof info.version === 'string' ? info.version : '';
  } catch {
    return '';
  }
}
const UI_ROOT = join(fileURLToPath(import.meta.url), '..', 'packages', 'ui');

// vite-plugin-pwa puts a manifest link and a registerSW.js script, both relative to the page, into
// every html page. On about/ and install/ under a hosted copy (v/<stamp>/about/) they resolve to
// files that do not exist, and the script would register a worker at the wrong address. Those
// pages are static and are already covered by the app's worker, so only the app page keeps them.
export function stripPwaFromSubpages(html, path) {
  if (path === '/index.html') return html;
  return html
    .replace(/<link rel="manifest"[^>]*>/g, '')
    .replace(/<script src="[^"]*registerSW\.js"[^>]*><\/script>/g, '');
}
// vite-plugin-pwa edits the written pages when the build closes, so this runs then, last in the
// plugin list, and rewrites the finished about/ and install/ pages.
let builtOutDir = '';
const stripPwaFromSubpagesPlugin = {
  name: 'strip-pwa-from-subpages',
  apply: 'build',
  configResolved(config) { builtOutDir = join(config.root, config.build.outDir); },
  closeBundle: {
    order: 'post',
    handler() {
      for (const page of ['about', 'install']) {
        const file = join(builtOutDir, page, 'index.html');
        if (existsSync(file)) writeFileSync(file, stripPwaFromSubpages(readFileSync(file, 'utf8'), `/${page}/index.html`));
      }
    },
  },
};

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
function useCatalogue(server) {
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
}
// Dev server and the suite's preview server alike; a deploy build sets no OPENISD_DRIVERS_BUNDLE_DIR.
const serveCatalogue = {
  name: 'serve-catalogue',
  configureServer: useCatalogue,
  configurePreviewServer: useCatalogue,
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

// Dev-version middleware factory: returns a plugin that serves /dev-version.json only in dev mode.
function createServeDevVersion(command) {
  const REPO_ROOT = join(fileURLToPath(import.meta.url), '..');
  return {
    name: 'serve-dev-version',
    configureServer(server) {
      if (command !== 'serve') return;
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (url !== '/dev-version.json') return next();
        let sha = 'unknown';
        let hasChanges = false;
        // The commit's instant as an ISO 8601 basic UTC stamp at minute resolution ("20261013T1041Z"),
        // the form every stored and sent date takes; the app formats it for display.
        let committedAt = '';
        try {
          sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
        } catch {
          sha = 'unknown';
        }
        try {
          const iso = execFileSync('git', ['log', '-1', '--format=%cI'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
          committedAt = new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\d{2}\.\d+Z$/, 'Z');
        } catch {
          committedAt = '';
        }
        try {
          const status = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
          hasChanges = status.length > 0;
        } catch {
          hasChanges = false;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ sha, hasChanges, committedAt }));
      });
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  root: UI_ROOT,
  base,
  define: {
    'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(buildVersion(command)),
    // The app registers its own service worker (so a refusal is caught), in builds that ship one.
    'import.meta.env.VITE_SERVICE_WORKER': JSON.stringify(ELECTRON || command === 'serve' || mode === 'test' ? 'off' : 'on'),
  },
  server: {
    // Host names the dev server answers to besides localhost and IP addresses; Vite refuses any other.
    allowedHosts: ['lap'],
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
    // The public about and install pages (https://openisd.app/about/, /install/) sit beside the
    // app. The desktop build is the app alone.
    rollupOptions: ELECTRON ? {} : {
      input: {
        main: join(UI_ROOT, 'index.html'),
        about: join(UI_ROOT, 'about', 'index.html'),
        install: join(UI_ROOT, 'install', 'index.html'),
      },
    },
  },
  plugins: [
    clearSwInDev,
    serveCatalogue,
    ...(command === 'serve' ? [createServeDevVersion(command)] : []),
    vue(),
    // No service worker in the browser suite's build (mode test): a precaching SW would fetch every
    // asset at registration on every spec's page and cache across a run.
    ...(ELECTRON || command === 'serve' || mode === 'test' ? [] : [VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      base,
      manifest: {
        name: 'OpenISD',
        short_name: 'OpenISD',
        description: 'Open loudspeaker enclosure simulator — community-owned, runs anywhere',
        theme_color: '#11151c',
        background_color: '#11151c',
        display: 'standalone',
        // Relative, so each hosted copy installs (if at all) as itself, with its own scope. Only
        // the root copy's install page invites it (see packages/ui/install/index.html).
        start_url: base,
        scope: base,
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
        // about/ and install/ are pages of their own: without this an installed app answers
        // them with the app shell. They are precached, so they still open offline. v/, snap/
        // and test/ are the hosted copies: the root worker's scope covers them, and it must not answer a
        // copy's address with the ROOT build's shell. Not anchored to the origin root, because a
        // copy's own worker sees /v/<stamp>/about/ too.
        navigateFallbackDenylist: [/\/(about|install|v|snap|test)(\/|$)/],
        // A RegExp, not a function: workbox serialises this into sw.js, where a closure over
        // this file's variables would not exist.
        runtimeCaching: [{
          urlPattern: /\/(drivers-index\.json|passive-radiators-index\.json|drivers\/.+\.json)$/,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'openisd-catalogue', expiration: { maxAgeSeconds: 7 * 24 * 3600 } },
        }],
      },
    })]),
    // Last, so it sees what vite-plugin-pwa injected.
    stripPwaFromSubpagesPlugin,
  ],
}));