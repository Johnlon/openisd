// Served as /sw.js at the site root while no release is marked Latest (scripts/hosting/assemble-site.sh).
// A phone that opened openisd.app before 13 Oct 2026 still runs that day's root service worker, whose
// scope is the whole site and which answers every /snap/ and /v/ address with its cached old app.
// A worker is replaced only by what its own script URL serves next, so this replaces it: it takes
// over, unregisters itself and reloads its pages, which then load from the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => Promise.all(clients.map((c) => c.navigate(c.url)))),
  );
});
