# OpenISD announcements Workers

The test and production apps use separate Cloudflare Workers built from `src/index.js`:

- Test: `https://openisd-announcements-test.john-lonergan-0e9.workers.dev`
- Production: `https://openisd-announcements.john-lonergan-0e9.workers.dev`

- GET /announcements returns the versioned feed as JSON.
- GET / shows the full reviewable list.
- GET /refresh redirects to the recovery page on the matching app host. Use `?site=test` on the test Worker; production is the default. This is the short recovery link.
- The recovery page is `/about/refresh/` on the app host. It unregisters old service workers and clears only that origin's CacheStorage, then fetches and loads the newest app shell. Projects and settings remain in local storage.

Every response sends Cache-Control, CDN-Cache-Control, and Cloudflare-CDN-Cache-Control with no-store. App requests also use fetch(..., {cache: 'no-store'}).

Add an announcement by appending an item with a new stable id to `src/index.js`, then deploy the test Worker. The app records dismissal by that ID, so dismissing one announcement does not hide a later one. The review page continues to list dismissed items. The production app selects the production Worker; deploy its config only as part of an explicitly approved production release.

Deploy the test Worker:

  bash ../openisd-stats/cf.sh deploy --config "$PWD/cloudflare/announcements/wrangler.toml"

The production Worker is prepared but must not be deployed until production release approval:

  bash ../openisd-stats/cf.sh deploy --config "$PWD/cloudflare/announcements/wrangler.production.toml"

Short links:

- Test refresh: `https://openisd-announcements-test.john-lonergan-0e9.workers.dev/refresh?site=test`
- Production refresh: `https://openisd-announcements.john-lonergan-0e9.workers.dev/refresh`
- Test announcements: `https://openisd-announcements-test.john-lonergan-0e9.workers.dev/?site=test`
- Production announcements: `https://openisd-announcements.john-lonergan-0e9.workers.dev/`
