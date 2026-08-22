# The serialization doctrine — who may touch record JSON (human rulings 2026-08-22, QO83)

One rule: **the owner of the state serializes it — and persists it.** No code outside
the domain handles record text at all; the ONE sanctioned opaque-string handoff in the
whole app is the share-link memo (edge 4 below).

The driver record's JSON shape (`_OpenISDDriverJson`) is class-private to
`@openisd/model`. No code outside the model package holds, reads, aliases, widens or
re-exports it — not via `unknown`, not via a renamed type, not via a getter that returns
it (behavioral rule §ENCAPSULATION IS ABSOLUTE). The PrivateAllow list is not a grant
channel; the target state is that it is EMPTY for this type, because nothing outside the
model has anything private left to want.

## The five edges where data leaves the JavaScript heap

These are the only places serialized record text legitimately exists, and at each the
string is opaque to the code that carries it:

### 1. Browser storage (My Drivers, project autosave)
The domain persists itself: the model/managed layer receives the `KeyValueStore` as an
injected capability and does its own `save`/`load` against it — no UI-layer module
ferries record strings to storage. Outbound is the owner serializing into its injected
store; inbound is the owner parsing what it stored (or the broken-row / upgrade-chain
path of `MY_DRIVERS_STORAGE_FAILURES.md`, which the owner also runs, on text, before
constructing the domain object). Nothing outside the owner reads a field or holds the
text.

### 2. The bundled catalogue
A build-time artifact: `scripts/bundle-drivers.mjs` writes
`packages/ui/src/drivers-bundle.json`, compiled into the app by the bundler
(`main.ts` imports it). The one runtime seam is the composition root passing each
record through the model ONCE; nothing downstream of that seam sees record data.
Bundled drivers are by construction current with the code they ship inside — the
upgrade chain never applies to them.

### 3. Files (.oid driver files, .oip project files, .wdr/.owdr imports)
File handling lives INSIDE the owning model class — that placement is the point: the
file code has legitimate access to the JSON object because it IS the model. The human's
words: "I intentionally asked for the oid and oip file handling code to be moved into
the OpenIsdDriver model and the respective [project] file so that the file access has
access to the json object."
EVERY serialization method is `#`-private (human ruling 2026-08-22: "the dialog has no
right to serialise anything or see serialised data" — and that goes for every
non-owner): `#toJsonRecord`, `#fromJsonRecord`, `#toOwdrText`, `#toWdrText`,
`#fromWdrText`, `#fromOwdrText`. The public surface is domain operations plus the
model-owned file seam: save takes (domain object, format, injected sink capability) and
load takes (injected source capability) returning a domain object — text exists only
inside the model's own file code, between the private serializer and the sink/source.
UI-layer modules and dialogs do orchestration only: they hand over and receive DOMAIN
OBJECTS, never text.

### 4. Share links — the memento pattern
The link builder has NO access to record JSON. It asks each state owner (model classes,
stores) for an opaque **memo** — a string only that owner can produce and later consume
to re-establish its state — and the link code does nothing but concatenate memos out
and split them back in. The human's words: "it should ask the various components for an
opaque 'memo' that can be used to reestablish state."

### 5. The V8 bridge (pipeline side)
Python holds opaque strings by its own ruled contract (QT69: JSON-string in/out). It
never touches the TypeScript type — outside this doctrine's scope by design.

## What this makes true

- `@openisd/model` is the only package that parses or produces record JSON, inside
  `fromJsonText`/`toJsonText`/`fromFileText` and the per-format importers.
- Field access from outside the model goes through model-exported functions
  (`readCell`, `driverId`, `recordIsSimulatable`, `driverHasDqIssues`) applied to
  domain objects — never to raw records.
- The leading-underscore privacy gate and the no-re-export gate enforce the doctrine
  mechanically; a new PrivateAllow request for the record type signals a design error,
  not a missing grant.

## Remediation register — every known domain-internal-state site (human directive
## 2026-08-22: each row is either DIRECTLY SANCTIONED by John or carries a documented
## remediation plan; no third state)

| Site | Disposition |
|---|---|
| `db/myDrivers.ts` | REMEDIATE: becomes domain-owned persistence — the owner saves/loads itself against the injected `KeyValueStore` (QO81 package: uuid keying, upgrade chain, broken rows). NOTE the leak here is also by RESOLVED TYPE, not only named import: `MyDriverRepo.list()`/`createMyDriverRepo()` signatures resolve to hidden private types (`_SpecEntry`, `_Specs`, `_ScrapedField`, …) even where the source never names them — a grep for `_OpenISDDriverJson` alone will not find it; the strengthened QO73 gate does |
| `db/driverRepo.ts` | REMEDIATE: one composition-root seam; each bundle record passes through the model once; downstream holds domain objects only |
| `logic/managedDriver.ts` | REMEDIATE: complete the file-IO move INTO the model classes (`OpenISDDriver.fromFileText(text, fileName)`, project-class equivalent); the `_OpenISDDriverJson` import and `_driverRecordFromWdrText` are deleted |
| `logic/store.ts` | REMEDIATE: private-type import removed (in A6's running rework; verify at its commit) |
| `logic/driverSelection.ts:148,239` | REMEDIATE: calls the model's real API with the domain object; the stringify-to-talk-to-the-domain path is deleted |
| `logic/driverLibrary.ts` | REMEDIATE: model API instead of record typing; its re-export offence dies with the no-re-export gate |
| `DriverEditorModal.vue:335,341,389,462` | REMEDIATE (human, verbatim: "the driver editor should work against the domain api and it should never touch the json - it should hand the domain [object] to the save api"; and on the dialog calling `toOwdrText()` itself: "this is a horror story it is outside the openisddriver.ts file"): the dialog neither constructs NOR HOLDS serialized text in any format. `:335` upsert and `:341`/`:389` accept hand the DOMAIN OBJECT. The whole `writeDriver` path (`:452-473`) moves behind the model-owned file-save seam: the dialog hands the domain object + chosen format + the injected save-dialog capability; text comes into existence inside the model's file code and goes straight to the sink. `toJsonRecord`/`fromJsonRecord` go `#`-private; the file-text methods are called only by the model's own file IO |
| `OriginalShell.vue:467,477` | REMEDIATE: the hand-rolled `_ground` checkpoint is replaced by the memo pattern — each owner produces/consumes its own memo; the shell only assembles |
| `fileFormat.ts:124` | REMEDIATE: format sniffing moves into the model with the file-IO completion |
| `scripts/bundle-drivers.mjs` | SANCTIONED (John, edge 2): build-time, pipeline side |
| `db/prefs.ts` | SANCTIONED: UI-own preference state, no domain internals |
| `db/prLibrary.ts` | REMEDIATE: stores `UiParams` bags; folds into the PR domain-object rework (D14 item 5 / QO77 pattern) |

A site not in this register that is found handling domain internal state is a NEW
finding: it gets a row here (with its plan) the day it is found, never a quiet pass.
