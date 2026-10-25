# Browser Storage Keys

OpenISD's browser persistence uses `localStorage`. The authoritative key list is
`packages/persistence/src/repos/storageKeys.ts`; repositories import those constants instead of
declaring string literals. `packages/ui/src/diagnostics/faultLog.ts` declares its own
`openisd_state` literal, since it must read the key even if the persistence module fails to load.

| Key | Purpose |
|---|---|
| `openisd_state` | The most recently saved project state |
| `openisd_projects` | The saved-project library, containing every saved project |
| `openisd_open_sessions` | Projects open after refresh and the focused-project identity |
| `openisd_view` | UI preferences, chart state, cursor, units, and layout |
| `openisd_my_drivers` | Drivers created or saved by the user |
| `openisd_my_passive_radiators` | Passive radiators created or saved by the user |
| `openisd_favourite_drivers` | Favourite IDs for bundled or user-saved drivers |
| `openisd_quarantine_driver` | Temporary diagnostic backup for a refused driver record |
| `openisd_app_settings` | Options: air defaults, vented limits |
| `openisd_refused_<UTC stamp>[_<nn>]` | A project that would not load, kept whole. JSON `{at, reason, name, text}`; `text` is the stored project text verbatim; `reason` is `wouldNotLoad`. Written by `StorageBackup.refuse`, listed by `refusedCopies`, read by `readRefused`, removed only by `discardRefused`. Outside whole-store backups; nothing drops it for room except a whole-store backup, and an identical text is kept once |
| `openisd_backup_<build>_<time>` | Whole-store backup, taken before any destructive write |

## One store per deployment

`localStorage` is shared by every page of an origin, so a deployment that sits beside the released
app would read and overwrite its projects. The /test/ build therefore keeps a store of its own:
every key it holds is stored as `test/<key>` (`test/openisd_projects`, `test/openisd_backup_…`).
The root app, the `/v/<stamp>/` releases and the `/snap/<stamp>/` snapshots keep the plain
`openisd_` keys as they always were; there is no migration.

`StoragePrefix` (`packages/persistence/src/storage/storagePrefix.ts`) is resolved once at start-up
from the page's path (`createStoragePrefix(location.pathname)`) and handed to
`createLocalStorage`. Everything above the storage port keeps using the plain key names above: the
port adds the prefix on the way in, lists only its own keys, and watches only its own keys. The list
of prefixed deployments is `PREFIXED_DEPLOYMENTS` in that file. `sessionStorage` is per tab and is
not prefixed.

All keys use the `openisd_` prefix, lowercase words, and underscores. There are no dotted-key
aliases and no migration from earlier names. A developer clearing browser storage is expected to
lose records under the old names.

## Stored project shape

`openisd_projects` and `openisd_open_sessions` hold `{entries: [{id, text, modified, traceHidden?}], focusedId?}`
as compact JSON. Each `text` is a `.owpr` session `{label, saved, edited}`, also compact. It carries
no `dq_calculated` (load works it out again). The embedded driver in `saved` and `edited` is the slim
copy from `packages/design/domain/project/slimDriver.ts`: identity, each parameter's state, value and
stated precision, and the provided-by, comment and added texts; sources, readings and quality marks
stay in the catalogue record. `.owpr` files and share links use the same slim copy. A one-time rewrite
at start-up compacts older stores, behind a whole-store backup.
