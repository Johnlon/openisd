# OpenISD — architecture specification

**This document specifies the system.** It defines the boundaries, the layers, the dependency
direction, the driver model, the runtime data flow and the invariants that hold across the whole
application.

## The standing of this document

**This document is the authority.** Where any other document, plan, rule file, comment, test name
or code comment disagrees with it, **this document is correct and the other is wrong**.

**A conflicting document is a cleanup item, never a blocker.** Raise it as a TODO in
[`docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md`](docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md) and
carry on. Nobody stops work to reconcile a stale document, and nobody weakens this specification to
match one.

**Code that does not match this specification is unfinished work.** It is tracked in the migration
plan and it is not an argument about what the system is. The specification states the system; the
code catches up to it.

## What this document does not specify

Each row below has an owner, and that owner is the authority for the detail. This document states
the boundary and points at it.

| Detail | Authority |
| --- | --- |
| Engine formulas, parameter units, API shapes, solver rules | [`docs/spec/SPEC_ENGINE.md`](docs/spec/SPEC_ENGINE.md) |
| UI presentation rules, tooltips, panel layout, control conventions, chart behaviour | [`docs/spec/SPEC_UI.md`](docs/spec/SPEC_UI.md) |
| What the app remembers, and when an edit commits | [`docs/design/STATE_MODEL.md`](docs/design/STATE_MODEL.md) |
| The fields of the driver record and what each means | [`docs/design/DRIVER_RECORD_MODEL.md`](docs/design/DRIVER_RECORD_MODEL.md) |
| WinISD's `.wdr`/`.wpr` byte format, reverse-engineered | [`docs/design/WDR_SCHEMA.md`](docs/design/WDR_SCHEMA.md) |
| Work items and gaps | [`BACKLOG.md`](BACKLOG.md), [`docs/plans/`](docs/plans/) |
| Dev workflow, ports, testing strategy | [`AGENTS.md`](AGENTS.md), [`openspec/project.md`](openspec/project.md) |

---

## 1. System context

OpenISD is a single-page browser application with no backend. Everything inside the boundary runs
in the user's browser; everything outside it is a file, a repository, or a static host.

```mermaid
graph LR
    USER(["Speaker designer"])

    subgraph app["OpenISD — browser SPA"]
        APP["Vue 3 + TypeScript app<br/>packages/ui · packages/model<br/>packages/engine · packages/winisd"]
    end

    PAGES["GitHub Pages<br/>openisd.app<br/>static host + PWA cache"]
    LS[("localStorage<br/>committed design · My Drivers<br/>favourites · session · URL-hash share")]
    BUNDLE[("drivers-bundle.json<br/>driver commons, bundled at build")]
    WDR[("WinISD files<br/>.wdr driver · .wpr project")]
    OWDR[("Native files<br/>.owdr driver · .owpr project")]
    DRIVERS["winisd_drivers repo<br/>openisd.yml commons"]
    TOOLS["winisd_tools<br/>Python scraper pipeline"]

    USER <--> APP
    PAGES -.serves.-> APP
    APP <--> LS
    BUNDLE -.build-time import.-> APP
    APP <-->|import / export| WDR
    APP <-->|read / write| OWDR
    DRIVERS -.published as.-> BUNDLE
    TOOLS -.invokes JS for yml to wdr.-> APP
```

### The no-backend boundary

**The simulator runs entirely in the browser.** No server, no account and no API call is required
for the physics, for file operations, or for reading the driver commons. The Thiele/Small model is
pure mathematics and needs no server; a backend costs money to run, adds availability risk, and
creates pressure toward paywalling a tool whose purpose is to be unconditionally free.

**A backend implies an authentication stack.** The moment a backend exists, authn/authz is
required, which means an identity provider and session management. **A feature that requires a
backend — accounts, cloud storage, collaborative editing — is out of scope.** A cloud feature that
is desirable anyway (Google Drive, for example) is strictly opt-in and degrades gracefully to the
no-cloud path.

### The driver commons is a build-time artifact

