# useDesignIO.ts remediation plan (QO61)

> **This plan is one objective of a larger one.** The QO61 work below is objective 6 of
> [`PLAN_QO60_LAYERING_REMEDIATION.md`](http://localhost:8000/openisd/docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md?html),
> which carries the access rules, the `state.P` deletion, the catalogue-index design and the
> model→winisd dependency reversal that this file's objectives depend on. Read that first; where
> the two disagree, that one is authoritative.

**Glossary:** WinISD's box-type code selects sealed / vented / bandpass / passive-radiator
(PR); referred to by name below, never by its raw digit. `SERVICE`/`STORE` = the layers named
in `ARCHITECTURE.md`'s diagram (`UI -> LOGIC -> SERVICE -> domain/STORAGE/io`).

## Verdict

Not a wholesale delete. `useDesignIO.ts` (369 lines) mixes three things that belong in three
different layers, and fixing it properly requires promoting `OpenISDProject` to a class facade
first — the same shape `OpenISDDriver` already has. Split it; a thin `FileIO` SERVICE remnant
survives.

## What's wrong, in one table

| Content | Lines | Belongs in | Why |
|---|---|---|---|
| Inline PR physics (Vas→Cms, Fs→Mmd, Qms→Rms) | 255–262 | `@openisd/engine` | `logic/` "May not contain: Maths" ([ARCHITECTURE.md:546](http://localhost:8000/openisd/ARCHITECTURE.md?html#L546)). Each formula's FORWARD direction already exists in `@openisd/engine` (`prVas`, `prFs`, `prQms`) — this code hand-derives the INVERSE instead of the engine exporting it. |
| `.wpr` text parsing (raw section/key/value only) | 179–254, 264–316 | `@openisd/winisd` | That package owns ".wdr, .wpr, ParState" serialisation ([ARCHITECTURE.md:545](http://localhost:8000/openisd/ARCHITECTURE.md?html#L545)). Returns raw values only — box-type comes back as WinISD's own raw code, not interpreted. |
| Box-type → box-kind mapping (sealed/vented/bandpass/PR) | scattered | `OpenISDProject`, ONE place | Box type is the focused project's own responsibility, not a parser's. Currently duplicated THREE times (`wpr.ts`, `wprMapping.ts`, `useDesignIO.ts`) — no fourth copy permitted. |
| Save/Save-As/Share/import orchestration, filename↔handle watch | 63–177, 319–366 | `FileIO` SERVICE (target interface already specified, [ARCHITECTURE.md:627](http://localhost:8000/openisd/ARCHITECTURE.md?html#L627)) | Legitimate — this is what a `FileIO` service is for. Currently a `logic/` composable standing in for it, by ARCHITECTURE.md's own admission ([:456](http://localhost:8000/openisd/ARCHITECTURE.md?html#L456)). |
| `OpenISDDriver.fromRecord(...)` construction inside this file | 152, 170 | not in scope here | Tracked separately, QO55/QO57 — entangled with the in-flight `WinISDDriver` rewrite. |
| Direct `state.project.name =` / `state.editDriver =` writes | throughout | not in scope here | Tracked separately, QO60 (`logic/` isn't meant to touch `STORE` directly). |

Full inventory, every function classified, every caller, every duplication found: ask me to
re-surface the underlying research rather than re-deriving it.

## Remediation — 5 incremental objectives

**0. Promote `OpenISDProject` to a class facade over `_OpenISDProjectJson`, mirroring
`OpenISDDriver`.** (Closes QO54.)

**Hard constraint (John, 2026-08-20): neither `OpenISDDriver` nor `OpenISDProject` may clone
data for the layers. Layer cloning is `ManagedOpenISDProject`'s job and only its job.** The
facade WRAPS whichever layer is currently effective; it never copies one, never owns the
ground/committed/what-if distinction, and never grows a `clone()`/`snapshot()`/`fork()` of its
own. This is also why `_OpenISDProjectJson` stays plain data: `structuredClone` reduces a class
instance to a prototype-less object, so the thing being cloned must remain the JSON, with the
facade materialised over it afterwards — exactly as `ManagedProject` already does for the
driver today.
 Private constructor, static factories
(`fromRecord`/`fromWinISDProject`/`empty`), accessor methods/sub-objects for `box`, `pr`, etc.
— all wrapping the SAME underlying `_OpenISDProjectJson`, never a clone. The PR accessor also
gets the entered-or-computed getters objective 1 depends on (`cms`/`mmd`/`rms` or similar,
naming your call) — each checks the record for a manually-entered value first, falling back to
calling objective 1's engine function and marking the result `C` when absent. Includes a `.driver`
accessor returning a live `OpenISDDriver` wrapped over `this.#json.driver` by reference —
already safe to do today: `_OpenISDProjectJson.driver` is typed `_OpenISDDriverJson`
([openisdProject.ts:203](http://localhost:8000/openisd/packages/model/src/openisdProject.ts?html#L203)),
byte-identical to a standalone `.wdr` record, so `OpenISDDriver.fromRecord(this.#json.driver)`
needs no conversion. This accessor REPLACES `ManagedProject`'s own construction of it
([managedProject.ts:116,352](http://localhost:8000/openisd/packages/ui/src/logic/managedProject.ts?html#L116))
— `ManagedProject` reads it off the facade instead of building it itself. This is the largest
objective here; do it FIRST — objective 1's getters live on the PR accessor this objective adds,
and objective 3 depends on the `.driver` accessor, and `managedProject.ts` (the file this
objective restructures) is also where QO59's ruling and QO56's concurrency risk live (see
cross-references below), so one open pass through that file covers all of it. Objective 2b does
NOT depend on this objective — its mapping function is explicitly a plain function, not a
method (see 2b below), so it needs nowhere to hang off; 0+1 and 2b can ship as independent PRs
in either order.

**1. Add the missing engine inverses.** `@openisd/engine`'s `formulas.ts` gets three new
exported functions — `prCmsFromVas`, `prMmdFromFs`, `prRmsFromQms` (or one combined function;
engine's existing style favors small single-purpose ones — your call). Pure math, no I/O.
Unit-test each against its forward function (round-trip: `prVas(prCmsFromVas(v, sd), sd) === v`).

**Resolved (John, 2026-08-20):** the calc formulas MUST live in `@openisd/engine` — nowhere
else permitted, confirming the BUG_20260818 ruling's engine-only requirement. But nothing
outside `OpenISDProject` may call them directly. Objective 1's three engine functions are
called from EXACTLY ONE place: a getter on `OpenISDProject`'s PR accessor (added as part of
objective 0), which implements the same entered-or-computed pattern `OpenISDDriver.cell()`
already uses elsewhere — a manually-entered value on the record wins; absent that, the getter
calls the engine function and the result reads as `C` (computed), never `E`. `useDesignIO.ts`'s
successor AND `prWinIsdFields.ts` (see the second duplicate site below) both delete their
inline formulas and call the getter — not the engine function — same as any other derived PR
field. This closes BUG_20260818 as written: the engine holds the math, one domain getter holds
the override/fallback decision, nothing else touches either.

**Second duplicate site the plan's inventory misses.** The same three formulas are ALSO
duplicated in
[prWinIsdFields.ts](http://localhost:8000/openisd/packages/ui/src/logic/prWinIsdFields.ts?html)
(`setPrFsFromWinIsd`, `setPrQmsFromWinIsd`, `setPrVasFromWinIsd`, `prCanonicalFromDatasheet`) —
created 2026-08-14 during the QO38 layering pass, moving the math out of `.vue` components but
only as far as `logic/`, not into the engine. The plan's "What's wrong" table above names only
`useDesignIO.ts` as carrying this duplication; fixing only that file leaves `prWinIsdFields.ts`'s
copy in place and the underlying bug still open. Whichever shape objective 1 lands on, both
files must be updated to call it — not just `useDesignIO.ts`'s successor.

**2. Move `.wpr` parsing into `@openisd/winisd`, RAW only.** New function, e.g.
`WinISDDriver.fromWprText(text)` or a sibling `parseWpr()`, mirroring `toWpr()`'s existing
location ([wpr.ts:145](http://localhost:8000/openisd/packages/winisd/src/classic/wpr.ts?html#L145)).
Returns raw section/key/value data — box-type comes back as WinISD's own raw code, un-mapped.
No calling into engine formulas either; the CALLER (objective 3, via 2b) does both conversions.

**2b. `OpenISDProject` becomes the ONE place that maps box-type code → box-kind.** A NEW code
rule applies here (John, 2026-08-20): **a discriminator is never a plain int.** Both sides get
named, type-safe enums — WinISD's own raw code as one enum (matching the value/`.display`
pattern `DriverType`/`Chip` already use, `packages/ui/src/driverType.ts`), the openisd-side
`sealed`/`vented`/`bandpass4`/`passive-radiator` kind as another (today `AlignmentKind` is a
bare string-literal union, not that pattern — flag as a separate, smaller finding, not expanded
in scope here). The mapping function lives as a plain exported function in `@openisd/model`
(method on nothing — pure, stateless), and all three existing sites (`wpr.ts`, `wprMapping.ts`,
`useDesignIO.ts`'s successor) **import and call it directly** — no wrapper, no facade
re-exposing it, each site's own switch/if-chain deleted outright.

**3. Shrink `useDesignIO.ts` to the `FileIO` SERVICE shape.** What remains: `saveProject`,
`saveProjectAs`, `shareLink`, `exportWdr`, `exportOwdr`, `exportWpr`, `importFile`, `about`,
the filename/handle `watch`. These call objective 2's parser + objective 0's PR-getter (never
objective 1's engine functions directly — see objective 1's resolution above) instead of doing
either inline, and read the project's driver via objective 0's `.driver`
accessor instead of constructing it locally — which also removes the duplicate
`OpenISDDriver.fromRecord(record)` reconstruction at the two call sites the "What's wrong" table
above filed under "not in scope, QO55/QO57" (lines 152, 170). That row is about `WinISDDriver`'s
OWN internal derivation logic staying out of scope, not about this file's redundant
re-construction of a live driver it can now read off the facade — narrow the row's framing
accordingly; QO55/QO57 remain open for the deeper `WinISDDriver` issue regardless. Internal
duplication in `importFile`'s format-sniffing (the same `'specs' in parsed && !('box' in
parsed)` check written twice) gets consolidated to one function while this file is open anyway.

**⚠ Method-name shape does not match ARCHITECTURE.md's own target `FileIO` interface.** The
interface actually specified
([ARCHITECTURE.md:628](http://localhost:8000/openisd/ARCHITECTURE.md?html#L628)) is
`readRecord(text, format)` / `writeRecord(record, format)` / `readProject(text, format)` /
`writeProject(project, format)` / `encodeShareLink(project)` / `decodeShareLink(url)` — six
generic, format-parameterised methods operating on RECORDS. What this objective proposes to
retain is eight format-specific methods (`exportWdr`, `exportWpr`, `exportOwdr`, …) — a
different shape, not a rename of the same one. Resolve before objective 4 renames the file:
either conform to ARCHITECTURE.md's generic shape now, or keep the format-specific methods and
correct ARCHITECTURE.md's interface in the same PR to match what actually ships. Citing line 628
as "the target interface already specified" is not accurate as written — the two are different
interfaces.

**4. Rename to match what it now is**, once shrunk — `useDesignIO.ts` never explained itself
("what does useDesignIO mean anyway" — your words). `createFileIO.ts` matches the target
FACTORY name ARCHITECTURE.md already specifies
([ARCHITECTURE.md:517](http://localhost:8000/openisd/ARCHITECTURE.md?html#L517)), so the file
name is not new — but see objective 3's flag above: the METHOD shape it will export still needs
reconciling with ARCHITECTURE.md's `FileIO` interface before this rename reads as "done".

## What this does NOT do

Does not touch QO55/QO57 (`WinISDDriver` construction rewrite) or QO60 (STORE access) — both
stay open, unaffected by this plan; objective 3's driver-accessor change only removes a
redundant re-construction of `OpenISDDriver` at this file's two call sites, not `WinISDDriver`'s
own internal derivation logic, which is the substance of what QO55/QO57 still cover.

## Cross-references — other open ledger items and bugs with real impact

- **QO56 (open) — concurrent-session hot-file risk.** `managedProject.ts` and `wprMapping.ts`,
  both target files here, are named on QO56's own hot-file list. Live evidence it is not
  theoretical: this session's own `git status` shows an UNCOMMITTED, unrelated change already
  sitting in
  [wprMapping.test.ts](http://localhost:8000/openisd/packages/ui/test/logic/wprMapping.test.ts?html)
  right now. Confirm no other session is mid-edit on `managedProject.ts`/`wprMapping.ts`/
  `openisdProject.ts`/`useDesignIO.ts` before starting objective 0, 2b or 3.
- **QO59 (decided, not implemented) — same file as objective 0.** Ruling:
  `ManagedOpenISDProject.snapshot`/`recordToPersist`/`groundRecord` in `managedProject.ts`
  "should not be returning the json" (the private `_OpenISDProjectJson`). Objective 0 already
  opens this file to add the `.driver` accessor and replace its own driver construction — do
  QO59's fix in the same pass rather than a second open of a QO56 hot file.
- **QO38 (open) — layering ruling this plan is a concrete instance of.** QO38's 2026-08-14 note
  is where `prWinIsdFields.ts` was created, moving PR math out of `.vue` components into
  `logic/` — the same move objective 1 above now has to partially undo (math out of `logic/`
  entirely, into `@openisd/engine`). This plan does not close QO38 (its scope is broader: `ui ->
  @openisd/*` value-import cleanup elsewhere), but it is downstream of QO38's own unfinished
  work, not independent of it.
- **Package-direction note for objective 2b.** ARCHITECTURE.md:566 states "`@openisd/winisd`
  depends only on `@openisd/model`" — this is STALE against the actual code: `packages/model/
  package.json` lists `@openisd/winisd` as a runtime dependency (and
  [openisdDriver.ts:37-40](http://localhost:8000/openisd/packages/model/src/openisdDriver.ts?html#L37)
  imports `WinISDDriver`/`CellState`/etc. from it), while `packages/winisd/package.json` lists
  `@openisd/model` only as a devDependency with no runtime import found. The REAL edge is
  `model -> winisd`, the reverse of what the doc says. This does not block objective 2b — model
  importing WinISD's raw `BType` enum is fine given the real direction — but ARCHITECTURE.md's
  dependency table needs correcting to match, since a future reviewer checking objective 2b
  against the documented direction would wrongly flag it.
- Checked with no material impact from this plan: QO3, QO7–QO32 (all decided/closed),
  QO33–QO35, QO42, QO44–QO47, QO49, QO51, QO52–QO54 (QO54 is closed BY this plan), QO58 (already
  fixed), QO60 (explicitly out of scope, confirmed unaffected), QO61 (this plan's own item),
  QP4–QP21, QD1–QD3, QT5–QT54, and every bug listed in
  [bugs/](http://localhost:8000/openisd/bugs/?html) not named above — including several already
  showing `FIXED`/`PARTIAL` status on the exact files this plan touches
  (`BUG_20260814_sharelink-does-not-cancel-an-active-what-if-before-serialising-the-driver`,
  `BUG_20260817_wpr_passive_radiator_vas_written_in_litres_into_a_cubic_metre_field`'s primary
  finding, `BUG_20260819_store_bypasses_setActiveAlignment_with_a_raw_field_write`) — none of
  which this plan's changes reopen or contradict.

## Verification

- `npx vitest run packages/model/test` — new `OpenISDProject` facade tests (construction,
  accessor identity — mutating through `.box`/`.driver` must mutate the SAME underlying JSON,
  not a clone).
- `npx vitest run packages/engine/test/formulas.test.ts` — new inverse-function tests.
- `npx vitest run packages/winisd/test` — new `.wpr`-parse tests, existing suite stays green.
- `npx vitest run packages/ui/test/logic/useDesignIO.test.ts` (or its renamed successor) — the
  existing what-if-cancellation test on `shareLink()` still passes unchanged.
- Manual: Save/Save As/Export .wdr/.wpr/.owdr/Share/Import, one round each, in the running app —
  this file's output reaches disk/clipboard, not just unit-test mocks.
