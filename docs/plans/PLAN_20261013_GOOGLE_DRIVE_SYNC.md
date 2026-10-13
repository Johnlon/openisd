# Google Drive sync — build plan, 13 Oct 2026

Status: APPROVED by John (UI and phase order, 13 Oct 2026). Phase 1 is being built; the tasks
in section 9 are the work. Mockups: `build/mockups/cloud-sync-{original,mobile}-{1-off,2-synced,3-reconnect,4-dialog}.png`.

## 0. Phases

| Phase | Delivers | Needs from John |
|---|---|---|
| 0 | Google Cloud project, Drive API, OAuth Web client, consent screen (`drive.appdata`), domain proof, privacy page. Does not block coding: every phase-1 task runs on fakes, and the client id is a config seam | section 3.4 |
| 1 | Drive sync with client-side OAuth redirect (`response_type=token`, no secret, no Worker). 1 h token; silent `prompt=none` renewal on open; reconnect strip mid-session. Engine, buckets, scheduler (open, focus, save, reconnect, 60 s visible tick), sync icon + Cloud sync dialog in both skins | client id when ready; one real iPhone check (P1-0) |
| 2 | Cloudflare token Worker (code + PKCE, exchange/refresh/revoke), second `CloudSession` plugged in at the composition root, engine untouched. Consent screen Published. Phase-1 users get one Connect prompt for a refresh token | Cloudflare account, secrets |
| 3 (optional) | `Delete cloud copy`; field-level merge if conflict copies prove common | ruling after phase 2 |

## 1. Goal and non-goals

Goal: a person's saved projects, saved drivers, saved passive radiators, favourites and Options
follow them between their phone, tablet and desktop, through their own Google Drive, with no
server of ours holding any of it.

| In | Out |
|---|---|
| Hidden app folder in the user's Drive (`drive.appdata`, non-sensitive scope) | Any paid or data-holding backend |
| One Google connect per device; phase 1 renews silently on open and asks again after 1 h mid-session; phase 2 refreshes without the user | Sharing between users; links to Drive files |
| Full offline use; local store stays primary | Background sync while the app is closed (iOS forbids it) |
| Never lose data: tombstones, keep-both conflicts, backup before every destructive write | Merging inside one project (phase 3 at most) |
| Same login path on iOS home-screen PWA, Android and desktop: full-page redirect | Popup login, Google Identity Services widget |
| Sync on open, focus, save (debounced), reconnect, every 60 s while visible | Real-time push from Drive |

## 2. Architecture

Decisions live in `packages/persistence` (sync) and `packages/design` (status types, user
text, formatting). `packages/ui` renders a display model and calls actions. One composition root
(`packages/ui/src/main.ts`). No module holds a global.

### 2.1 What syncs

| Local key | Doc kind | Syncs | Conflict rule |
|---|---|---|---|
| `openisd_projects` (entries `{id, text, modified}`) | `project`, one doc per entry, body = `.owpr` text | yes | keep both |
| `openisd_my_drivers` (envelope `{uuid, record}`) | `driver`, one doc per entry | yes | keep both |
| `openisd_my_passive_radiators` | `pr`, one doc per entry | yes | keep both |
| `openisd_app_settings` | `settings`, one doc | yes | Lamport `seq`, tie → writer id |
| `openisd_favourite_drivers`, `openisd_favourite_passive_radiators` | `favourites`, one doc | yes | Lamport `seq`, tie → writer id |
| `openisd_state`, `openisd_open_sessions`, `openisd_quarantine_session` | — | no | this device's open tabs |
| `openisd_view` | — | no (question 1) | panel sizes, chart ranges |
| `openisd_backup_*`, `openisd_storage_log`, layout/build stamps | — | no | this device's store history |
| `openisd_cloud_auth`, `openisd_cloud_ledger`, `openisd_cloud_ui` | — | no, and excluded from backup/export/log | tokens, sync ledger, dismissed notices |

`isStoreDataKey` gains one exclusion: keys starting `openisd_cloud_`. A backup file or export
never carries a token. The storage log does not track them.

### 2.2 Modules

| Module | One-sentence job |
|---|---|
| `design/cloud/syncStatus.ts` | The sum types the app shows: `SyncStatus`, `ConflictCopy`. |
| `design/cloud/syncDisplay.ts` | Turns a `SyncStatus` and the UI's remembered dismissals into the words, glyph, tone and badge the skins draw. |
| `persistence/cloud/cloudStore.ts` | The port a sync engine needs from any cloud: list, read, write, tombstone, and a change cursor. |
| `persistence/cloud/drive/driveStore.ts` | `CloudStore` over Google Drive v3 appDataFolder with the Drive changes API. |
| `persistence/cloud/drive/driveJson.ts` | Parses Drive JSON replies into the typed `CloudStore` models, refusing anything else. |
| `persistence/cloud/auth/cloudSession.ts` | The `CloudSession` port: a valid access token, a connect redirect, a boot callback reader, a disconnect. |
| `persistence/cloud/auth/oauthRedirect.ts` | Builds the Google authorize URL and parses what Google sends back to the redirect URI (query or fragment). |
| `persistence/cloud/auth/tokenStore.ts` | Holds this device's grant under `openisd_cloud_auth` as a parsed sum type. |
| `persistence/cloud/auth/implicitSession.ts` (phase 1) | `CloudSession` over the client-side token flow: 1 h token, silent `prompt=none` renewal on open, reconnect when Google wants the user. |
| `persistence/cloud/auth/redirectGuard.ts` (phase 1) | Flushes autosave and records the return path before any top-level redirect, and restores it after. |
| `persistence/cloud/auth/tokenWorkerClient.ts` (phase 2) | Talks to the token Worker's three endpoints and parses its replies. |
| `persistence/cloud/auth/workerSession.ts` (phase 2) | `CloudSession` over code + PKCE: refreshes through the Worker, says when the grant is gone. |
| `persistence/cloud/syncDoc.ts` | Doc identity (`DocId` sum type), brands, canonical body hash. |
| `persistence/cloud/syncLedger.ts` | Per-doc sync memory under `openisd_cloud_ledger`: last synced revision and hash, change cursor, device id, Lamport clock. |
| `persistence/cloud/buckets/projectBucket.ts`, `savedEntriesBucket.ts`, `singletonBucket.ts` | Each exposes one local store key as `LocalDocs` (list, put, remove through `backup.guard`, per-doc layout migration). |
| `persistence/cloud/syncEngine.ts` | One run: pull remote changes, resolve each doc, push local changes, update the ledger. |
| `persistence/cloud/syncScheduler.ts` | Turns open, focus, save, reconnect and the 60 s visible tick into debounced, cross-tab-serialised engine runs. |
| `persistence/cloud/cloudSync.ts` | The facade the UI holds: current `SyncStatus`, conflict copies, and the four actions. |
| `cloudflare/token-worker/worker.js` (phase 2, repo root dir, not a package) | Exchanges and refreshes OAuth tokens with the client secret; stores nothing. |

Phase 2 swaps `implicitSession` for `workerSession` in `main.ts`. Engine, scheduler, buckets,
ledger and the UI see only `CloudSession` and `CloudSync`, and do not change.

### 2.3 Interfaces