`drivers-bundle.json` is compiled from the `winisd_drivers` repository's `openisd.yml` records and
imported at build time. It is not a live API. A driver added to the commons reaches users on the
next deploy.

### `openisd.yml` is read and written exclusively by JS/TS owned by OpenISD

There is one implementation of each transform, not one per language. When the Python pipeline in
`winisd_tools` needs an `openisd.yml` from a `driver.yml`, or a `.wdr` from an `openisd.yml`, it
invokes the OpenISD JS/TS with input and output paths.

**The call is in-process, into an embedded V8** — not a subprocess and not an RPC. The contract
across that boundary is **string in, string out, and it never throws**: invalid input and
well-formed-but-wrong input both come back as `Result{value: null, errors}`, because a thrown value
cannot usefully cross an embedded-V8 boundary. The projection algorithm itself is
[`docs/spec/SPEC_ENGINE.md`](docs/spec/SPEC_ENGINE.md) §4.7.

---

## 2. Layers and components

**Four layers. Every import points DOWNWARD, one layer at a time.** No upward import, no lateral
import between siblings, and no skipping a layer — the UI does not reach past `logic` into a
service, and a service does not reach back into the app's state.

Each box is ONE responsibility. A module that both fetches data and drives the UI has two, and
belongs in two places.

```mermaid
graph TD
    subgraph L1["PRESENTATION"]
        UI["<b>ui/</b><br/>components · canvas · directives<br/><i>DOM. Renders state, raises intent.</i>"]
    end

    subgraph L2["APPLICATION"]
        LOGIC["<b>logic/</b><br/>store · project · driver model<br/>workflows · field registry · series<br/><i>The only holder of app state.</i>"]
    end

    subgraph L3["SERVICES — arguments in, data out, no app state"]
        DRIVERREPO["<b>driverRepo</b><br/>the driver commons:<br/>index · search · lookup"]
        MYREPO["<b>myDriverRepo</b><br/>user-saved drivers"]
        PREFS["<b>prefsStore</b><br/>favourites · session · layout"]
        FILEIO["<b>fileIO</b><br/>open · save · share link"]
        DIAG["<b>diagnostics</b><br/>runtime self-test"]
        LOGGING["<b>logging</b><br/>flash · alerting"]
    end

    subgraph L4["DOMAIN — headless, no DOM, no browser"]
        MODEL["<b>@openisd/model</b><br/>the OpenISD record<br/>and OpenISDDriver"]
        ENGINE["<b>@openisd/engine</b><br/>physics: derive · sweep · circuit<br/>alignments · filters · constants"]
        SERIAL["<b>@openisd/winisd</b><br/>serialisation ONLY:<br/>.wdr · .wpr · ParState"]
    end

    ROOT["<b>composition root</b> · main.ts<br/><i>the ONLY place that constructs anything</i>"]

    ROOT -.constructs & injects.-> LOGIC
    ROOT -.constructs.-> DRIVERREPO
    ROOT -.constructs.-> MYREPO
    ROOT -.constructs.-> PREFS
    ROOT -.constructs.-> FILEIO
    ROOT -.constructs.-> DIAG
    ROOT -.constructs.-> LOGGING

    UI --> LOGIC
    LOGIC --> DRIVERREPO
    LOGIC --> MYREPO
    LOGIC --> PREFS
    LOGIC --> FILEIO
    LOGIC --> DIAG
    LOGIC --> LOGGING
    LOGIC --> MODEL
    DRIVERREPO --> MODEL
    MYREPO --> MODEL
    FILEIO --> SERIAL
    FILEIO --> MODEL
    DIAG --> ENGINE
    MODEL --> ENGINE
    SERIAL --> MODEL

    classDef pres fill:#3d2b16,stroke:#fbbf24,color:#fff8e8
    classDef app fill:#2a2440,stroke:#a78bfa,color:#f2ecff
    classDef svc fill:#1e3050,stroke:#60a5fa,color:#eaf2ff
    classDef dom fill:#1b3a2f,stroke:#4ade80,color:#e8fff4
    classDef root fill:#402020,stroke:#f87171,color:#ffecec
    class UI pres
    class LOGIC app
    class DRIVERREPO,MYREPO,PREFS,FILEIO,DIAG,LOGGING svc
    class MODEL,ENGINE,SERIAL dom
    class ROOT root
```

