# Cloud Sync — Developer Guide

## What syncs

| Local key | Doc kind | Syncs | Conflict rule |
|---|---|---|---|
| `openisd_projects` (entries `{id, text, modified}`) | `project`, one doc per entry, body = `.owpr` text | yes | keep both |
| `openisd_my_drivers` (envelope `{uuid, record}`) | `driver`, one doc per entry | yes | keep both |
| `openisd_my_passive_radiators` | `pr`, one doc per entry | yes | keep both |
| `openisd_app_settings` | `settings`, one doc | yes | Lamport `seq`, tie → writer id |
| `openisd_favourite_drivers`, `openisd_favourite_passive_radiators` | `favourites`, one doc | yes | Lamport `seq`, tie → writer id |
| `openisd_state`, `openisd_open_sessions`, `openisd_quarantine_session` | — | no | this device's open tabs |
| `openisd_view` | — | no | panel sizes, chart ranges |
| `openisd_backup_*`, `openisd_storage_log`, layout/build stamps | — | no | this device's store history |
| `openisd_cloud_auth`, `openisd_cloud_ledger`, `openisd_cloud_ui` | — | no, and excluded from backup/export/log | tokens, sync ledger, dismissed notices |

**Not synced:** autosave of open projects (`openisd_open_sessions`), view state (`openisd_view`), backups, storage log, and all cloud-internal keys (`openisd_cloud_*`).

## Where it is stored

The user's own Google Drive **app data folder** (`drive.appdata` scope).

- The app sees only its own hidden folder — not the user's Drive files.
- The user can see the app under Drive → Settings → Manage apps, with size and "Delete hidden app data".
- No OpenISD server holds the synced data.

## When it runs

Triggers (debounced, cross-tab serialised via `navigator.locks`):

| Trigger | Debounce / gap |
|---|---|
| App open (boot) | — |
| Window focus | 30 s since last focus trigger |
| Save (project, driver, PR, settings, favourites) | 3 s |
| Reconnect (user taps strip/button) | — |
| Periodic tick while tab visible | 60 s |

The scheduler (`syncScheduler.ts`) serialises runs; at most one extra run queues while a run is in progress.

## Conflicts

- **Edit vs edit** (both devices changed the same doc): both copies kept. Remote wins the original id; local body becomes a conflict copy with a new uuid and a visible name mark (e.g. `Sub 12 (conflict, Android phone, 13 Oct 2026, 21:05)`).
- **Edit vs delete**: edit wins (pushes as update, effectively undeleting).
- **Delete vs delete**: ledger row dropped.
- **Settings / favourites** (singleton docs): Lamport clock decides. Higher `seq` wins; tie → higher `writer` id wins. Wall clock never decides.

Conflict copies appear in the Cloud sync dialog until the user presses **Open** on a row (which opens that project/driver and marks the conflict seen).

## Backups before destructive writes

Before a sync run removes or replaces a local doc, it takes a **whole-store backup** once per run (`StorageBackup.guard`). The backup is pinned — `droppable` never picks the newest backup of each layout, which already holds. If no room for the backup, the removing step is refused (status `refused: noRoom`); pushes still happen.

## Module map

