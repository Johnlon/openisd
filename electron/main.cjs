/**
 * Electron main process for the optional OpenISD desktop shell.
 *
 * This directory is NOT part of the npm workspace (`workspaces: ["packages/*"]`), so
 * `npm install` at the repo root never pulls Electron's ~100 MB binary. It is installed
 * on demand by `make electron-deps`, and the web app is unaffected either way.
 *
 * The renderer is the SAME build as the web app, produced by `ELECTRON=1 npm run build`
 * into packages/ui/dist-electron.
 *
 * Assets are served over a custom `app://` protocol rather than loaded from `file://`.
 * That is not decoration: a `file://` document has an opaque origin, under which Chromium
 * refuses `localStorage` — and packages/ui/src/utils/persist.ts stores the entire session
 * under the `openisd.state` key. On `app://` the origin is real and ordinary web storage,
 * fetch and module semantics all apply, so the renderer behaves exactly as it does in a
 * browser tab.
 */
const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'packages', 'ui', 'dist-electron');
const ORIGIN = 'app://openisd';

// Must run before app ready. `standard` gives the scheme a real origin (so storage is
// partitioned normally); `secure` makes it a trustworthy origin, which service-worker-free
// modern APIs still require; `supportFetchAPI` lets the app fetch its own assets.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Map an app:// URL onto a file inside DIST, refusing anything that escapes it. */
function resolveAsset(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl).pathname);
  const target = path.join(DIST, pathname === '/' ? 'index.html' : pathname);
  const contained = target === DIST || target.startsWith(DIST + path.sep);
  return contained ? target : null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    backgroundColor: '#11151c', // matches the PWA manifest theme, so no white flash on open
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false, // the renderer is ordinary web code and gets no Node access
    },
  });

  // Datasheet and repository links are external — they open in the user's real browser
  // instead of replacing the app window, which would leave no way back.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(`${ORIGIN}/index.html`);
  return win;
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const target = resolveAsset(request.url);
    if (!target) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(target).toString());
  });

  createWindow();

  // macOS keeps the process alive with no windows; clicking the dock icon reopens one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