**Solid arrow = "is given, and calls". Dotted = "constructs".** Only the composition root
constructs. Every other arrow is a collaborator that arrived as an argument, so the thing at the
tail can be exercised in a test with a substitute at the head.

### Modules, purpose, and injected dependencies

**No module-level singletons, and no exported mutable bindings.** Each module exports a
`create<Name>(deps)` factory and nothing pre-built: a ready-made instance cannot be substituted, so
every consumer of one becomes untestable in isolation. `state` is created by the store factory and
handed to whoever needs it — it is not importable.

| Module | Single responsibility | Injected dependencies |
| --- | --- | --- |
| `main.ts` — composition root | Construct every service and the store, wire them, mount the app | — (it is the top; nothing injects into it) |
| `createStore` | Hold the application's state and nothing else | `driverRepo`, `myDriverRepo`, `prefsStore`, `fileIO`, `logging` |
| `logic/` workflows | Decide what the app does next — driver chosen, project opened, what-if applied | the store, plus whichever services that workflow needs |
| `createDriverRepo` | Answer questions about the driver commons: index, search, filter, lookup | a bundle source (`() => OpenISDRecord[]`) |
| `createMyDriverRepo` | Read, write and delete user-saved drivers by identity | a `KeyValueStore` |
| `createPrefsStore` | Browser-local preferences: favourites, session, layout | a `KeyValueStore` |
| `createFileIO` | Open, save, import, export, share-link encode and decode | the serialiser (`@openisd/winisd`), the record codec |
| `createDiagnostics` | Run the self-test and report what it found | the engine, a reporter (`(msg) => void`) |
| `createLogging` | Surface application events to the user | — (leaf; it depends on nothing) |
| `ui/` | Render state, raise intent | the app facade, via Vue `provide`/`inject` at the root |

A `KeyValueStore` is an interface — `get`/`set`/`remove`. `localStorage` is one implementation and
an in-memory map is another, which is what lets the repositories be tested without a browser.

**Why a repository, not a "db".** `driverRepo` and `myDriverRepo` answer questions about drivers
and hand back records. They take arguments and return data. They do not know a dialog is open,
they do not decide what happens next, and they never touch the store — a service that reads app
state has inverted the arrow and dragged the layer above it into its own.

**Where workflow lives.** "The user chose a driver" is a decision about what the app does next: it
belongs in `logic`, which may call a repository to fetch the record and then update its own state.
Putting that sequence inside a repository is what forces a service to import the store.

**Serialisation is a leaf.** `@openisd/winisd` turns the OpenISD record into WinISD's bytes and
back. WinISD is a consumer of our files and the reference oracle for our numbers — it is not our
model, so nothing above the domain layer knows what ParState is.

### Module responsibilities

| Module | Path | Owns | May not contain |
| --- | --- | --- | --- |
| `@openisd/engine` | `packages/engine/src/` | All electro-acoustic maths — driver derivation, circuit solve, sweeps, alignments, filters, physical constants | WinISD concepts (WDR, ParState), file formats, DOM, app state |
| `@openisd/model` | `packages/model/src/` | The OpenISD record and `OpenISDDriver`: the driver model itself, its provenance, its derivation | File formats, DOM, app state |
| `@openisd/winisd` | `packages/winisd/src/` | Serialisation to and from WinISD's files: `.wdr`, `.wpr`, ParState, the carried-key set | The driver model, derivation, live state, DOM, app state |
| `logic` | `packages/ui/src/logic/` | The app's ONLY state. Store, project/workspace model, workflows, field registry, chart-series mapping | Maths, `.vue` imports, direct construction of a service |
| `driverRepo` | `packages/ui/src/db/` | The driver commons: index, search, filter, lookup. Answers questions, returns records | App state, workflow, `.vue` imports |
| `myDriverRepo` | `packages/ui/src/db/` | User-saved drivers: read, write, delete by identity | App state, workflow, `.vue` imports |
| `prefsStore` | `packages/ui/src/db/` | Browser-local preferences — favourites, session, layout | App state, workflow, `.vue` imports |
| `designIO` | `packages/ui/src/logic/` | Open, save, import, export, share-link encode/decode | Maths, `.vue` imports, direct construction of a service |
| `diagnostics` | `packages/ui/src/diagnostics/` | Runtime self-test, solver troubleshooting, diagnostic assertions | App state |
| `logging` | `packages/ui/src/logging/` | Application event/alert surface (flash messages) | Any other module — it is a leaf |
| `ui` | `packages/ui/src/ui/` | Vue components, canvas drawing, directives, static presets | Physics, app state, anything a service owns |