| File | Job |
|---|---|
| `design/cloud/syncStatus.ts` | `SyncStatus` and `ConflictCopy`: what the app shows. |
| `design/cloud/syncDisplay.ts` | Turns status and remembered notices into the words, glyph, strip, hint, conflict notice and dialog model for both skins. |
| `design/cloud/cloudUiState.ts` | `CloudUiState` (launches, hint dismissed, conflicts seen), parsed from storage. |
| `design/cloud/syncDoc.ts` | Doc identity (`DocId`), id brands, canonical body hash, Drive file names. |
| `design/cloud/syncRules.ts` | The resolution table for one doc; Lamport compare; tombstone purge age. |
| `design/cloud/cloudTypes.ts` | `CloudMeta`, `WriteMeta`, `CloudError`, `CloudResult`, the `Http` port types. |
| `design/cloud/driveJson.ts` | Parses Drive JSON replies into typed models, refusing anything else. |
| `design/cloud/sha256.ts` | SHA-256 for the body hash. |
| `design/cloud/conflictNames.ts` | Names a keep-both copy with device and time. |
| `design/cloud/deviceName.ts` | `DeviceName`: this device in plain words ("Android phone", "Mac"), from the user agent, for conflict copy names. |
| `design/cloud/docMigrate.ts` | Wraps and unwraps a doc body with its layout; per-doc layout steps. |
| `design/cloud/storedGrant.ts` | `StoredGrant`, parsed at the boundary. |
| `design/cloud/oauthRedirect.ts` | Builds the Google authorize URL; parses and recognises the `#access_token=` return. |
| `persistence/cloud/cloudStore.ts` | The `CloudStore` and `CloudSession` ports. |
| `persistence/cloud/http.ts` | The `Http` port over `fetch`. |
| `persistence/cloud/drive/driveStore.ts` | `CloudStore` over Drive v3 `appDataFolder` and the changes API. |
| `persistence/cloud/auth/tokenStore.ts` | This device's grant under `openisd_cloud_auth`. |
| `persistence/cloud/auth/implicitSession.ts` | Phase 1 `CloudSession`: 1 h token, one silent `prompt=none` renewal on open, Reconnect mid-session. |
| `persistence/cloud/auth/redirectGuard.ts` | Saves the open work and records the project before a redirect to Google; restores it after. |
| `persistence/cloud/auth/googleRevoker.ts` | Revokes the token on Disconnect. |
| `persistence/cloud/localDocs.ts` | The `LocalDocs` port: one local store key as a list of docs. |
| `persistence/cloud/docs/projectDocs.ts` | `openisd_projects` as `LocalDocs`. |
| `persistence/cloud/docs/savedEntryDocs.ts` | `openisd_my_drivers` and `openisd_my_passive_radiators` as `LocalDocs`. |
| `persistence/cloud/docs/singletonDocs.ts` | Options and favourites as one `LocalDocs` each. |
| `persistence/cloud/syncLedger.ts` | Per-doc sync memory under `openisd_cloud_ledger`: revisions, hashes, cursor, device id, Lamport clock, conflicts. |
| `persistence/cloud/syncRun.ts` | `SyncEngine` and `RunOutcome` types. |
| `persistence/cloud/syncEngine.ts` | One run: pull, resolve each doc, push, update the ledger. |
| `persistence/cloud/syncScheduler.ts` | Turns open, focus, save, reconnect and the visible tick into debounced runs, one at a time across tabs. |
| `persistence/cloud/cloudSync.ts` | The facade the UI uses: status, conflicts, connect, reconnect, disconnect, sync now. |
| `persistence/cloud/cloudUiStore.ts` | Stores `CloudUiState` under `openisd_cloud_ui`. |
| `ui/logic/cloudSyncWiring.ts` | Builds the session, store, ledger, docs, engine, scheduler and `CloudSync` from the composition root's parts. |
| `ui/hooks/CloudSync-hooks.ts` | Provides `CloudSync` to the skins; `useCloudSyncUi` gives both skins the same display and actions. |
| `ui/ui/components/CloudSyncBadge.vue`, `CloudSyncDialog.vue` | The icon and the dialog body, shared by both skins. |

## How to turn it on in a build

Set `VITE_GOOGLE_CLIENT_ID` to the OAuth Web client id from Google Cloud Console. The id is public; phase 1 uses no secret.

- Unset or empty: `main.ts` builds no `CloudSync`, and no sync UI renders anywhere (icon, menu entry, dialog, strip, hint). A browser spec pins this.
- Set: the icon, menu entry, dialog, strip, hint and conflict notice appear, and the app syncs once the user connects.
