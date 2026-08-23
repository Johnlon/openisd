# Project domain symmetry — the project carries its own values, provenance and physics

**Status: APPROVED with three binding amendments (main-exec adversarial review, 2026-08-23),
folded in below. Implementation go: P1 then P2; P3/P4/P5 gated on the P2 review.**

John's ruling (2026-08-23, verbatim): "a much more central role for the domain object in the
project to carry the appropriate set of properties including calc and manual and hybrid just
like the driver and for there to be few if any floating functions augmenting the project
classes (project/pr/vented/sealed/4th etc) and instead I expect to see a similar set of
accessors to what we see on the driver. Symmetry is highly valued - consistency is highly
valued - encapsulation etc etc."

## What the driver already does, which the project must match

`OpenISDDriver` answers every question about a driver itself. `cell('Fs')` returns the value
AND how it came to exist — Entered (a person or datasheet stated it), Calculated (solved from
the entered set), or NotAvailable. The solving happens inside the object; callers never carry
the physics. Serialisation is its own (`toWdrText`, `toOwdrText`); construction is licensed
factories only.

`OpenISDProject`, post the 27f48bd rewrite, already owns its format seam (`fromWinISDProject`,
`toWinISDProject`) — but its VALUES still leak: 15 exported free functions operate on the
record's box/vent/PR shapes from outside, and the group SOLVING (which member of Vb/ventD/Fb/
ventL is held, which follows) lives in `packages/ui/src/logic/useVentGroup.ts` and
`usePrGroup.ts` — physics in the UI package, exactly what the driver never allows.

## 1. Where each free function goes

One rule decides all of them: a question about a project's state becomes a method on the
object that owns that state. A function survives free only with a named justification.

| today (free, exported) | becomes |
|---|---|
| `boxVolume_m3` / `setBoxVolume_m3` | `project.cell('Vb')` / `project.enter('Vb', v)` |
| `boxTuning_Fb_hz` / `setBoxTuning_Fb_hz` | `project.cell('Fb')` / `project.enter('Fb', v)` |
| `activeVent` | private — callers use the vent cells below |
| `ventArea_m2` | `project.cell('Sp')` — always Calculated when derivable (πD²/4 round, W×H slotted), NotAvailable otherwise; never Entered, because no one ever states an area |
| `setActiveAlignment` | `project.setAlignment(kind)` |
| `prototypeBox` | folds into the private `prototypeProject()` |
| `passiveRadiatorOrDefault` / `ensurePassiveRadiator` | private behind `project.pr()` accessors |
| `prCmsFromWinIsdVas` / `prMmdFromWinIsdFs` / `prRmsFromWinIsdQms` | methods on the PR surface (`project.enterPrDatasheet({Vas,Fs,Qms,Sd,Xmax})` converts internally) — this closes BUG_20260818's open ruling: the datasheet↔canonical conversion becomes reachable ONLY through the domain object, never as free functions in UI logic |
| `alignmentKindOfBType` / `bTypeOfAlignmentKind` | module-private — their only callers are `fromWinISDProject`/`toWinISDProject` in the same file; tested through the seam |

Named survivors: none. The target is zero exported free functions in `openisdProject.ts`.

## 2. Provenance — Entered / Calculated / NotAvailable on project fields

The storage for this ALREADY exists and is already the ruled model: `target.entered`
(the entered set) decides which group member is authoritative, exactly as the driver's
`#inputs` does (STATE_MODEL.md rule 7). What is missing is the DERIVATION living behind it.

`project.cell(field)` returns `{ value, state }`:

- **Entered** — the field is in the entered set.
- **Calculated** — the field is solved from its group's entered members. The vent relation
  (`Fb = (c/2π)·√(Sp/(Vb·Leff))`, one equation, three chosen → fourth follows) and the PR
  relation (`Fp ↔ Madd`) move INTO the class from `useVentGroup.ts`/`usePrGroup.ts`. The
  engine formulas stay in `@openisd/engine`; the project calls them, the UI does not.
- **NotAvailable** — not entered and not solvable (group underdetermined).

"Hybrid" (John's word) is a GROUP property, not a third per-field state: a group with some
members Entered and the remainder Calculated. Per field the answer is still one of E/C/N —
same as a driver whose Qts is entered and Qes solved. No new state is invented.

Defaults are ENTERED, stated by the prototype. QO36 ruling B4 defines E as STATED, not
typed-by-this-user — a datasheet stating Fs makes it E, and by the same rule `empty()`'s
prototype stating Ql=7 or the standard temperature makes those E: the prototype is the stater.
No default marking exists — that would be a fourth state under an alias. Accepted consequence,
stated plainly: a fresh project's vent group is born over-determined (the prototype states both
Vb and Fb), so nothing solves until the user clears a member — which is exactly WinISD's own
observed behaviour with over-determined groups, so the symmetry is real, not accidental. The
design reuses the driver's `Provenance` enum; no second vocabulary.

## 3. QO85 — the box model must be right before the accessors freeze

ABC needs three ports; today every alignment carries exactly one `vent: OpenISDVent`. Laying
symmetric accessors over that shape would bake the wrong arity into the public surface.

Decision this design takes (subject to review): **`vents: OpenISDVent[]`, arity fixed by the
alignment** (sealed 0, vented 1, bandpass4 1, future bandpass6 2, ABC 3). Named fields
(vent1/vent2/vent3) are rejected: they make "for each port" impossible to write and force a
third shape per new alignment. The public accessor is index-based from day one —
`project.vent(i)` / `project.ventCount()` — so adding ABC later adds NO new accessor shape.
Existing alignments migrate `vent` → `vents[0]` in the same pass (one shape, no tolerance;
stored payloads reach it through the schema-upgrade chain as a V-step, per the
EVERY-PAYLOAD-CARRIES-ITS-SCHEMA-VERSION policy).