### Dependency rules, and what enforces them

Every rule below is enforced by
[`packages/ui/test/ui/architecture.test.ts`](packages/ui/test/ui/architecture.test.ts) unless the
row says otherwise. It matches the SHAPE of the code — the import specifier, the exported
declaration — never prose, so a comment naming a module cannot fail it.

| Rule | Enforced by |
| --- | --- |
| `@openisd/engine` depends on nothing (zero runtime dependencies) | `packages/engine/package.json` — empty `dependencies` |
| `@openisd/model` depends only on `@openisd/engine` (+ `yaml`, for the record codec) | `packages/model/package.json` |
| `@openisd/winisd` depends only on `@openisd/model` | `packages/winisd/package.json` |
| Nothing below presentation imports a `.vue` file | the gate |
| `ui` imports `logic` and nothing below it — no service, no engine, no serialiser | the gate |
| A component imports no VALUE from `@openisd/*`; an `import type` is fine, it erases | the gate |
| A service never imports `logic`, and never imports a sibling service | the gate |
| No service exports a pre-built instance or a mutable binding | the gate |
| Every service module offers one `create<Name>(deps)` factory | the gate |
| No maths in `ui` / `logic` | `openspec/project.md` §"Important Constraints" — convention |

**A component may not call the engine.** The formula stays in `@openisd/engine`, but a component
that calls it has put a physics call in the view: the maths cannot then be changed without editing
components, and a second front-end has to re-wire those calls rather than only re-skinning. The
value a component needs is computed in `logic` and handed down as data.

**There is ONE user interface**, under `packages/ui/src/ui/`. Behaviour beyond pure presentation —
a commit boundary, a derivation, a load/save flow — is written once as a composable under
`packages/ui/src/logic/` and called from the view. A component that re-implements it is a defect.

### Service interfaces

Each service is reached only through the interface below. The composition root constructs one
implementation of each and injects it; a test constructs a different one.

```ts
/** Browser-local storage, abstracted so a repository can be tested without a browser. */
interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** The driver commons. Queries only — it owns no state and mutates nothing. */
interface DriverRepo {
  all(): readonly OpenISDRecord[];
  byId(id: DriverId): OpenISDRecord | undefined;
  search(query: string, filter?: DriverFilter): readonly OpenISDRecord[];
}

/** Drivers the user saved. Keyed by identity, which is `<brand>/<model-slug>`. */
interface MyDriverRepo {
  all(): readonly OpenISDRecord[];
  byId(id: DriverId): OpenISDRecord | undefined;
  save(record: OpenISDRecord): void;
  remove(id: DriverId): void;
}

/** Browser-local preferences. Nothing here affects a simulation. */
interface PrefsStore {
  favourites(): readonly DriverId[];
  setFavourite(id: DriverId, on: boolean): void;
  read<T>(key: string): T | undefined;
  write<T>(key: string, value: T): void;
}

/** Every crossing of the file boundary. The only place a byte stream is produced or consumed. */
interface FileIO {
  readRecord(text: string, format: RecordFormat): Result<OpenISDRecord>;
  writeRecord(record: OpenISDRecord, format: RecordFormat): string;
  readProject(text: string, format: ProjectFormat): Result<Project>;
  writeProject(project: Project, format: ProjectFormat): string;
  encodeShareLink(project: Project): Promise<string>;
  decodeShareLink(url: string): Result<Project>;
}

/** The runtime self-test. Reports; it does not decide what to do about a failure. */
interface Diagnostics {
  run(): DiagnosticReport;
}

/** The user-facing event surface. A leaf: it depends on nothing. */
interface Logging {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
```

