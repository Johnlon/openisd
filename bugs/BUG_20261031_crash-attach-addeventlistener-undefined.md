# Crash: "Cannot read properties of undefined (reading 'addEventListener')" at AppUpdate.attach

Status: RESOLVED (by commit 62151d66e, 29 Oct 2026)

## Symptom

Production v20261025T2233Z, 21 occurrences on 27 Oct 2026: `mn.attach` (AppUpdate.attach) threw
"Cannot read properties of undefined (reading 'addEventListener')".

## Cause

`registerServiceWorker` returned whatever `host.register` resolved with. A browser that blocks the
worker can resolve with `undefined` instead of rejecting. main.ts then called
`appUpdate.attach(undefined)`, and `registration.addEventListener('updatefound', ...)` threw.

## Fix

62151d66e: `registerServiceWorker` treats an undefined or null registration as blocked, records
`sw_blocked` and returns null; main.ts then skips `attach`. The app runs without update checks.

## Verification

`packages/ui/test/logic/telemetry.test.ts` (register resolving `undefined` gives null and one
`sw_blocked`). Not in a release before snapshot snap-20261031T0246Z.
