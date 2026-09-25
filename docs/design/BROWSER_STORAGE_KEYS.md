# Browser Storage Keys

OpenISD's browser persistence uses `localStorage`. The authoritative key list is
`packages/persistence/src/storage/storageKeys.ts`; repositories and diagnostics import those
constants instead of declaring string literals.

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

All keys use the `openisd_` prefix, lowercase words, and underscores. There are no dotted-key
aliases and no migration from earlier names. A developer clearing browser storage is expected to
lose records under the old names.