`RecordFormat` is `openisd.yml` / `.owdr` / `.wdr`; `ProjectFormat` is `.owpr` / `.wpr`. Both are
closed unions, not open strings.

### Key data types

```ts
/** Where a value came from. `manual` is the one non-URL role: a hand-entered value. */
type SourceRole =
  | 'manufacturer_datasheet' | 'manufacturer_product_page' | 'manufacturer_listing_page'
  | 'distributor_datasheet'  | 'distributor_product_page'  | 'distributor_listing_page'
  | 'manual';

/** What ONE source published for a field. */
interface Reading {
  /** SI-canonical value. The only place a number lives. */
  read_value: number;
  /** The literal the source printed. ABSENT on a manual reading — there was no printed text. */
  actual_reading?: string;
  /** SI half-width of the interval the printed digits assert. ABSENT on a manual reading. */
  read_precision?: number;
}

/** A T/S field. No flat value: the number is at `readings[origin].read_value` and nowhere else. */
interface SpecEntry {
  origin: SourceRole;
  readings: Partial<Record<SourceRole, Reading>>;
  dq: DqMark[];
}

/** The record. This is what `openisd.yml` and `.owdr` contain, and what a repository returns. */
interface OpenISDRecord {
  uuid: BookkeepingField<string>;
  brand: ScrapedField<string>;
  model: ScrapedField<string>;
  manufacturer: ScrapedField<string>;
  sku: DerivedField<string>;
  driver_type: ScrapedField<string>;
  disposition: DispositionField;
  quality: QualityBlock;
  specs: { woofer?: SpecSection; tweeter?: SpecSection; passive_radiator?: SpecSection };
  curves?: CurvesBlock;
}

/** What a field looks like to the app. */
type CellState = 'E' | 'C' | 'N';
interface Cell {
  value: number | null;
  state: CellState;
  /** The winning source. Present only for a stated value. */
  origin?: SourceRole;
}

/** Failure is a value. Nothing in the engine throws. */
interface Result<T> {
  value: T | null;
  errors: readonly DriverError[];
}
```

**`OpenISDDriver`** is the live, editable form of an `OpenISDRecord`:

```ts
class OpenISDDriver {
  static fromRecord(record: OpenISDRecord): OpenISDDriver;
  toRecord(): OpenISDRecord;
  cell(field: SpecField): Cell;
  enter(field: SpecField, value: number): void;
  clear(field: SpecField): void;
  errors(): readonly DriverError[];
  subscribe(fn: () => void): () => void;
}
```

`SpecField` is the closed set of canonical field names, not an open string.

---

## 3. The driver model

**The application is built around `OpenISDProject` and `OpenISDDriver`.** `OpenISDDriver`'s on-disk
form is `openisd.yml` — the same schema, byte for byte. `.owdr` is the extension the browser app
uses for identical content when reading or writing a single driver to local disk. There is one
parse, not two, whether the source is a library `openisd.yml` or a user's `.owdr`.

### `OpenISDDriver` owns the app

It is the live, long-held in-memory model — every T/S field, every derived value, all provenance,
and all consistency-group derivation (Fs from Mms+Cms, Cms from Fs+Vas+Sd, and the rest of that
family). It is strongly typed against the `openisd.yml` shape — **not one uniform envelope, but
four, by field kind:**

| Envelope | Applies to | Shape |
| --- | --- | --- |
| `SpecEntry` | T/S fields, inside `specs:` only | **No flat value.** `origin` names the winning source; a required `readings` dict (≥ 1 source) carries each source's `{actual_reading, read_value, read_precision}`. The number is reachable only at `readings[origin].read_value`. |
| `ScrapedField<T>` | record-level metadata — `manufacturer`, `brand`, `model` | Flat `value: T`, plus `origin`, *optional* `readings` (populated only when ≥ 2 sources disagreed), `definition`, `dq` |
| `DerivedField<T>` | pipeline-computed — `sku`, `name` | `value: T` + `definition` + `grounds` (evidence list). No `origin`/`readings` — built, not read |
| `BookkeepingField<T>` | pure pipeline fact — `uuid` | `value: T` + `definition` |

