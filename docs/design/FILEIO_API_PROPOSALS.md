# `FileIO` — two complete API proposals

Decides QO61's open sub-question: does `FileIO` expose GENERIC methods carrying a format
discriminator, or one method per format? Objective 6 of
[`PLAN_QO60_LAYERING_REMEDIATION.md`](../plans/PLAN_QO60_LAYERING_REMEDIATION.md) cannot land until this is
settled, because it is the interface `useApplicationIO.ts` is being split into.

Both proposals below are complete: every method the current composable performs, typed.

---

## Three facts that constrain BOTH proposals

`ARCHITECTURE.md`'s current declaration predates all three, so it is wrong on each — that is not
an argument for either shape, it is a correction both must apply.

### 1. A read takes BYTES, not text

```ts
readRecord(text: string, format: RecordFormat): Result<OpenISDDriverJson>   // ARCHITECTURE.md today
```

A `.wdr` encodes an embedded newline in a string field as the single byte `0xA4`, which is not
valid UTF-8. `FileReader.readAsText()` turns it into U+FFFD and the newline is unrecoverable
before any parser sees it. Measured against the real WinISD (`winisd_research/COMMENT_ENCODING.md`):
WinISD writes `¤` as `C2 A4` and a newline as a bare `A4`, so the two are told apart by UTF-8 lead
position and NOTHING BELOW THE BYTE LEVEL CAN DO IT.

A `.wpr` is included: it embeds its `[Driver]` block verbatim, sentinels and all.

So every read entry point takes `Uint8Array`. `packages/winisd/src/wdrBytes.ts` already implements
the codec; `FileIO` is its only caller.

### 2. A read returns a DOMAIN OBJECT, never a JSON shape

```ts
readRecord(...): Result<OpenISDDriverJson>    // ARCHITECTURE.md today
```

This returns the private record shape to the UI, which the standing ruling forbids without
exception: **the UI must never talk to a JSON shape.** `_OpenISDDriverJson` is class-private to
`openisdDriver.ts` and its allow-list has one entry. A `FileIO` typed this way could not compile
against the current gate, and is also the exact defect
`bugs/BUG_20260821_the_driver_record_is_used_as_currency_between_functions.md` records: records
cross the PERSISTENCE boundary, drivers cross FUNCTION boundaries.

So reads return `OpenISDDriver` / `OpenISDProject`.

### 3. WHERE a file goes is a different concern from WHAT it contains

The composable currently mixes them: `saveProject()` writes through a retained
`FileSystemFileHandle`, `saveProjectAs()` prompts, `exportWdr()` triggers a browser download, and
`shareLink()` writes `location.hash` and the clipboard. Encoding a `.wdr` and choosing a
destination have nothing to do with each other, and only the destination half needs a browser.

Both proposals therefore split a second port:

```ts
/** WHERE bytes go and come from. Knows no format. */
interface FileStore {
  /** Prompt for a file and read it. Null if the user cancelled. */
  open(accept: readonly string[]): Promise<{ name: string; bytes: Uint8Array } | null>;
  /** Write to a previously-picked destination, prompting the first time. */
  save(bytes: Uint8Array | string, suggestedName: string, mime: string): Promise<SaveResult>;
  /** Always prompt for a new destination. */
  saveAs(bytes: Uint8Array | string, suggestedName: string, mime: string): Promise<SaveResult>;
}
```

`FileIO` below is then PURE — bytes in, bytes out, no browser, no clock, no dialog. That is what
makes it unit-testable, which is the point of the split.

---

## Proposal A — generic, with a format discriminator

```ts
/** Which record format a driver is being read from or written to. String enum, never an int
 *  (discriminator rule). The value is the file extension without the dot. */
export enum RecordFormat {
  /** WinISD's own `.wdr`. Lossy: only what WinISD models survives. */
  Wdr  = 'wdr',
  /** OpenISD's own record, JSON. Lossless. */
  Owdr = 'owdr',
}

export enum ProjectFormat {
  Wpr  = 'wpr',
  Owpr = 'owpr',
}

interface FileIO {
  readRecord(bytes: Uint8Array, format: RecordFormat): Result<OpenISDDriver>;
  writeRecord(driver: OpenISDDriver, format: RecordFormat): Result<Uint8Array>;

  readProject(bytes: Uint8Array, format: ProjectFormat): Result<OpenISDProject>;
  writeProject(project: OpenISDProject, format: ProjectFormat, now: Date): Result<Uint8Array>;

  /** Which format a file NAME claims, or undefined if the extension is not one we read. */
  formatOf(filename: string): RecordFormat | ProjectFormat | undefined;
  /** Which format the BYTES actually are, when the name does not say. */
  sniff(bytes: Uint8Array): RecordFormat | ProjectFormat | undefined;

  encodeShareLink(project: OpenISDProject): Promise<string>;
  decodeShareLink(url: string): Result<OpenISDProject>;
}
```

