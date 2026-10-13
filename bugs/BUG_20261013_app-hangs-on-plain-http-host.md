# BUG_20261013_app-hangs-on-plain-http-host

**Status:** RESOLVED

## Symptom
The app hangs on its loading screen when opened over plain http on any host other than localhost, for example http://lap:4000 from the phone. The same build works at http://localhost:4000. Page error: `TypeError: crypto.randomUUID is not a function` in `startApp`.

## Cause
Browsers define `crypto.randomUUID` only in a secure context: https, or localhost. Five source files called it bare. The one in `packages/ui/src/main.ts` (the telemetry session id, landed 13 Oct with T055/T058) runs at boot, so boot threw. The others, in `packages/persistence/src/repos/projectRepo.ts`, `savedEntries.ts` (two) and `packages/ui/src/hooks/OriginalFilters-hooks.ts`, would have thrown on first use.

## Fix
All five call `newUuid()` from `@openisd/design`, which guards the call and falls back to a random v4 id. `packages/design/test/architecture-no-bare-random-uuid.test.ts` refuses any other file naming `crypto.randomUUID`.

Reported by the mobile-skin session, 13 Oct 2026.