### Provenance, and how it displays

**Any real reading displays as `E`. Only a solver result is `C`. Absent is `N`.** `E` means
STATED, not typed-by-this-user: a value that came off a datasheet and a value the user typed are
both stated facts, and both render `E`. The finer provenance — which source a reading came from —
stays on the record for the provenance inspector; it does not split the display state.

**A hand-entered value** becomes a reading under the `manual` role carrying the value ALONE.
`read_precision` and `actual_reading` are omitted: there was no printed literal to echo and nothing
stated a precision, so writing either would fabricate provenance. There is one reading shape, with
those two genuinely absent — not a second envelope for hand entry.

**A field's `origin`** stays whatever it was extracted as until the user overwrites it in the UI,
at which point it becomes `manual`. Reset reloads the prior snapshot and restores the `origin` the
field held before the edit — the ground/baseline layering in
[`docs/design/STATE_MODEL.md`](docs/design/STATE_MODEL.md) is the mechanism. A normally-calculated
field that is manually entered is written to the `.owdr` with `origin: manual` — it is an asserted
fact, not something to silently re-derive. Clearing it reverts it to calculated and removes it from
storage again.

### `WinISDDriver` is solely a serialisation device

A strongly-typed, validating class carrying **no application or calculation logic at all**. It does
not derive, hold live state, or persist between calls.

- **Export:** `OpenISDDriver`'s resolved values populate a `WinISDDriver` instance immediately
  before serialisation to `.wdr` text, then it is discarded.
- **Import:** `.wdr` text populates a `WinISDDriver`; those as-read values are diffed against what
  `OpenISDDriver` independently derives, surfacing a mismatch — a value hand-edited in WinISD, for
  instance — as a data-quality signal rather than silently overwriting.
- `.wdr` is therefore 100 % derivable from `OpenISDDriver`: generated on demand, never stored. The
  same relationship holds upstream — `openisd.yml` is 100 % derivable from `driver.yml`.

### File formats, and what crossing that boundary guarantees

The app reads and writes five formats. Two are ours, three are WinISD's.

| Format | Content | Direction |
| --- | --- | --- |
| `openisd.yml` | the OpenISD record — the canonical on-disk form | read (commons, at build time) |
| `.owdr` | one OpenISD driver record, the same schema as `openisd.yml` byte for byte | read / write |
| `.owpr` | one `OpenISDProject` — box, vent, PR, filters, signal, and its driver records | read / write |
| `.wdr` | one WinISD driver | read / write |
| `.wpr` | one WinISD project | read / write |

**No import loses data.** Every field a file carries survives the round trip, including metadata
the app does not itself display. A `.wdr` written back out matches the original byte for byte, or
conforms strictly to the layout rules where a byte-exact match is impossible — the layout rules are
[`docs/design/WDR_SCHEMA.md`](docs/design/WDR_SCHEMA.md) and the round-trip contract is
[`docs/spec/SPEC_ENGINE.md`](docs/spec/SPEC_ENGINE.md) §4.6.

**The two formats carry deliberately different content, and the asymmetry is the point.**

| | `openisd.yml` / `.owdr` | `.wdr` |
| --- | --- | --- |
| Asserted values | carried | carried |
| Derivable values nobody asserted | **absent** | **carried** |
| The `E`/`C`/`N` character | **never stored** | computed at emit time |

A field is in an OpenISD record because someone stated it, so **presence is the assertion** and
absence is not a value. `.wdr` must additionally carry every calculated value, because WinISD does
not recompute on open — so `openisd.yml` → `.wdr` is **not a serialisation**: it goes through
`OpenISDDriver`, which supplies what the file does not hold. That is what keeps one place where
calculation happens, and is why the browser's exporter and the pipeline's exporter cannot drift.