**What the caller writes**

```ts
const r = fileIO.readRecord(bytes, RecordFormat.Wdr);
const { value: bytes } = fileIO.writeRecord(driver, RecordFormat.Owdr);
```

**Cost.** Every implementation body is a `switch` over the enum, and the compiler enforces
exhaustiveness — a new format is a compile error at each switch until handled. The interface never
grows. The `Result` return on `writeRecord` is needed because `.wdr` CAN fail (an incomplete
driver cannot be projected) while `.owdr` cannot, so the signature is as weak as its weakest
member and an `.owdr` caller handles an error that can never arrive.

---

## Proposal B — one method per format

```ts
interface FileIO {
  // ── Driver records ──
  /** `.wdr` bytes → driver. Errors name what WinISD stated that we could not read. */
  readWdr(bytes: Uint8Array): Result<OpenISDDriver>;
  /** Driver → `.wdr` bytes. FAILS when the driver is too incomplete to project. */
  writeWdr(driver: OpenISDDriver): Result<Uint8Array>;
  /** `.owdr` bytes → driver. */
  readOwdr(bytes: Uint8Array): Result<OpenISDDriver>;
  /** Driver → `.owdr` bytes. Cannot fail: the record is always representable as its own JSON. */
  writeOwdr(driver: OpenISDDriver): Uint8Array;

  // ── Projects ──
  readWpr(bytes: Uint8Array): Result<OpenISDProject>;
  /** `now` is passed, never read from the clock, so the same project is byte-reproducible. */
  writeWpr(project: OpenISDProject, now: Date): Result<Uint8Array>;
  readOwpr(bytes: Uint8Array): Result<OpenISDProject>;
  writeOwpr(project: OpenISDProject): Uint8Array;

  // ── Choosing between them ──
  formatOf(filename: string): FileFormat | undefined;
  sniff(bytes: Uint8Array): FileFormat | undefined;

  // ── Share links ──
  encodeShareLink(project: OpenISDProject): Promise<string>;
  decodeShareLink(url: string): Result<OpenISDProject>;
}
```

**What the caller writes**

```ts
const r = fileIO.readWdr(bytes);
const bytes = fileIO.writeOwdr(driver);          // no Result to unwrap — it cannot fail
```

**Cost.** Eight methods instead of four, and each new format adds two more. The shared body of a
read (decode bytes → parse → build the domain object) is written once per format rather than once
per interface method, so any common part must be factored into a private helper deliberately
rather than falling out of the structure.

---

## The comparison that actually decides it

| | A — generic | B — per format |
|---|---|---|
| Interface size as formats are added | fixed at 8 | +2 per format |
| Can a signature tell the truth about failure? | **No** — one `Result` covers both members, so `.owdr` callers unwrap an impossible error | **Yes** — `writeOwdr` returns `Uint8Array`, `writeWdr` returns `Result` |
| New format forgotten somewhere | compile error at each `switch` | compile error only where the new method is expected |
| Matches the naming already ruled | no | **yes** — `OpenISDDriver` already has `fromWdrText`/`toWdrText`/`fromOwdrText`/`toOwdrText`/`fromJsonRecord`/`toJsonRecord`, ruled 2026-08-20 ("just be very consistent") |
| Call site reads as | `readRecord(b, RecordFormat.Wdr)` | `readWdr(b)` |
| Format is a runtime VALUE that can be passed around | yes — needed by the format PICKER in the editor's Save dialog | no — the picker maps its choice to a method itself |

**The one real argument for A** is the export picker in `DriverEditorModal.vue`: the user chooses
a format from a dropdown, so the format IS a runtime value there. Under B that call site needs a
small map from the chosen format to the method. Under A it passes the value straight through.

**The one real argument for B** is that it is the only shape in which the signatures can be
honest about which writes can fail — and it is the shape the domain object already uses, which was
ruled explicitly.

## Recommendation

**B**, with `formatOf`/`sniff` returning a `FileFormat` enum so the picker still has a runtime
value to hold, and a single private `dispatchWrite(format)` inside the editor's save handler
rather than in the interface. That keeps the honest signatures and the naming consistency, and
confines the one place that genuinely needs a runtime format to the one component that has a
dropdown.

## What must change in `ARCHITECTURE.md` either way

Its `FileIO` block is wrong on three counts independent of this choice: `text: string` must become
`bytes: Uint8Array`; `OpenISDDriverJson`/`Project` must become `OpenISDDriver`/`OpenISDProject`;
and the destination half belongs in a separate `FileStore` port. `ARCHITECTURE.md` also still
lists `createFileIO` as "not yet built", which stays true until objective 6 lands.
