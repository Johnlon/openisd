# BUG_20261013_project-driver-uuid-reminted-on-read

**Status:** FIXED 30 Oct 2026 (T622; reopened the same day). The 16 Oct ruling stands (John): an embedded driver is a value object with no id of its own; the project is the entity. Bundled drivers and My Drivers are entities with ids. An embedded copy of a bundled driver carries that catalogue id as a cross-reference only. No instance id, minted or stored. It was marked fixed by the slim driver task (T158), but at main 9bc0de1d6 the ruling is not built: `slimDriver.ts:63` still keeps `device.uuid`, and `OpenISDProject.wrap` and `wrapSession` (`openISDProject.ts:468,487,489`) still call `freshEmbeddedDriver`, which mints a new one on every load.

Failing test: `packages/design/test/domain/project/stored-text.test.ts`, "is the same text, byte for byte, after a load and a store". It shows a second difference besides the id: the order of fields inside the stored text changes on a load and store (e.g. `SPL_dB` moves after `Xmax_m`, `endCorrection_m` moves to the end of each vent).

## Symptom
Loading a stored project and saving it again never gives the same bytes, because the driver embedded in the project gets a new uuid on every read, so every load rewrites the store.

## Evidence
`packages/persistence/test/storageUpgrade.test.ts`, "a dump at the current layout is a fixed point": the many-projects dump written back through the loaders differs from itself in exactly one place per project text, `driverEmbedding.device.uuid.value` (`00000000-0000-4000-8000-000000000019` becomes a random uuid). The test has to blank that id on both sides (`withoutMintedIds` in `packages/persistence/test/fixtures/storeSummary.ts`) to pass. Same effect on `openisd_state` and `openisd_open_sessions`.

## Cause
`OpenISDProject.fromOwprText` ends in `freshEmbeddedDriver` (`packages/design/domain/project/freshEmbeddedDriver.ts`), which replaces `driverEmbedding.device.uuid` with `appContext.newId()` on every read. `OpenISDProject.sameOwprText` and `withoutDriverId` exist only to compare two reads with that id ignored.

## Fix proposal
The stored uuid is read back and kept. A project read from the store keeps the id it was saved with; only a driver adopted from outside (library pick, `.wdr` / `.owdr` file) is given a fresh id. Then load then save is byte-identical, `sameOwprText` can compare plain text, and `withoutMintedIds` is deleted from the fixed-point test, which then compares the dump byte for byte.

## John's ruling, 30 Oct 2026 (QO312, http://lap:8000/board/#QO312)
- The driver inside a project has no id of its own. Where the record type requires the field, it holds the null GUID, and the domain never exposes it: `OpenISDDriverEmbedded` has no id method.
- `uuid()` lives only on `OpenISDDriverStandalone` (bundled drivers and My Drivers). Saving a project's driver to My Drivers, or detaching it, mints a real new id.
- No pointer back to the catalogue until winisd_tools proves its catalogue ids stay the same across builds.
- Every project has a durable, mandatory id that lives with it forever: in browser storage and `.owpr`, never in `.wpr`. Older stored projects get one once, on the layout upgrade.
- Making the driver id the same as the project id was rejected: a driver saved to My Drivers from a project would carry it, and two such drivers would share an id.

## Fix (T622, 30 Oct 2026)
- The embedded driver's id is the null GUID (`domain/project/nullDriverId.ts`), written by the stored/.owpr text and set on every read; `freshEmbeddedDriver`, `sameOwprText` and `withoutDriverId` are gone.
- `uuid()` is on `OpenISDDriverStandalone` only; `OpenISDDriverEmbedded.detach()` mints a real id from the injected `AppContext.newId()`, `update()` never keeps the source's id.
- The stored text is written in the schema's key order, which fixed the moving fields.
- Every project text carries a required `id` (first field), read back as the project's identity, never in a `.wpr`. STORAGE_LAYOUT 3 adds it to stored projects, open sessions and the autosave (`layoutSteps.ts`, step 2 to 3); a `.owpr`, share link or other text with no id gets one on read. A file whose id is already open (`appState.addProject`) or stored (`projectRepo.readProjectText`) gets a new id.
- Not done: the saved-project store key (`storedIdentity` / entry id) and the project id are the same fact only for projects made or migrated under layout 3; a file copy of a stored project with the same content is mapped to the stored entry by `storeNew`, whose key then differs from the copy's id.