The fields themselves — what each one means and which source may state it — are
[`docs/design/DRIVER_RECORD_MODEL.md`](docs/design/DRIVER_RECORD_MODEL.md)'s.

**The oracle is WinISD itself.** `.wdr` files written by WinISD are the reference for our writer's
output; a third-party database's `.wdr`-shaped export is not an oracle however plausible it looks.
Where OpenISD deliberately differs from WinISD, the difference is recorded with its ruling and the
parity suite expects it — it is never silently absorbed as a tolerance.

### Scope: the driver record only

Box, vent, passive-radiator, filter, signal and UI-navigation state have no fields in `openisd.yml`
and none are added. That is `OpenISDProject`'s concern, and `.owpr` is its on-disk form. The
multi-layer state model is multiple *copies* of the one `OpenISDDriver` shape, never different
shapes of it.

---

## 4. Runtime data flow

One pass, driven by any parameter change. Nothing caches a curve; a sweep is cheap enough to re-run
on every edit.

```mermaid
sequenceDiagram
    actor User
    participant UI as ui component
    participant Store as logic store
    participant Driver as OpenISDDriver
    participant Engine as engine
    participant Canvas as ui canvas

    User->>UI: edits a T/S field or box volume
    UI->>Store: enterDriverField field, value
    Store->>Driver: enter field, value
    Note over Driver: records a manual reading.<br/>C and N are derived, never set
    Driver->>Engine: solve the stated fields
    Engine-->>Driver: a Result carrying value and errors, never a throw
    Driver-->>Store: notify subscribers
    Store->>Engine: sweep driver, boxType, params
    Engine-->>Store: SweepResult - spl, phase, excursion, impedance
    Store->>Store: map the arrays to renderer series
    Store-->>Canvas: reactive series
    Canvas-->>User: redrawn charts and readouts
```

**File I/O sits beside this loop, not inside it.** Import builds an `OpenISDDriver` from an
`openisd.yml`/`.owdr` record, or from `.wdr` text via `WinISDDriver`; export projects the live
model back out. The sweep never touches a file.

**The store reaches services, never the reverse.** `logic` calls `driverRepo` for a record,
`myDriverRepo` and `prefsStore` for browser-local data, `fileIO` to read and write, `diagnostics`
and `logging` to report. Each returns data and holds no reference to the store.

---

## 5. System invariants

These hold everywhere, across every module.

**Failure travels as a value.** Every function that performs I/O, validation, or a calculation that
can partially fail returns `{ value, errors }`. `errors` is always an array; empty means clean.
**Nothing in the engine throws.** A parser handed malformed input returns `{ value: null, errors:
[…] }`. Third-party code that throws is wrapped at the call site and its throw converted. Test
infrastructure is the one place throw-based signalling is correct.
Contract: [`../_agent_files/rules/openisd-result-contract.md`](../_agent_files/rules/openisd-result-contract.md).

**The core has no browser.** `@openisd/engine`, `@openisd/model` and `@openisd/winisd` contain no
DOM, no `window`, no `document` and no canvas. The core is the reusable product: another front-end
— mobile, CLI, third-party — must build on it without inheriting browser coupling, and DOM-free
code is directly testable in Node with no stubs and no jsdom.

**`series.ts` is a presentation adapter.** It maps engine arrays onto renderer `Series[]` and does
no acoustic maths and no baseline subtraction ([`docs/spec/SPEC_UI.md`](docs/spec/SPEC_UI.md)
§1.1). Every number it hands the canvas arrived from the engine.

**Strong typing over loose bags.** No untyped grab-bag types: no all-optional interface accepting
fields a consumer never reads, no `Record<string, any>`, no shape whose real contract is narrower
than its declared type. Every type states exactly what it holds. Every boundary that can fail
validates and reports rather than accepting anything and hoping. The type a function declares is
the set of fields it reads.

**One name per field.** A field, model or entity has exactly one name in our own record. Parsing an
external vocabulary onto that one canonical name — a datasheet's `Fs`/`fs`/`Resonance frequency`,
WinISD's `Bl` against the record's `BL` — is required work and happens in exactly one place per
boundary. An alias mechanism on our own record is not.

