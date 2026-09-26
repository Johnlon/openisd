Status: RESOLVED (2026-08-22, task A7)

# `scripts/bundle-drivers.mjs`'s CLI-entry guard silently no-ops under `vite-node`

## Symptom

`npx vite-node scripts/bundle-drivers.mjs` exits 0 and prints nothing — the bundle is never
regenerated, and nothing reports an error.

## Evidence

`scripts/bundle-drivers.mjs:215` gates the `main()` call on
`process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)`. Under plain
`node scripts/bundle-drivers.mjs`, `process.argv[1]` is the script's own path, so the guard
passes. Probed directly:

```
$ node -e "console.log(process.argv[1])" (via a throwaway script run as
  `npx vite-node /tmp/argv-check.mjs`)
argv1 /home/john/work/winisd/openisd/node_modules/vite-node/vite-node.mjs
```

`vite-node` never puts the target script path in `process.argv` at all — it consumes the path
internally and the runner's own path appears at `argv[1]` instead — so the equality never holds
and `main()` never runs, with no error surfaced.

## Cause

The script needs `vite-node` (not plain `node`) to import `@openisd/model` — a workspace
package whose `exports` map points straight at TypeScript source
(`packages/model/package.json`), which plain `node` cannot load
(`ERR_UNKNOWN_FILE_EXTENSION` for `.ts`, reproduced directly running
`node scripts/bundle-drivers.mjs`). The CLI-entry guard was written for `node`'s argv shape and
was never exercised under `vite-node`.

## Fix

Split the file: pure logic (`project`, `isBundlable`, `valueOf`, `specValue`, `specSection`) and
its `@openisd/model` import move to `scripts/bundleProjection.mjs`, which nothing executes as a
side effect. `scripts/bundle-drivers.mjs` becomes a thin CLI entry that imports from it and
calls `main()` unconditionally — safe because nothing but the CLI invocation ever imports that
file; tests import `bundleProjection.mjs` directly. `package.json`'s `predev`/`prebuild` switch
from `node scripts/bundle-drivers.mjs` to `npx vite-node scripts/bundle-drivers.mjs`.

## Verification

`npx vite-node scripts/bundle-drivers.mjs` prints the per-source bundling log and writes
`packages/ui/src/drivers-bundle.json`; `npx vitest run packages/ui/test/db/bundle-drivers-disposition.test.ts
packages/ui/test/db/drivers-bundle.test.ts` stays green importing the split-out
`bundleProjection.mjs`.
