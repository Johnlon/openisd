# BUG_20261013_project-driver-uuid-reminted-on-read

**Status:** OPEN (reopened 30 Oct 2026, T622). The 16 Oct ruling stands (John): an embedded driver is a value object with no id of its own; the project is the entity. Bundled drivers and My Drivers are entities with ids. An embedded copy of a bundled driver carries that catalogue id as a cross-reference only. No instance id, minted or stored. It was marked fixed by the slim driver task (T158), but at main 9bc0de1d6 the ruling is not built: `slimDriver.ts:63` still keeps `device.uuid`, and `OpenISDProject.wrap` and `wrapSession` (`openISDProject.ts:468,487,489`) still call `freshEmbeddedDriver`, which mints a new one on every load.

Failing test: `packages/design/test/domain/project/stored-text.test.ts`, "is the same text, byte for byte, after a load and a store". It shows a second difference besides the id: the order of fields inside the stored text changes on a load and store (e.g. `SPL_dB` moves after `Xmax_m`, `endCorrection_m` moves to the end of each vent).

## Symptom
Loading a stored project and saving it again never gives the same bytes, because the driver embedded in the project gets a new uuid on every read, so every load rewrites the store.

## Evidence
`packages/persistence/test/storageUpgrade.test.ts`, "a dump at the current layout is a fixed point": the many-projects dump written back through the loaders differs from itself in exactly one place per project text, `driverEmbedding.device.uuid.value` (`00000000-0000-4000-8000-000000000019` becomes a random uuid). The test has to blank that id on both sides (`withoutMintedIds` in `packages/persistence/test/fixtures/storeSummary.ts`) to pass. Same effect on `openisd_state` and `openisd_open_sessions`.

## Cause
`OpenISDProject.fromOwprText` ends in `freshEmbeddedDriver` (`packages/design/domain/project/freshEmbeddedDriver.ts`), which replaces `driverEmbedding.device.uuid` with `appContext.newId()` on every read. `OpenISDProject.sameOwprText` and `withoutDriverId` exist only to compare two reads with that id ignored.

## Fix proposal
The stored uuid is read back and kept. A project read from the store keeps the id it was saved with; only a driver adopted from outside (library pick, `.wdr` / `.owdr` file) is given a fresh id. Then load then save is byte-identical, `sameOwprText` can compare plain text, and `withoutMintedIds` is deleted from the fixed-point test, which then compares the dump byte for byte.
