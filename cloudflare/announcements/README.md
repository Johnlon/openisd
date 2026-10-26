# OpenISD announcements Worker

This test Worker provides the announcements list and a cache-free recovery short link for test.openisd.app. It is separate from a future production Worker.

- GET /announcements returns the versioned feed as JSON.
- GET / shows the full reviewable list.
- GET /refresh redirects to the recovery page at /about/refresh/. That path is deliberately kept under /about/: older installed service workers bypass it, while a new top-level path such as /refresh on the app origin can be answered by a stale cached app shell.

Every response sends Cache-Control, CDN-Cache-Control, and Cloudflare-CDN-Cache-Control with no-store. App requests also use fetch(..., {cache: 'no-store'}).

Add an announcement by appending an item with a new stable id to src/index.js, then deploy. The app records dismissal by that ID, so dismissing one announcement does not hide a later one. The review page continues to list dismissed items.

Deploy with the OpenISD Cloudflare account:

  bash ../openisd-stats/cf.sh deploy --config cloudflare/announcements/wrangler.toml
