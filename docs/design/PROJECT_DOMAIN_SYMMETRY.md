# Project domain symmetry — the project carries its own values, provenance and physics

**Status: DESIGN, awaiting adversarial review (main-exec). No production code until approved.**

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
| `ventArea_m2` | `project.cell('Sp')` (Calculated for a round port, Entered-equivalent via W×H for a slotted one) |
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

Fields with no relation (losses Ql/Qa/Qp, environment, signal, sim options) are Entered when
set, NotAvailable never (they have WinISD defaults) — they come back
`{value, state: 'E'}` or the default with `state: 'C'`-equivalent default marking. The design
deliberately reuses the driver's `Provenance` enum rather than minting a second vocabulary.

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

## Constraints carried unchanged

Owner serialises (QO83) — `toWinISDProject`/`fromWinISDProject`/`driverText` untouched.
Encapsulation absolute — no accessor returns interior mutable state; cells are copies.
No new exemptions; PrivateAllow is being decommissioned, and this design needs no grant:
everything reaches the record through the class.

## Plan rows (for the checklist, in order)

- [ ] P1 — `vents: OpenISDVent[]` migration + `vent(i)`/`ventCount()` accessors + schema
      V-step; UiParams untouched. (Prerequisite for freezing the surface; QO85 stays open for
      ABC itself.)
- [ ] P2 — `project.cell()`/`enter()`/`clear()` over box/vent/PR/env/signal fields, with the
      vent + PR group solvers moved in from useVentGroup/usePrGroup. Driver's `Provenance`
      reused.
- [ ] P3 — free-function elimination per the table above; barrel and ALLOWED_GLOBALS shrink
      accordingly (deletions only, no new grants).
- [ ] P4 — UI seam shrink: managedProject delegations, useVentGroup/usePrGroup reduced to UI
      concerns, prWinIsdFields deleted.
- [ ] P5 — symmetry gate: a test asserting `openisdProject.ts` exports no free functions and
      that every project field the UI binds resolves through `cell()` (AST, not grep).