```ts
// ---------- design/cloud/syncStatus.ts ----------
export type DeviceId = string & { readonly __brand: 'DeviceId' };
export type SyncStatus =
  | { kind: 'off' }                                                       // never connected on this device
  | { kind: 'connecting' }                                                // boot callback in flight
  | { kind: 'syncing'; account: string }
  | { kind: 'synced'; account: string; at_ms: number; conflicts: number }   // nothing pending
  | { kind: 'pending'; account: string; at_ms: number | null; changes: number }   // local changes not yet pushed (debounce, or last run stopped early)
  | { kind: 'offline'; account: string; at_ms: number | null; changes: number }
  | { kind: 'reconnect'; account: string; changes: number }               // Google wants the user
  | { kind: 'held'; account: string; at_ms: number | null; heldDocs: number }   // docs from a newer layout
  | { kind: 'refused'; account: string; reason: 'noRoom' | 'bucketUnreadable' }
  | { kind: 'failed'; account: string; reason: string };
export interface ConflictCopy { readonly id: ProjectId | DriverId | PrId; readonly name: string; readonly from: DeviceId; readonly at_ms: number }

// ---------- design/cloud/syncDisplay.ts ----------
export type SyncTone = 'muted' | 'accent' | 'good' | 'warn' | 'bad';   // --mut, --acc, --good, --acc2, --bad
export type SyncGlyph = 'cloudOff' | 'cloudBusy' | 'cloudDone' | 'cloudSlash' | 'cloudAlert';
export type SyncTap = 'openDialog' | 'reconnect';
export interface SyncDisplayInputs {
  readonly status: SyncStatus;
  readonly conflicts: readonly ConflictCopy[];
  readonly conflictsSeen: number;        // count already shown in a notice (openisd_cloud_ui)
  readonly hintDismissed: boolean;       // the one-time "Sync your projects?" hint
  readonly launches: number;             // app starts on this device (openisd_cloud_ui)
  readonly updateBannerShown: boolean;   // mobile: the new-version banner owns the slot
}
export interface SyncDisplay {
  readonly glyph: SyncGlyph; readonly tone: SyncTone; readonly badge: number | null;
  readonly shortText: string;            // menu row: "Synced 23:32", "Off", "Reconnect"
  readonly text: string;                 // dialog headline: "Synced 13 Oct 2026, 23:32"
  readonly tooltip: string; readonly tap: SyncTap;
  readonly strip: { text: string; button: string } | null;             // reconnect strip/banner
  readonly hint: { text: string; yes: string; no: string } | null;       // one-time offer
  readonly conflictNotice: { text: string; button: string } | null;      // one-time per new conflicts
  readonly dialog: SyncDialogModel;
}
export interface SyncDialogModel {
  readonly headline: string; readonly account: string | null;
  readonly pendingLine: string | null;   // "2 changes not synced" — null whenever headline says Synced
  readonly buttons: readonly ('connect' | 'syncNow' | 'reconnect' | 'disconnect')[];
  readonly conflicts: readonly { id: ConflictCopy['id']; title: string; sub: string }[];
}
export function syncDisplayOf(i: SyncDisplayInputs): SyncDisplay;   // uses fields/format.ts formatDateTime

// ---------- persistence/cloud/syncDoc.ts ----------
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type DriverId  = string & { readonly __brand: 'DriverId' };
export type PrId      = string & { readonly __brand: 'PrId' };
export type DocId =
  | { kind: 'project'; id: ProjectId } | { kind: 'driver'; id: DriverId } | { kind: 'pr'; id: PrId }
  | { kind: 'settings' } | { kind: 'favourites' };
export type DocKind = DocId['kind'];
export type FileId = string & { readonly __brand: 'FileId' };
export type RevisionId = string & { readonly __brand: 'RevisionId' };
export type ChangeCursor = string & { readonly __brand: 'ChangeCursor' };
export type BodyHash = string & { readonly __brand: 'BodyHash' };
/** SHA-256 over the canonical form: JSON parsed and re-serialised with sorted keys, no
 *  whitespace. Two bodies that differ only in key order or formatting hash the same, so an
 *  open-then-autosave is not a local edit. */
export function bodyHashOf(body: string): BodyHash;
export function docFileName(id: DocId): string;

// ---------- persistence/cloud/cloudStore.ts ----------
export interface CloudMeta {
  readonly id: DocId; readonly fileId: FileId;
  readonly revision: RevisionId;
  readonly parentRevision: RevisionId | null;   // revision the writer had synced before it wrote
  readonly layout: number; readonly seq: number; readonly writer: DeviceId;
  readonly deleted: boolean;
  readonly remoteHash: BodyHash | null;         // from appProperties.hash (our canonical hash, written with the body)
}
export interface CloudDoc { readonly meta: CloudMeta; readonly body: string }
export interface WriteMeta { readonly parentRevision: RevisionId | null; readonly layout: number; readonly seq: number; readonly writer: DeviceId; readonly hash: BodyHash }
export type CloudResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'moved'; head: CloudMeta }           // update/tombstone: the head was no longer `expectedRevision`
  | { kind: 'offline' }
  | { kind: 'unauthorised' }
  | { kind: 'quota'; retryAfter_ms: number }
  | { kind: 'cursorExpired' }                   // Drive 410
  | { kind: 'malformed'; reason: string }
  | { kind: 'failed'; status: number; reason: string };
export interface CloudStore {
  listAll(): Promise<CloudResult<{ docs: CloudMeta[]; cursor: ChangeCursor }>>;
  changesSince(cursor: ChangeCursor): Promise<CloudResult<{ changed: CloudMeta[]; cursor: ChangeCursor }>>;
  read(fileId: FileId): Promise<CloudResult<CloudDoc>>;
  create(id: DocId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  update(fileId: FileId, expectedRevision: RevisionId, body: string, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  tombstone(fileId: FileId, expectedRevision: RevisionId, meta: WriteMeta): Promise<CloudResult<CloudMeta>>;
  purge(fileId: FileId): Promise<CloudResult<void>>;                    // tombstones past 90 days only
}
export interface Http { fetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; headers: { get(name: string): string | null }; text(): Promise<string> }> }
export function createDriveStore(deps: { http: Http; session: CloudSession; now: () => number }): CloudStore;

// ---------- persistence/cloud/auth ----------
export type StoredGrant =                                                // openisd_cloud_auth, parsed at the boundary
  | { kind: 'none' }
  | { kind: 'pending'; state: string; returnTo: string; silent: boolean; verifier: string | null }
  | { kind: 'token'; account: string; accessToken: string; expiresAt_ms: number }                       // phase 1
  | { kind: 'refresh'; account: string; refreshToken: string; accessToken: string; expiresAt_ms: number } // phase 2
  | { kind: 'reconnect'; account: string };
export interface TokenStore { read(): StoredGrant; write(g: StoredGrant): void }
export type Grant = { kind: 'none' } | { kind: 'connected'; account: string } | { kind: 'reconnect'; account: string };
export type TokenAnswer = { kind: 'ok'; token: string } | { kind: 'none' } | { kind: 'reconnect' } | { kind: 'offline' };
export type BootAnswer =
  | { kind: 'notACallback' }
  | { kind: 'connected'; account: string; returnTo: string }
  | { kind: 'denied'; returnTo: string }
  | { kind: 'failed'; reason: string; returnTo: string }
  | { kind: 'willRedirect'; go: () => void };    // phase 1 silent renewal; caller flushes first
export interface CloudSession {
  grant(): Grant;
  /** Never redirects. */
  accessToken(): Promise<TokenAnswer>;
  /** Once on boot, before the store gate. */
  onBoot(location: { search: string; hash: string }): Promise<BootAnswer>;
  beginConnect(reason: 'connect' | 'reconnect'): void;
  disconnect(): Promise<void>;
}
export interface RedirectGuard { leave(url: string): void }
export interface OAuthConfig { readonly clientId: string | null; readonly redirectUri: string; readonly scopes: readonly string[] }   // clientId null = not configured: Connect disabled, text "Not set up yet"
export function createImplicitSession(deps: { config: OAuthConfig; tokens: TokenStore; guard: RedirectGuard; http: Http; now: () => number; random: () => Uint8Array }): CloudSession;
export function createWorkerSession(deps: { config: OAuthConfig; tokens: TokenStore; worker: TokenWorkerClient; guard: RedirectGuard; now: () => number; random: () => Uint8Array }): CloudSession;

// ---------- persistence/cloud/buckets ----------
export interface LocalDoc { readonly id: DocId; readonly body: string; readonly layout: number }
export type LocalRead = { kind: 'ok'; docs: LocalDoc[] } | { kind: 'unreadable' };
export interface LocalDocs {
  readonly kind: DocKind;
  list(): LocalRead;
  /** Body in this app's layout. A doc from an older layout is migrated by `migrate` first. */
  put(doc: LocalDoc): 'done' | 'refused';
  remove(id: DocId): 'done' | 'refused';          // caller holds the guard (5.2 step 3)
  /** Returns the body in this app's layout, or null when no step reaches it. */
  migrate(doc: LocalDoc): string | null;
  /** The keep-both copy: a new uuid, a visible name mark. Never called when hashes are equal. */
  putConflictCopy(doc: LocalDoc, from: DeviceId, at_ms: number): { id: DocId } | 'refused';
  /** For projects: a pulled doc whose name a local doc already has is stored under `uniqueName`. */
}

// ---------- persistence/cloud/syncLedger.ts ----------
export interface LedgerRow { readonly id: DocId; readonly fileId: FileId; readonly revision: RevisionId; readonly hash: BodyHash; readonly seq: number }
export interface SyncLedger {
  rows(): LedgerRow[]; row(id: DocId): LedgerRow | null; set(row: LedgerRow): void; drop(id: DocId): void;
  cursor(): ChangeCursor | null; setCursor(c: ChangeCursor): void;
  deviceId(): DeviceId;                          // minted once per device
  /** Lamport: max(seen, own) + 1; `observe` on every remote seq read. */
  observe(seq: number): void; nextSeq(): number;
  conflicts(): ConflictCopy[]; addConflict(c: ConflictCopy): void; clearConflict(id: ConflictCopy['id']): void;
  forgetAll(): void;                            // disconnect, restore, reset, repair write-back
}

// ---------- persistence/cloud/syncEngine.ts ----------
export type RunOutcome =
  | { kind: 'synced'; pulled: number; pushed: number; conflicts: ConflictCopy[]; held: number }
  | { kind: 'stopped'; reason: 'offline' | 'quota'; pushedSoFar: number; pendingLocal: number }
  | { kind: 'notConnected' } | { kind: 'reconnect'; pendingLocal: number }
  | { kind: 'refused'; reason: 'noRoom' | 'bucketUnreadable'; pendingLocal: number }
  | { kind: 'failed'; reason: string; pendingLocal: number };
export interface SyncEngine { run(): Promise<RunOutcome>; pendingLocal(): number }
export function createSyncEngine(deps: { cloud: CloudStore; local: LocalDocs[]; ledger: SyncLedger; backup: StorageBackup; layout: number; now: () => number }): SyncEngine;

// ---------- persistence/cloud/syncScheduler.ts ----------
export interface SyncTriggers { onOpen(): void; onFocus(): void; onSave(): void; onReconnect(): void; onTick(): void }
export interface Timer { after(ms: number, f: () => void): () => void; every(ms: number, f: () => void): () => void }
export interface RunLock { withLock<T>(name: string, f: () => Promise<T>): Promise<T> }   // navigator.locks in the browser, a Map in tests
export function createSyncScheduler(deps: {
  engine: SyncEngine; session: CloudSession; timer: Timer; lock: RunLock; visible: () => boolean;
  onOutcome: (o: RunOutcome) => void;
  debounce_ms: number; focusGap_ms: number; tick_ms: number;   // 3000, 30000, 60000
}): SyncTriggers & { syncNow(): Promise<void> };

// ---------- persistence/cloud/cloudSync.ts ----------
export interface CloudSync {
  status(): SyncStatus; conflicts(): ConflictCopy[];
  watch(onChange: () => void): () => void;
  connect(): void; reconnect(): void; disconnect(): Promise<void>; syncNow(): Promise<void>;
  conflictSeen(id: ConflictCopy['id']): void;     // dialog Open pressed: drop from the list
}
export function createCloudSync(deps: { session: CloudSession; scheduler: ReturnType<typeof createSyncScheduler>; ledger: SyncLedger; engine: SyncEngine }): CloudSync;
```

