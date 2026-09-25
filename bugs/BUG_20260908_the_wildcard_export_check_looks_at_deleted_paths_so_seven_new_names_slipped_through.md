# The wildcard-export check looks at deleted paths, so seven new names slipped through unreviewed

Status: RESOLVED — the export-ratchet check now targets the current design paths and baseline.

## Symptom

`packages/ui/test/ui/architecture.test.ts` fails its own "am I actually checking anything?" guard:

```
AssertionError: the scan found fewer export * sites than the baseline records —
the gate would pass vacuously
 ❯ test/ui/architecture.test.ts:787
```

## Evidence

`EXPORT_STAR_BASELINE` (line 711) is keyed by repo-relative path:

```ts
'model/src/index.ts':  { ... }
'winisd/src/index.ts': { ... }
```

Neither path exists. The five `export *` sites in the tree today are all in `packages/design`:

```
packages/design/ini/index.ts:1:    export * from './ini.js';
packages/design/winisd/index.ts:1: export * from './winisdBytes.js';
packages/design/winisd/index.ts:2: export * from './winisdProject.js';
packages/design/winisd/index.ts:3: export * from './winisdDriver.js';
packages/design/winisd/index.ts:4: export * from './parstate.js';
```

Resolved 2026-09-08 against the baseline the gate still records:

| specifier | baseline | now | difference |
|---|---|---|---|
| `./winisdBytes.js` | 5 names | same 5 | none |
| `./winisdProject.js` | `WinISDProject` | same | none |
| `./winisdDriver.js` | `INI_ROWS`, `WdrCell`, `WdrHeader`, `WinISDDriver` | + `INI_ROWS_META`, `WINISD_CALCULABLE`, `WdrEnv` | **grew by 3** |
| `./parstate.js` | `CellState`, `PARSTATE_LEN`, `POS_TO_WDRKEY` | + `ParStateError`, `markOf`, `parseParState`, `provenanceOf`, − `CellState` | **grew by 4** |
| `./ini.js` | *(no row)* | `Ini`, `parseIni`, `stringifyIni` | **a new wildcard site** |

QO86 (John, 2026-08-23): "export * is a serious violation of control and arch" — a baselined
wildcard may shrink as it converts to named exports, never grow, and a new one is never allowed.
Seven names became publicly importable without anyone reviewing them, and one whole new
`export *` was added.

## Cause

The baseline is keyed by file PATH. `packages/model` and `packages/winisd` became subdirectories
of `packages/design`, so every key stopped matching. A key that matches nothing yields
`baseline = undefined`, and the growth comparison it feeds never runs.

That self-check is what caught this — the test was written to fail rather than pass when it
finds fewer sites than it records, which is the only reason this is visible at all.

## Fix

Not a re-key. The correct baseline content is a human decision, because re-recording today's
symbol sets would ratify the seven symbols that were never reviewed — the gate would go green by
blessing exactly what it exists to catch.

Two honest routes, John's call:

- convert the grown sites (`./winisdDriver.js`, `./parstate.js`) and the new one (`./ini.js`)
  to named exports, deleting their baseline rows — the direction QO86 already ordered; or
- re-key the baseline to the `packages/design/...` paths and rule the seven added symbols in
  explicitly, recording that they were reviewed.

## Verification

The current export-ratchet test targets the `packages/design` paths and its current baseline;
the historical verification note is stale. The targeted architecture tests pass.
