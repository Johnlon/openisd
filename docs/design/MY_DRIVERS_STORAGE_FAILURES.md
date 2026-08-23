# My Drivers — storage-failure handling (human rulings 2026-08-22, QO81 thread)

How the app behaves when the `openisd_my_drivers` browser-storage bucket, or an entry in
it, cannot be read. The seam is `packages/ui/src/persistence/repos/myDriverRepo.ts` — the
one read/write path for the bucket. Implemented (D21): the versioned envelope + upgrade
chain, uuid identity with the rename question, and every failure surface below;
`packages/ui/test/persistence/myDriverRepo.test.ts` pins each ruling.

## The governing principle

A user's saved driver in their browser has no other copy anywhere — unlike a pipeline
record, nothing can regenerate it. The app therefore NEVER destroys or silently hides
those bytes on its own. Data leaves the bucket only by the user's explicit action, and
the user is always offered their bytes (export) before any destructive choice.

## Corruption is a hard stop (human ruling, verbatim: "in all cases where there is a
## corruption like these do not allow the app to progress - require the user to decide
## on action - no cancel button")

When the bucket or an entry is unreadable, the affected surface presents a decision
modal with ONLY real actions (export / repair / delete as applicable). There is no
Cancel and no dismiss: the user must choose. The app does not write to the affected
storage until they have.

## Failure states and their handling

### Bucket unavailable (localStorage inaccessible — private mode, browser policy)
Empty list plus one visible notice: saved drivers are unavailable in this browser mode.
Not a corruption; the app proceeds otherwise.

### Bucket unreadable (not valid JSON, or JSON that is not a list)
BLESSED (human, 2026-08-22):
1. The app goes READ-ONLY on the bucket — no write may overwrite the corrupted string,
   which is still the only copy of every saved driver.
2. The My Drivers surface shows one state in place of the list: the saved drivers could
   not be read.
3. Buttons, all explicit, no cancel:
   - **Export** — downloads the raw stored string verbatim as a text file. A partially
     corrupt string usually still contains most drivers as salvageable text.
   - **Delete** — wipes the bucket and starts fresh. NEVER automatic. If the user has
     not exported in this session, the button first challenges them with that fact
     before proceeding.

### Entry with no identity
Same modal pattern: tell the user which entry is affected, offer Export (that entry's
raw JSON) and, where an automatic repair is possible (e.g. the blob carries a usable
`uuid` or name material), offer the autofix — with Export available before it runs.

### Entry saved by an older app shape — the UPGRADE CHAIN (human ruling 2026-08-22)
My Drivers storage carries a format version. Every breaking change to the saved-driver
shape ships with an upgrade function; on load, the chain applies IN ORDER from the
stored object's version to the current app version, and the upgraded object is saved
over the old one — in place, same identity (the fresh-uuid rule applies to FILE IMPORT
only). Scope is My Drivers alone: bundled drivers are always current, they ship with
the dist.

An entry that still fails after the chain (corrupt, or older than the oldest upgrade)
falls back to the broken-row treatment: preserved untouched, surfaced by name with
Export (raw JSON) and Delete (challenged as above).

### Missing spec parameters are NEVER an exclusion (human ruling 2026-08-22, emphatic)
A driver with no Fs is no different from a new driver the user created and left blank:
it shows in every list, opens in the editor, and gets the ordinary degraded treatment
in a design. Nothing anywhere may hide a driver for missing spec parameters — flags
(the ⚠ badge) yes, exclusion never.

## Ideas recorded for follow-up (not yet designed)

- **Identity — RULED (human 2026-08-22)**: My Drivers keys on the record `uuid`
  (`openisdDriver.ts:87`), minted at save when absent (`empty()` and `fromWdr()` seed
  `uuid: ''`). `<brand>/<model>` becomes display naming; same-name drivers coexist.
- **Rename — RULED (human 2026-08-22, "option 3")**: when a save would change a
  driver's brand/model, the app asks ONE question — rename this driver (same uuid,
  edited in place) or save as a copy (new uuid, original untouched). Nothing silent;
  Clone remains the explicit fork.
- **Fresh uuid on file import** (human ruling 2026-08-22): under uuid-keyed storage,
  importing a driver from a file ALWAYS mints a new uuid — the file's own uuid is
  never adopted as the store key, so importing the same file twice yields two entries
  and can never silently overwrite an existing saved driver. The file's original uuid
  survives as provenance only.
- **`.wdr` Comment as the openisd sidecar** (human, 2026-08-22): when exporting to
  `.wdr`, stuff the driver's `uuid` — and other openisd facts that have no INI field —
  into the `.wdr` `Comment` field, so a round-trip through WinISD-format files can
  carry identity and provenance the INI model cannot.