`Sp`/`Leff` on SyncedParams/UiParams stay single scalars FOR NOW (they describe the single
active port of the alignments that exist); they become per-port when a multi-port alignment
actually lands — deferred with QO85 itself, as John directed ("do not add bandpass6/abc yet").

## 4. What the UI seams shrink to

- `useVentGroup.ts` / `usePrGroup.ts`: the solve/held logic (ventDerivable, solveFourth,
  prMassForFp wiring) moves into `OpenISDProject`. What remains in `packages/ui` is the
  composable's UI concern only: which input has focus, when to commit, flash messages. Target:
  each file loses its physics imports from `@openisd/engine` entirely.
- `managedProject.ts`: its box/vent/PR accessors become one-line delegations to the domain
  cells (it already delegates driver cells the same way), keeping the notify contract
  (REACTIVITY.md) unchanged. No UI code names a record shape — encapsulation as ruled.
- `prWinIsdFields.ts`: dies into `project.enterPrDatasheet(...)` / PR cells.
- `OriginalShell.vue` and modals: bind `project.cell(...)`/`enter(...)` through the managed
  layer exactly as driver fields already bind — same idiom both panels, which is the visible
  symmetry John is asking for.

## Vent semantics (opus2 H1; STANDING after the WinISD probe — winisd_research 109a2f9,
VENT_SHAPE_CROSSCALC.md)

`crosscalc` is the cross-section AREA's provenance (0 = entered, 1 = derived from the
diameter) and is carried as `target.entered['ventCrossArea']`. It is NOT the port's shape:
shape comes from observed geometry (a stated `dia1` is a round port). The probe measured the
available WinISD binary's Vents tab offering ONLY diameter geometry — `carea` disabled and
always π·(dia1/2)² (dia1=0.076 → carea=0.00453645979178366 exact on save/read-back),
`crosscalc` never leaving 1, `Shape=` never varying, no slot control anywhere in the widget
enumeration. Two caveats carried from the note: the probed binary is a Lazarus/LCL rebuild,
not the original Delphi VCL, so whether original WinISD ever writes crosscalc=0/Shape≠1 is
untested; and the bandpass front/intra vent tabs were not probed. Consequence: OpenISD's
slotted-vent support (width/height) is an OPENISD EXTENSION beyond observed WinISD parity,
and the crosscalc=0 import path handles a file class no available binary can produce — kept
because the format documents it, guarded by the carea invariant (no import may build a vent
whose area computes to zero while the file states a nonzero diameter, pinned by test).

## Precision on the 27f48bd claims (opus2 review, R5)

No-drop holds for a FILE-READ instance (verbatim return) and for unknown keys SUPPLIED to
`build()`; the domain path narrows to what OpenISD models. The "golden" comparisons in
`winisdProject.test.ts` are whole-block and line-containment comparisons against WinISD-written
files, not whole-file byte comparisons.

## Constraints carried unchanged

Owner serialises (QO83) — `toWinISDProject`/`fromWinISDProject`/`driverText` untouched.
Encapsulation absolute — no accessor returns interior mutable state; cells are copies.
No new exemptions; PrivateAllow is being decommissioned, and this design needs no grant:
everything reaches the record through the class.

## Plan rows (for the checklist, in order)

- [x] P1 — `vents: OpenISDVent[]` migration + `vent(i)`/`ventCount()` accessors; UiParams
      untouched. NO schema V-step, ruled after verification (main-exec, 2026-08-23): the
      project record shape never persists — `SerializedState` carries `P: UiParams` + the
      driver as text + `ProjectMeta` on every route (localStorage, share-link hash, `.owpr`
      File→Open), and the ground fingerprint is the same shape in memory only; the record is
      rebuilt via `loadUiParams` on every load. A V-step would be a repair with no possible
      input — dead code born gated. The upgrade requirement transfers forward to the moment a
      multi-port alignment changes the WIRE shape (UiParams per-port fields, deferred with
      QO85). (QO85 stays open for ABC itself.)
- [x] P2 — `project.cell()`/`enter()`/`clear()` with the vent + PR group solvers MOVED in
      from useVentGroup/usePrGroup (both now delegate; zero `@openisd/engine` imports remain
      in either). Driver's `Provenance` reused. One user action = one domain transaction =
      one notification (the coalescing contract tightened from 3 writes to 1). Riders: K1
      (vent(i)/ventCount() direct tests) and K2 (VENT_ARITY enforced at the construction
      chokepoint and the activeVent read; wrong arity refuses loudly, both directions
      tested). Env/signal/losses cells deferred to P3 alongside the accessor cleanup —
      they have no solver, so nothing moves for them, only naming.
- [ ] P3 — free-function elimination per the table above; barrel and ALLOWED_GLOBALS shrink
      accordingly (deletions only, no new grants).
- [ ] P4 — UI seam shrink: managedProject delegations, useVentGroup/usePrGroup reduced to UI
      concerns, prWinIsdFields deleted.
- [x] P5 — symmetry gate landed: `packages/ui/test/ui/architecture-project-symmetry.test.ts`
      asserts (AST, not grep) that `openisdProject.ts` exports no free functions — the
      `prCmsFromWinIsdVas` trio carries a SUNSET exemption that dies with P4 — and that no UI
      code outside `managedProject.ts` touches the entered set, which is the enforceable shape
      of "every E/C/N the UI shows resolves through `projectCell()`". Non-vacuous both ways:
      in-file in-memory demonstrations, plus red verified live against a re-exported free
      function during authoring.
