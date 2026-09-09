# Three comments name the project file `.openisd.json` when it is saved as `.owpr`

Status: OPEN

## Symptom

The four disk extensions are `.owpr` (our project), `.owdr` (our driver), `.wpr` and `.wdr`
(WinISD's). The code writes `.owpr`:

```ts
packages/persistence/src/repos/projectRepo.ts:169
/** The project file extension. A bare `.json` is also accepted on the way in. */
export const PROJECT_EXT = '.owpr';
```

Three comments tell a reader something else:

```
packages/persistence/src/repos/projectRepo.ts:157
 * The FILE NAME is the source of truth for a project's name. Opening `glob 3.openisd.json`
 * gives the project `glob 3`; saving the project `glob 3` writes `glob 3.openisd.json`.

packages/ui/src/ui/components/ExportMenu.vue:5
 * Save As (native .openisd.json, via the File System Access API), Save as a WinISD .wpr

packages/ui/src/logic/useApplicationIO.ts:6
 * Design file I/O orchestration — Save/Save As the project (.openisd.json) to the filesystem,
```

`.openisd.json` appears nowhere in the code — only in these three comments. Anyone reading them
looks for a file the app never writes, and the `projectRepo.ts` one is nine lines above the
constant that contradicts it.

## Evidence

Searched 2026-09-08 for `openisd.json` across `packages/persistence/src`, `packages/ui/src` and
`packages/design`: three hits, all comments, no code. `PROJECT_EXT` is the only extension the
save path uses (`projectRepo.ts:189, 200, 202`).

## Cause

The project file extension became `.owpr`; the comments describing the older `.openisd.json`
name were not updated with it.

## Fix

Correct the three comments to `.owpr`.

## Verification

None yet — recorded, not fixed.