`StorageBackup.guard` is taken once per run and only when the run will remove or replace a
local doc (5.2). A backup taken because a layout changed (`storeGate`) is pinned: `droppable`
never picks the newest backup of each layout, which already holds.

## 3. Auth

Both phases: full-page redirect to `accounts.google.com`, redirect URI = the app root
(`https://openisd.app/`, `http://localhost:4000/` in dev), the callback handled on boot before
the store gate. No popup, no Google Identity Services script (its popup escapes the iOS
home-screen app). Same path on iOS, Android and desktop.

Scopes: `drive.appdata` only, if `GET drive/v3/about?fields=user(emailAddress)` answers with
that scope alone (**verify**, P1-4); else add `openid email` and read `userinfo`.

### 3.1 Phase 1 — client-side token flow (no Worker, no secret)

Google's "OAuth 2.0 for client-side web applications" (implicit grant, `response_type=token`).
Verified 13 Oct 2026 against Google's docs: still supported for Web application clients, not
deprecated; the page calls it legacy and insecure for SPAs and recommends the code model. Risk
accepted for phase 1 (John): the token lives 1 h, grants only this app's hidden folder, and the
app loads no third-party script. `prompt=none` is documented ("no authentication or consent
screens; an error if the user is not already authenticated"); Google's page does not list the
error codes. **Uncertain**: the exact `error=` values on a failed `prompt=none` (expected
`interaction_required`, `login_required`, `consent_required`). The parser treats any `error=`
on a silent attempt as "needs the user"; P1-5 records the real value.

**Reviewer's iOS concern (unverified)**: on an iOS home-screen app a top-level navigation to
`accounts.google.com` may open in an in-app browser sheet rather than the standalone window,
and the return may land in Safari instead of the app. P1-0 checks this on a real iPhone first;
if it fails, phase 1 on iOS falls back to no silent renewal (reconnect strip only) and phase 2
moves up.

| Step | What happens |
|---|---|
| Connect | `beginConnect('connect')`: mint `state`, write `pending`, `guard.leave(authUrl)`. URL: `client_id`, `redirect_uri`, `response_type=token`, `scope`, `include_granted_scopes=true`, `state`, `prompt=consent` (first time) or `select_account` (reconnect). |
| Callback | Google returns to the root with `#access_token=&expires_in=&state=` (fragment, never sent to a server). `onBoot` reads it, checks `state` against `pending`, stores `token`, strips the fragment (`history.replaceState`), answers `connected` with `returnTo`. `#error=access_denied` → `denied`. |
| Open with token > 60 s left | nothing; sync runs. |
| Open with token missing or expiring, grant `token` | `onBoot` answers `willRedirect`: the caller flushes autosave and the open-session record, then `go()` writes `pending{silent:true}` and leaves for Google with `prompt=none`. Google returns silently (first-party Google cookie; a top-level navigation, so Safari allows it). At most one silent attempt per boot: a boot that finds `pending{silent:true}` already written does not redirect; it writes `reconnect`. |
| Silent attempt fails (`#error=…`) | grant `reconnect`; strip shown; no further automatic redirect until the user taps. |
| Mid-session expiry | `accessToken()` answers `reconnect`; status `reconnect` with the pending count; strip. Never a redirect while the user may be editing. Saves stay local and are pushed by the run after reconnect. |
| Reconnect (user tap) | `beginConnect('reconnect')` → `guard.leave`. |
| Disconnect | `GET oauth2.googleapis.com/revoke?token=` (best effort), write `none`, `ledger.forgetAll()`. Drive data stays. |

Redirect round trip never loses work: `RedirectGuard.leave` (1) commits the focused field as a
blur does, (2) saves the open projects and the committed project through the existing
`saveOpenProjects` and `saveToStorage` paths, (3) writes `returnTo`, (4) `location.assign`.
P1-6 proves the round trip with a browser spec.

### 3.2 Phase 2 — code + PKCE through the token Worker

Google's Web application client needs the client secret at the token endpoint, so PKCE alone
does not get a refresh token from the browser: the Worker holds the secret.

| Step | What happens |
|---|---|
| Connect | as phase 1, but `response_type=code`, `code_challenge` (S256), `access_type=offline`, `prompt=consent`; verifier in `pending`. |
| Callback | `?code=&state=` → `worker.exchange` → write `refresh` → strip the query → `connected`. |
| Access token | > 60 s left → it; else `worker.refresh`; `invalidGrant` → `reconnect`. No redirect, ever, except from the strip. |
| Expiry | Access 1 h. Refresh token: no expiry while the consent screen is Published (Testing: 7 days); revoked after 6 months unused or by the user. |
| Phase-1 users | a `token` grant under a phase-2 build → `reconnect` with the line "Connect once more so OpenISD can stay connected." One tap, consent screen, done. Ledger kept. |
| Disconnect | `worker.revoke(refreshToken)`, write `none`, `forgetAll()`. |

Refresh token at rest: `localStorage` under `openisd_cloud_auth`, plain (question 2). iOS may
clear site data of a rarely used non-installed site after 7 days; the home-screen app is exempt.
Outcome either way: `reconnect`, one tap.

### 3.3 Token Worker (phase 2)

Cloudflare Worker, free plan (100k requests/day, 10 ms CPU). About 80 lines. Secrets:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; `ALLOWED_ORIGINS` = `https://openisd.app,http://localhost:4000`.

| Endpoint | In | Does | Out |
|---|---|---|---|
| `POST /exchange` | `{code, codeVerifier, redirectUri}` | adds client id + secret, POST `oauth2.googleapis.com/token` | `{accessToken, expiresIn, refreshToken, account}` |
| `POST /refresh` | `{refreshToken}` | same, `grant_type=refresh_token` | `{accessToken, expiresIn}` or `{error:'invalid_grant'}` |
| `POST /revoke` | `{token}` | POST `oauth2.googleapis.com/revoke` | `{}` |

Rules: CORS only for `ALLOWED_ORIGINS`; no logging of bodies; no KV, no D1, no cache; every reply
JSON; 4xx passed through as `{error}`. The app refreshes at most once per hour per device.

### 3.4 Phase 0 — one-time setup (John; does not block coding)

1. Google Cloud: new project "OpenISD"; enable Google Drive API.
2. Privacy page `openisd.app/privacy/` (section 8) live.
3. Domain `openisd.app` verified (Search Console); OAuth consent screen: External; app name, support email, homepage, privacy URL, authorised domain; scopes `drive.appdata` (plus `openid email` only if P1-4 says so). Phase 1 may run in Testing (100 test users); phase 2 needs **Published** (non-sensitive scopes: no verification, no user cap, refresh tokens do not expire in 7 days).
4. Credentials: OAuth client, type Web application; authorised JavaScript origins `https://openisd.app`, `http://localhost:4000`; redirect URIs `https://openisd.app/`, `http://localhost:4000/`. Client id → `VITE_GOOGLE_CLIENT_ID` (public). Unset = `OAuthConfig.clientId = null`: the app builds and runs, Connect is disabled with "Not set up yet".
5. Phase 2 only: Cloudflare account, `wrangler login`, `wrangler secret put` × 2, `wrangler deploy` from `cloudflare/token-worker/`; URL → `VITE_TOKEN_WORKER_URL`.

## 4. Drive layout

- Space: `appDataFolder` only. The user sees the app under Drive → Settings → Manage apps, with size and "Delete hidden app data".
- No manifest: the change cursor plus `appProperties` is the index.
- One file per doc, flat:

| Doc | File name | Body |
|---|---|---|
| project | `project-<uuid>.owpr` | the `.owpr` text, byte-identical to File → Save |
| driver | `driver-<uuid>.json` | the saved record (`SavedEntry.record`) |
| pr | `pr-<uuid>.json` | the saved record |
| settings | `settings.json` | the `openisd_app_settings` text |
| favourites | `favourites.json` | `{drivers: [...], passiveRadiators: [...]}` |

- `appProperties` (strings, 124 bytes per pair, 30 keys): `app=openisd`, `kind`, `uuid`,
  `layout`, `parentRevision`, `seq`, `writer`, `hash` (our canonical hash), `deleted` (`1` or absent).
  Drive's `md5Checksum` is over raw bytes, not the canonical form, so our `hash` is the remote hash;
  `md5Checksum` is read into nothing.
- Revision = `headRevisionId` (moves on content writes only).
- A tombstone is `deleted=1` with the body left in place. Tombstones older than 90 days with no
  local reference are purged on a run (the only `files.delete`).
- **Resurrection after > 90 days offline**: a device that last synced before a tombstone was
  purged still has the doc and no tombstone to see; its doc is pushed back as new. Documented
  behaviour, not a bug: nothing is lost, one deleted thing comes back once. The user deletes it
  again, now with every device online within 90 days.
- Size: a project ~10–50 KB, a driver ~5 KB. 1,000 projects = 50 MB of a 15 GB Drive.

## 5. Sync algorithm

### 5.1 State per doc

Ledger row = what this device last agreed with the cloud. Derived at each run, per id across
local ∪ ledger ∪ remote:

| Local vs ledger | Meaning |
|---|---|
| present, hash = ledger | clean |
| present, hash ≠ ledger | local edit |
| present, no ledger row | local new |
| absent, ledger row | local delete |

| Remote vs ledger | Meaning |
|---|---|
| head revision = ledger revision | unchanged |
| head ≠ ledger, `parentRevision` = ledger revision | remote edit on top of what we had |
| head ≠ ledger, `parentRevision` ≠ ledger revision | remote edit that did not see our last write (5.4) |
| `deleted` | remote delete |
| no ledger row | remote new |

Before any row: if local hash = remote hash the doc is **adopted** (ledger row written, nothing
copied, nothing pushed). This rule precedes every row of 5.3.

### 5.2 One run

Runs are serialised across tabs and within a tab by `RunLock.withLock('openisd-cloud-sync')`
(`navigator.locks`); a request while a run holds the lock queues at most one more run.

1. `session.accessToken()`; none → `notConnected`; reconnect → `reconnect`; offline → `stopped`.
2. Pull: `changesSince(cursor)`, or `listAll` when no cursor or `cursorExpired`. Only
   `app=openisd` entries. `read` each changed doc whose remote hash differs from the local hash.
3. Resolve each doc by 5.3. If any outcome removes or replaces a local doc, take
   `backup.guard` once and apply every local write inside it; otherwise apply without a backup.
4. Push: every local new/edit/delete not resolved as conflict → `create` / `update(expected =
   ledger revision)` / `tombstone`. `moved` → the head changed since step 2 → re-resolve that
   doc against `head` in the same run.
5. Write ledger rows and the new cursor.
6. `offline`/`quota` mid-run: stop, keep the ledger as far as it got; outcome `stopped` with the
   pending count; the next trigger retries. Quota: wait `retryAfter_ms`, max 3 tries.

The engine never runs when the store gate opened a backup read-only (`OpenStore.readOnly`):
the composition root does not build it then.

### 5.3 Resolution (after the equal-hash adoption rule)

| Local | Remote | Outcome |
|---|---|---|
| clean | unchanged | nothing |
| clean | edit, lineage ok | apply remote |
| clean | delete | remove local (guarded; copy stays in the whole-store backup and the tombstone) |
| clean | lineage broken | our previous write was overwritten: apply remote; our ledger-era body (still local, clean) becomes a conflict copy |
| edit | unchanged | push |
| edit | edit (lineage ok or broken) | keep both: remote wins the id; local body becomes a conflict copy (new uuid, pushed as new) |
| edit | delete | edit wins: push local as update (undeletes) |
| delete | unchanged | push tombstone |
| delete | edit | edit wins: apply remote, drop the delete |
| delete | delete | drop ledger row |
| new | absent | push create |
| new | present, no ledger (backup restored on two devices) | hashes equal → adopt; else keep both |
| absent | new | apply; for a project whose name a local project has, store under `uniqueName` |
| any | remote `layout` > this app's | **held**: not applied; a local edit is not pushed over it either (the push would downgrade it); ledger not advanced; counted in `held` |
| any | remote `layout` < this app's | `migrate` on read, then as above; pushed back only when the body changes |
| bucket unreadable | any | this kind is skipped; `refused: bucketUnreadable` |

Last-writer docs (`settings`, `favourites`): Lamport clock. `ledger.observe(remote.seq)` on every
read; a local write takes `nextSeq()` = max seen + 1. Higher `seq` wins; equal → higher `writer`
id wins. Wall clock never decides anything.

Conflict copy names: project → `<name> (conflict, <device>, 13 Oct 2026, 21:05)` through
`uniqueName`. Driver/PR → model name gets ` (conflict)` (question 3). Every copy is recorded in
the ledger's `conflicts()` until the user presses Open on it.

Same name, two uuids (two devices each made "Sub 12"): both kept, the pulled one stored under
`uniqueName` ("Sub 12 (2)") on the pulling device only; names are not synced identities, uuids
are. `ProjectRepo.saveToStorage` finds an existing entry by name: `projectBucket.put` writes
by `id` directly and never goes through that path, so a pulled doc is never merged into a local
one with the same name.

Local restore, reset and repair write-back (`backupRepo.importAll`, `deleteAll`, `reset`,
the layout migrator's write-back) call `ledger.forgetAll()`: after them every local doc is `new`
and is reconciled by hash against the cloud on the next run.

### 5.4 Why lineage, not only compare-and-swap

Drive has no server-side CAS on content. `update` checks the head immediately before writing;
the window is tens of ms. If two devices still cross, the loser's revision is overwritten, but
the winner's `parentRevision` names a revision the loser never had as its base, so the loser
sees it on its next pull and keeps its own body as a conflict copy (unless the hashes are
equal). Nothing is lost; at worst a second copy appears.

### 5.5 Scenarios

| Scenario | Outcome |
|---|---|
| Edit project on A offline; edit same project on B; A comes online | A pulls B's revision, local edit + remote edit → B's stays as the project; A's edit becomes `Sub 12 (conflict, A, …)`, pushed; B pulls the copy; both show the conflict notice once. |
| Both devices made the same edit | hashes equal → adopt, no copy. |
| Open a project and let autosave rewrite it, no change | canonical hash unchanged → not a local edit, nothing pushed. |
| Delete on A; edit on B | B's edit wins everywhere; A gets the project back after its next run. |
| Delete on A; B clean | B removes it after a whole-store backup; Drive keeps the tombstone body 90 days. |
| New device, first sync, empty local | `listAll`, apply everything, ledger built. |
| New device, first sync, has its own local projects | local docs are `new` → pushed; remote applied; same-uuid clashes by hash. |
| Two devices create "Sub 12" | both kept; the pulled one is "Sub 12 (2)" locally. |
| Clock skew (phone 3 days behind) | no effect: revisions, `seq`, uuids order everything. |
| Token revoked at Google | first call 401 → `reconnect`; one tap reconnects; ledger resumes. |
| Phase 1: opened after > 1 h, Google cookie alive | silent redirect out and back before the store gate; sync runs; the user sees a flash. |
| Phase 1: opened after > 1 h, cookie gone or consent withdrawn | silent attempt returns `#error=`; reconnect strip; local work untouched. |
| Phase 1: token expires while editing | status `reconnect`, "3 changes not synced"; strip; no redirect until tapped. |
| App updated on A (layout 3), B still layout 2 | A migrates layout-2 docs on read; B holds layout-3 docs and does not push over them; B says "Update the app to sync 4 projects". |
| Backup restored on A (replace everything) | `forgetAll`; every local doc `new`; hashes reconcile; remote-only docs come back; nothing deleted remotely. |
| No room for the whole-store backup | the removing step is refused; pushes still happen; status `refused`. |
| User clears the app folder in Drive settings | `listAll` empty, no tombstones → every ledger row's doc is pushed back as new. Only a tombstone deletes. |
| Device offline > 90 days, doc deleted elsewhere and purged | the doc comes back once (section 4). |
| Same device, two tabs | `navigator.locks` serialises runs; the ledger key is `watch`ed and re-read before a run. |

## 6. UI surface (approved 13 Oct 2026; mockups in `build/mockups/`)

Rule: the skins render `SyncDisplay` and call `CloudSync` actions. Every word, colour choice,
count and "show this once" decision is made in `design/cloud/syncDisplay.ts`; the skins hold no
text. User text and date formatting live in `packages/design` (repo rule, `.claude/rules/ui.md`),
which is why the status types and the display model moved out of persistence.

### 6.1 Display model rows

| `SyncStatus` | Glyph | Tone | Badge | shortText | text / tooltip | Tap |
|---|---|---|---|---|---|---|
| `off` | cloudOff | muted | — | `Off` | `Cloud sync is off` / `Sync your work across devices through your Google Drive. Tap to turn on.` | openDialog |
| `connecting` | cloudBusy | accent | — | `Connecting` | `Connecting to Google Drive…` | openDialog |
| `syncing` | cloudBusy | accent | — | `Syncing` | `Syncing…` | openDialog |
| `synced`, no conflicts | cloudDone | good | — | `Synced 23:32` | `Synced 13 Oct 2026, 23:32` / `Up to date with Google Drive.` | openDialog |
| `synced`, conflicts N | cloudAlert | warn | N | `2 conflicts` | `Synced 13 Oct 2026, 23:32` + conflicts list / `2 projects changed on two devices. Both kept. Tap to see them.` | openDialog |
| `pending` N | cloudBusy | accent | N | `2 not synced` | `2 changes not synced` / `2 changes will sync in a moment.` | openDialog |
| `offline` N | cloudSlash | muted | N or — | `Offline` | `Offline. 3 changes not synced` / `No connection. They will sync when you are back online.` | openDialog |
| `reconnect` N | cloudAlert | warn | N or — | `Reconnect` | `Google needs you to connect again. 3 changes not synced` | reconnect |
| `held` N | cloudAlert | warn | N | `Update app` | `Update the app to sync 4 projects saved by a newer version` | openDialog |
| `refused` | cloudAlert | bad | — | `Not synced` | `Nothing synced. No room in this browser to back up first. Export, then try again.` | openDialog |
| `failed` | cloudAlert | bad | — | `Sync failed` | `Sync failed: <reason>. It will try again.` | openDialog |

Never both: the headline says `Synced …` only when `changes = 0`; with changes waiting the
headline is the pending line itself. The mockup's dialog shows both lines under one headline —
that is the one thing the build does differently from the mockup.

Glyphs: five new names on `ToolbarIcon` (one source for both skins); the tone sets the fill;
the badge is a 14 px circle at the icon's top-right, like the Save button's dirty mark.

### 6.2 Cloud sync dialog (both skins)

Opened by the icon, by `Cloud sync…` in the Original Info menu (the Original skin has no File
menu; Info is where Diagnostics and About live) and by `Cloud sync` in the Mobile main menu's
App section. Original: a centred modal, same frame as Diagnostics (`opt-h2` title with ✕, body,
footer `Close`). Mobile: `MobilePaneDialog` (full screen, Close footer, never resizes).

```
 Cloud sync                                   ✕
 GOOGLE DRIVE
 ● Synced 13 Oct 2026, 23:32          <- or: ● 2 changes not synced / ⚠ Google needs you to connect again
   Account john@gmail.com
   [ Sync now ]  [ Disconnect ]       <- off: [ Connect Google Drive ]; reconnect: [ Reconnect ] [ Disconnect ]
 CONFLICT COPIES                      <- section only when the list is not empty
   Sub 12 (conflict, phone, 13 Oct 2026, 21:05)      [ Open ]
   Both versions kept
                                                     [ Close ]
```

Off text under the headline: `Keeps your saved projects, drivers, passive radiators, favourites
and Options in a hidden folder in your own Google Drive, so they follow you to your other
devices. Nothing is stored anywhere else.` Not configured (`clientId` null): button disabled,
line `Not set up yet.`

Buttons by status: Connect only `off`; Sync now for `synced`/`pending`/`offline`/`failed`/`held`;
Reconnect only `reconnect`; Disconnect whenever a grant exists. Open on a conflict row opens
that project (or the driver in the Driver Library) and drops the row.

Disconnect confirmation (`ConfirmDialog`): `Disconnect Google Drive?` / `Your work stays in this
browser and in your Drive. Changes made after this will not sync.` / `Disconnect` · `Keep
connected`. No Pause: a paused device diverges and every reconnect becomes a conflict run.

### 6.3 Original (desktop) skin

- Icon: one `tb-btn` after Options, before Info; `title` = tooltip; click = tap.
- Room in the toolbar: today `.chart-select` is a fixed `width:324px` and `.app-brand` is
  `flex:0 1 auto; overflow:hidden`, so the brand label is what gives way (clipped in the
  mockup). Change: `.chart-select { flex:0 1 324px; min-width:200px }` and
  `.app-brand { flex:0 0 auto }` with the `.version-chip` hidden below 1200 px
  (`@media (max-width:1199px)`). The chart name ellipsises before the brand does. P1-13a asserts
  the brand text and every toolbar button are fully inside the viewport at 1024 and 1366 px, with
  no horizontal scrollbar.
- Reconnect strip: a flex row directly under the toolbar, in flow (pushes content down, overlays
  nothing), `--acc2` tint: `⚠ Google needs you to connect again. 3 changes not synced. [Reconnect]`.
  No Later button: it stays while the status is `reconnect`.
- Conflict notice: a `Flash`-style row in the same slot, once per new conflict batch:
  `2 projects changed on two devices. Both kept. [View]` (View opens the dialog; the batch is
  marked seen in `openisd_cloud_ui`).
- One-time hint, in the same slot, on the second launch of this device while `off`:
  `Sync your projects across devices? [Turn on] [No thanks]`. Either button writes
  `hintDismissed`; Turn on opens the dialog.
- Diagnostics keeps its existing jobs; conflicts live in the Cloud sync dialog only.

```
 [open][new][save][all][revert][as] | [drivers][options][☁✓²][info ▾] | [~ SPL ▾ (shrinks)] OpenISD (v…) ◄ ___ ► Hz …
 ⚠ Google needs you to connect again. 3 changes not synced.  [Reconnect]
```

### 6.4 Mobile skin

- Icon: right end of the header row (`mob-header`), after the project title, 40 × 40 px touch
  target, `flex:none`; the title keeps `min-width:0` and ellipsis. Tap = tap; long press shows
  the tooltip as a `Flash` line.
- Menu: App section row `Cloud sync` with `shortText` right-aligned and the glyph; opens the dialog.
- Strip/banner slot: the `mob-update-banner` slot above the tab bar, one banner at a time in
  this order: new-version banner, reconnect banner, conflict notice, one-time hint. The display
  model gets `updateBannerShown` and answers `strip: null` while it is true. Reconnect banner
  has no ✕; conflict notice and hint close on their buttons.

```
 ┌──────────────────────────────────────────┐
 │ ☰   Sub 12                          ☁!³ │
 ├──────────────────────────────────────────┤
 │               (tab content)              │
 ├──────────────────────────────────────────┤
 │ ⚠ Google needs you to connect again.     │
 │   3 changes not synced.     [Reconnect]  │
 ├──────────────────────────────────────────┤
 │ Box | Driver | Signal | Filters | Graph  │
 └──────────────────────────────────────────┘
   ☰ menu, App:   Cloud sync        Synced 23:32 ☁✓
```

### 6.5 Clipping and scrollbars

Desktop: section 6.3 toolbar rule; the strip is in flow. Mobile: the header icon is `flex:none`
inside the existing flex row; the dialog is `MobilePaneDialog`, body scrolls, buttons stack
100 % wide at 320 px. Browser specs (P1-13a/b) assert no horizontal overflow at 320, 1024 and
1366 px and that every dialog button is inside the viewport above the Close footer.

## 7. Failure modes and quotas

| Thing | Limit | Our use |
|---|---|---|
| Drive API, per project | 12,000 queries per 60 s | — |
| Drive API, per user | 12,000 queries per 60 s per user (Google's current figure; older docs say 1,000 per 100 s) | one run ≈ 1 changes call + 1 read per changed doc + 1 write per local change; the 60 s tick ≈ 60 calls/h/tab; debounce 3 s after a save; ≤ 1 run per 30 s on focus |
| Drive 403 `userRateLimitExceeded` / 429 | — | backoff `retryAfter`, 3 tries, then `stopped` |
| `appProperties` | 124 bytes per pair, 30 pairs | 9 pairs, revision ids ~40 chars |
| Changes page token | 410 after some days | `cursorExpired` → `listAll` |
| Cloudflare Worker free (phase 2) | 100k req/day, 10 ms CPU | ≤ 25 refresh/day/device |
| Worker down (phase 2) | — | token works up to 1 h; then `failed: "Sign-in service unreachable"`; local use unaffected |
| `localStorage` full | — | ledger write fails → `refused`; existing guard semantics |
| Google 6-month unused revoke | — | `reconnect` |
| Second Google account on reconnect | — | ledger cleared, local docs become `new` and reconcile by hash against the new account |

## 8. Privacy

- John stores nothing. The phase-2 Worker holds two secrets and passes tokens through; no logs with bodies, no KV.
- Telemetry gets one event `cloudConnected` with no account.
- Privacy page (`openisd.app/privacy/`): "OpenISD keeps your work in your browser. If you connect Google Drive, it also keeps a copy in a hidden folder in your own Drive that only OpenISD can see. We run no server that stores your data; a small sign-in service exchanges Google tokens and keeps nothing. Disconnect at any time from the cloud icon; remove the folder in Google Drive settings → Manage apps."
- Consent screen: non-sensitive scopes only; no audit, no limited-use disclosure.

## 9. Tasks

Every phase-1 task is self-contained for one external worker: it names its files, the
interfaces it implements (section 2.3), and its test path. All run on fakes; none needs a
Google client id. Order within a phase is the dependency order.

### Phase 0 — John (parallel with phase 1)

| # | Task | Done when |
|---|---|---|
| P0-1 | Google Cloud project, Drive API on | API enabled |
| P0-2 | Privacy page `openisd.app/privacy/` | renders |
| P0-3 | Domain verified; consent screen with `drive.appdata` (+ `openid email` if P1-4 says so) | saved |
| P0-4 | OAuth Web client, origins and redirect URIs of 3.4; client id handed over | `VITE_GOOGLE_CLIENT_ID` set in the hosted build |

### Phase 1

| # | Task | Files | done_test |
|---|---|---|---|
| P1-0 | iPhone check: a home-screen PWA that navigates top-level to `accounts.google.com` with `prompt=none` and returns to `openisd.app/#…` stays in the app (no in-app sheet, no Safari hand-off). A throwaway static page under `packages/ui/public/auth-probe/` that does the redirect to a public OAuth test client; John taps it once | `packages/ui/public/auth-probe/index.html` | manual; result recorded in the task file; decides whether 3.1 silent renewal ships on iOS |
| P1-1 | `openisd_cloud_*` excluded from `isStoreDataKey` and from the storage log | `packages/persistence/src/repos/storageSnapshot.ts`, `storageLog.ts` | `bash scripts/test.sh packages/persistence/test/storageSnapshot.test.ts packages/persistence/test/storageLog.test.ts`: a store holding `openisd_cloud_auth` backs up without it; the log entry has no `openisd_cloud_` key |
| P1-2 | `design/cloud/syncStatus.ts` types; `design/cloud/syncDisplay.ts` display model (6.1 table, 6.2 dialog model, strip/hint/notice ordering, never Synced + pending together) | `packages/design/cloud/syncStatus.ts`, `syncDisplay.ts` | `bash scripts/test.sh packages/design/test/cloud/syncDisplay.test.ts`: one case per 6.1 row; `synced` with changes is impossible by type; `updateBannerShown` → `strip` null; hint only on launch ≥ 2 and `off` and not dismissed; conflict notice only for `conflicts.length > conflictsSeen` |
| P1-3 | `syncDoc.ts` (DocId sum type, brands, `bodyHashOf` canonical, `docFileName`); `cloudStore.ts` types; `driveJson.ts` parsers | `packages/persistence/src/cloud/syncDoc.ts`, `cloudStore.ts`, `drive/driveJson.ts`, fixtures under `packages/persistence/test/cloud/fixtures/drive/` | `bash scripts/test.sh packages/persistence/test/cloud/syncDoc.test.ts packages/persistence/test/cloud/driveJson.test.ts`: key order and whitespace do not change the hash; a list reply with a non-openisd file is dropped; a 410 parses to `cursorExpired`; a reply missing `headRevisionId` is `malformed` |
| P1-4 | `driveStore.ts` over `Http`; `about?fields=user` probe for the account name (verify scope; fall back to `userinfo`) | `packages/persistence/src/cloud/drive/driveStore.ts` | `bash scripts/test.sh packages/persistence/test/cloud/driveStore.test.ts`: fake Http records requests; `update` after a head change answers `moved`; 401 → `unauthorised`; 403 rate → `quota` with `retryAfter_ms`; `purge` only accepts a tombstoned file |
| P1-5 | `tokenStore.ts` (StoredGrant sum type, parse at the boundary), `oauthRedirect.ts` (token-flow URL, fragment parser, `state`), `implicitSession.ts`, `OAuthConfig` seam | `packages/persistence/src/cloud/auth/tokenStore.ts`, `oauthRedirect.ts`, `implicitSession.ts`, `cloudSession.ts` | `bash scripts/test.sh packages/persistence/test/cloud/auth/implicitSession.test.ts packages/persistence/test/cloud/auth/oauthRedirect.test.ts`: wrong `state` refused; token with 30 s left → `reconnect`, no redirect; boot with expired token → `willRedirect` once, a second boot with `pending{silent}` → `reconnect`; `#error=` on the silent attempt → `reconnect`; `clientId` null → `beginConnect` is a no-op and `grant` is `none`. Record the real `error=` value in the task file after P0-4 |
| P1-6 | `redirectGuard.ts` and the boot hook: callback handled before the store gate; flush before leaving | `packages/persistence/src/cloud/auth/redirectGuard.ts`, `packages/ui/src/logic/boot.ts`, `packages/ui/src/main.ts` | `bash scripts/test.sh packages/ui/test/cloud/redirectRoundTrip.browser.spec.ts`: type into a field, trigger the silent path against a stubbed Google (route intercept), land on the same project with the edit present and the fragment gone |
| P1-7 | `syncLedger.ts` (rows, cursor, device id, Lamport, conflicts, `forgetAll`) | `packages/persistence/src/cloud/syncLedger.ts` | `bash scripts/test.sh packages/persistence/test/cloud/syncLedger.test.ts`: `nextSeq` after `observe(7)` is 8; device id stable across reads; `forgetAll` leaves nothing |
| P1-8 | Buckets with per-doc `migrate` through `LAYOUT_STEPS`; `projectBucket.put` writes by id, never by name; `uniqueName` on a pulled name clash; `putConflictCopy` | `packages/persistence/src/cloud/buckets/projectBucket.ts`, `savedEntriesBucket.ts`, `singletonBucket.ts` | `bash scripts/test.sh packages/persistence/test/cloud/buckets/*.test.ts packages/persistence/test/destructivePaths.test.ts`: a pulled "Sub 12" beside a local "Sub 12" lands as "Sub 12 (2)" with its own id; a layout-1 body migrates; conflict copy has a new uuid and the name mark; unreadable bucket lists `unreadable`; `remove` appears in the destructive-paths table |
| P1-9 | `restore`/`reset`/`repair` paths call `ledger.forgetAll()` | `backupRepo.ts`, `appSettingsRepo.ts`, `viewStateRepo.ts`, `savedEntries.ts`, `layoutMigration.ts` (an injected `onReplaced: () => void`) | `bash scripts/test.sh packages/persistence/test/backupRepo.test.ts packages/persistence/test/cloud/forgetOnReplace.test.ts`: each path fires `onReplaced` once |
| P1-10 | `syncEngine.ts` (5.1–5.4, one guard per run only when removing/replacing, held, Lamport docs, 90-day purge) | `packages/persistence/src/cloud/syncEngine.ts`, in-memory `fakeCloudStore.ts` under test | `bash scripts/test.sh packages/persistence/test/cloud/syncEngine.test.ts`: one test per 5.3 row and per 5.5 scenario; equal hashes never make a copy; a run that only pushes takes no backup; a held doc blocks the local push; the fake plays the overwrite race |
| P1-11 | `syncScheduler.ts` (debounce, focus gap, 60 s tick while visible, `RunLock`), `cloudSync.ts` facade | `packages/persistence/src/cloud/syncScheduler.ts`, `cloudSync.ts` | `bash scripts/test.sh packages/persistence/test/cloud/syncScheduler.test.ts packages/persistence/test/cloud/cloudSync.test.ts`: three saves in 3 s → one run; run during run → one queued; focus within 30 s → nothing; tick only while visible and never during a run; two fake tabs sharing a lock never overlap; `status()` maps each `RunOutcome` |
| P1-12 | Composition root: build session, store, ledger, buckets, engine, scheduler, `CloudSync`; triggers from `visibilitychange`, `online`, project/library saves; not built when the store is read-only; `navigator.locks` adapter; `openisd_cloud_ui` store for launches/hint/conflictsSeen | `packages/ui/src/main.ts`, `packages/ui/src/logic/cloudSyncWiring.ts`, `packages/ui/src/hooks/CloudSync-hooks.ts` | `bash scripts/test.sh packages/ui/test/cloud/boot.browser.spec.ts`: a `#access_token=` load connects and strips the fragment; a plain load when `off` does not redirect; read-only store opening builds no sync |
| P1-13 | Shared: `ToolbarIcon` five cloud glyphs + badge; `CloudSyncDialog.vue` (Original modal frame and `MobilePaneDialog` body share one component) | `packages/ui/src/ui/components/ToolbarIcon.vue`, `CloudSyncDialog.vue` | `bash scripts/test.sh packages/ui/test/cloud/cloudSyncDialog.browser.spec.ts` with a fake `CloudSync`: each status renders its headline and button set; Open on a conflict row calls `conflictSeen`; Disconnect asks first |
| P1-13a | Original skin: toolbar icon, toolbar room (6.3 CSS), Info menu `Cloud sync…`, reconnect strip, conflict notice, one-time hint | `packages/ui/src/ui/shells/original/OriginalShell.vue`, `packages/ui/src/hooks/OriginalShell-hooks.ts` | `bash scripts/test.sh packages/ui/test/cloud/cloudSync.original.browser.spec.ts`: at 1024 and 1366 px the brand text and every toolbar button are inside the viewport and `document.documentElement.scrollWidth <= innerWidth`; each status renders its glyph/title; the strip has no close; the hint shows on launch 2 only and never again after a button |
| P1-13b | Mobile skin: header icon, menu row, banner slot ordering, dialog in `MobilePaneDialog` | `packages/ui/src/ui/shells/mobile/MobileShell.vue`, `packages/ui/src/hooks/MobileShell-hooks.ts` | `bash scripts/test.sh packages/ui/test/cloud/cloudSync.mobile.browser.spec.ts` at 320×568 and 390×844: update banner and reconnect banner never both; every dialog button above the Close footer; no horizontal overflow; long press shows the tooltip |
| P1-14 | Docs: `docs/design/CLOUD_SYNC.md`, README line, RELEASES note | docs | `bash scripts/quiet-test.sh npm run typecheck` |

### Phase 2

| # | Task | done_test |
|---|---|---|
| P2-1 | Worker `cloudflare/token-worker/` with its own vitest (miniflare) | `worker.test.ts`: CORS refuses a foreign origin; exchange forwards the secret; the secret never appears in a reply |
| P2-2 | `tokenWorkerClient.ts` | `invalid_grant` → `invalidGrant`; network throw → `offline` |
| P2-3 | `oauthRedirect.ts` gains the code flow (PKCE, query parser) | verifier/challenge pair verifies; `?code=` with wrong `state` refused |
| P2-4 | `workerSession.ts` | expiring token refreshes once; `invalidGrant` → `reconnect`; a phase-1 `token` grant → `reconnect` with the once-more line; never answers `willRedirect` |
| P2-5 | Composition root swaps the session; `VITE_TOKEN_WORKER_URL` | `boot.browser.spec.ts`: a `?code=` load exchanges and strips the query; engine tests unchanged |
| P2-6 | John: consent screen Published; Worker deployed | one real connect on a phone gets a refresh token |

### Phase 3 — optional

| # | Task | Gate |
|---|---|---|
| P3-1 | `Delete cloud copy` (tombstone everything, then disconnect) | question 4 |
| P3-2 | Field-level merge for projects | only if the dialog shows conflict copies are common |

## 10. Open questions for John

1. Sync the view (`openisd_view`: units, chart ranges, panel sizes, chart colours) too, as a last-writer doc? Proposed: no, it is per screen size.
2. Refresh token in plain `localStorage` on the device (section 3.2, phase 2) — accepted?
3. Driver/PR conflict copies: mark the model name (`W5-1138SMF (conflict)`) so the library shows which is which? Proposed: yes.
4. "Delete cloud copy" in phase 3, or Drive's own "Manage apps → delete" is enough? Proposed: phase 3.
5. One Google account per device; switching accounts clears the ledger and reconciles local data against the new account by hash. Accepted?