**Validated physics is moved, never re-derived.** The engine is validated to < 0.03 dB against
closed-form Thiele/Small physics. Restructuring moves that code behind boundaries; it does not
rewrite the formulas. A clean-room rewrite discards paid-for correctness and re-introduces the same
class of bugs.

**NO GLOBAL VARIABLES.** This is a whole-system rule, not a service-directory convention. Nothing
in this system holds state that another part can reach without being handed it. Specifically, and
without exception:

- **No module-level mutable binding.** No `export let`, no `export var`, no exported object that
  is mutated after construction.
- **No exported pre-built instance.** A module exports a `create<Name>(deps)` factory, never a
  ready-made `new X()`, `reactive()` or `ref()`. An instance nobody can substitute makes every
  consumer of it untestable in isolation.
- **Nothing on `window`.** The one exception is `window._selfTestDone`, which carries no state —
  it is a completion flag read by the browser test harness.
- **`state` is not importable.** It is created by the store factory and passed to what needs it.
- **No ambient singleton reached through a module import**, including caches, registries and
  loggers. If two callers must share one, the composition root constructs it once and injects it
  into both.

Every collaborator arrives as an argument. That is what makes any part of this system testable
with a substitute in place of the thing it depends on, and it is why the composition root is the
only place that constructs.

---

## 6. Delivery and runtime environment

### Offline via a service worker

Offline use is delivered by a Workbox service worker (Vite PWA plugin, `registerType: 'autoUpdate'`)
that caches the built app. The app is **installable and auto-updating**. The build produces standard
ES modules, which require a server origin — the app is served over HTTP, never opened from
`file://`.

### The runtime self-test

**A physics smoke-test runs once per page load, in the user's browser, against the live deployed
bundle.** Results go to the console under `[OpenISD self-test]`.

It exists alongside the Node suite because the two catch different failures. The Node suite proves
the **source** is correct, on a developer's machine. The self-test proves the **deployed bundle** is
correct, in the environment the user actually has.

| Failure mode | Build tests | Self-test |
| --- | --- | --- |
| Logic bug in source | ✓ | ✓ |
| Bundler/minifier corrupts code | ✗ | ✓ |
| Tree-shaking drops a needed export | ✗ | ✓ |
| Browser JS engine edge case | ✗ | ✓ |
| Wrong constants after a config change | ✗ | ✓ |

**Three gates:** sealed-box SPL against the closed-form transfer function (< 0.1 dB); passband
sensitivity against the T/S radiation-efficiency formula (< 0.5 dB); and a vented box rolling off
at ~24 dB/oct with two impedance peaks straddling Fb.

**`window._selfTestDone`** is set on completion. Playwright waits on it before running browser
tests — it is a synchronisation signal, not a result.

### Persistence

Three things persist in `localStorage`, each reached only through the service that owns it:

| Key owner | Holds |
| --- | --- |
| the store, via `fileIO` (`openisd.state`) | the **committed design** — box, params, the driver with its marks, project metadata |
| `myDriverRepo` | user-saved drivers |
| `prefsStore` | favourites, session, layout |

**Drafts and active what-ifs never persist.** An uncommitted value must not return after a refresh
looking like a decision the user made. The commit boundary that decides this is
[`docs/design/STATE_MODEL.md`](docs/design/STATE_MODEL.md)'s.

**State restores on load.** The app starts from what was stored — active project, open panels — and
restores it reactively.

A share link carries the same committed design in the URL hash. Every one of these persists the
`OpenISDRecord` shape, so a saved project's driver and a saved `.owdr` are the same bytes.

---

## 7. Out of scope

- **Anything requiring a backend**: accounts, server-side computation, cloud storage as the primary
  store, collaborative editing, per-user server state.
- **An authentication stack.** No IDP, no session management, no authorisation model.
- **A live driver API.** The commons ships in the bundle at build time.
- **Python reading or writing `openisd.yml`.** That transform is JS/TS, invoked from Python when
  Python needs it.
- **A second user interface.** There is one.
