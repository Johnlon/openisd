# BUG — the deploy check verifies asset freshness and never that the app RUNS

# Status
- deploy-check gap: FIXED
- underlying app fault: OPEN

## Symptom

`scripts/verify-preview.sh` reported

```
SUCCESS: Preview server on port 4000 is serving the latest build (index-B2suqgWg.js).
```

while the deployed app was throwing on load. The browser console:

```
TypeError: Cannot read properties of undefined (reading 'woofer')
    at #specs      (openisdDriver.ts)
    at #effective  (managedProject.ts)
    at toDriver / cell / errors
```

Three separate reactive computations died — `toDriver`, `cell`, `errors` — i.e. the driver panel,
the charts and the error list all failed. The deploy was declared good.

## Cause — the check compares FILENAMES, nothing more

`verify-preview.sh` does exactly three things:

1. `curl` the root and require HTTP 200;
2. take the newest `packages/ui/dist/assets/index-*.js`;
3. assert the hash in the served `index.html` equals that filename.

Every one of those passes for a bundle that throws on the first tick. HTTP 200 is the SERVER
answering, not the app working; a matching hash proves the bytes are CURRENT, not CORRECT. There
is no browser in the loop, so nothing can observe a runtime error.

**The gap is structural, not a missing edge case.** The script's own name promises the preview is
"running the latest software", and it is — the latest BROKEN software. A check that can only ever
compare filenames cannot fail on a runtime fault, so it certifies every deploy that builds.

## Fix

A deploy check must load the page in a real browser and fail on:

- any uncaught exception (`page.on('pageerror')`),
- any `console.error`,
- the app not reaching a rendered state.

Added as `scripts/verify-app-runs.mjs`, called by `scripts/verify-preview.sh` after the freshness
check, so `deploy` cannot report success over a throwing bundle.

## The underlying app fault this exposed

A record reaches `OpenISDDriver` with **no `specs` key at all**:

```ts
#specs(): SpecSection {
  const s = this.#record.specs[this.#section] ?? {};   // ← throws when specs is undefined
```

`OpenISDDriver.empty()` sets `specs: { woofer: {} }`, so the offending record is NOT one the app
authored this session — it arrives from outside (restored state, storage, or a bundled record).
Producer identified below once reproduced; the `?? {}` guards a missing SECTION, never a missing
`specs`.
