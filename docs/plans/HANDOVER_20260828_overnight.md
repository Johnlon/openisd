# Overnight handover — 2026-08-28

Two Claude sessions worked this repo concurrently: **api-design** (coordination master, QO96/QO93)
and **this session** (UI/units/BoxType). Nothing is committed. This file states what is in the
working tree, who owns it, and what needs John.

## Tree state

**Full suite: 98 files / 2162 tests green. `packages/ui` vue-tsc 0. `packages/design` tsc 0.
`npx eslint packages` 0 errors** (2 pre-existing `no-console` warnings in files neither session
owns).

**NOTHING COMMITTED, deliberately.** The tree carries two authors' uncommitted work in
overlapping files — `packages/design/domain/project.ts` alone is ~1000 changed lines that are not
this session's. `git add` on a shared file sweeps the other session's work into the commit, which
is the precedent behind the no-force-push rule. **Do not `git add -A`.** The split is John's.

## Who owns what in the tree — SETTLED, not assumed

Both sessions initially reported "three streams, one owner unknown". That was wrong. Method that
settled it: subtract each session's known files, then READ the remaining diffs rather than guess
from filenames. **There are TWO streams.**

| stream | files |
|---|---|
| **api-design** | `design/domain/project.ts` (QO96 voice-coil), `design/test/engine-wiring.test.ts`, `design/test/architecture-spec-section-is-numeric.test.ts`, `design/engine/air.ts` + `domain/vent.ts` + `test/{domain,persistence,workspace}.test.ts` + **`test/engine/air.test.ts`** (QO93 air-model retraction), **`test/engine/architecture.test.ts`** (the `executableText` gate fix), `design/AGENTS.md` (+24, the "DON'T INVENT" standing order), `docs/FIELD_REFERENCE.md` + its `DOCUMENTATION.md` index line, `domain/index.ts` (the `VoiceCoilWiring` value export), `docs/research/WINISD_PARITY.md` (§11b, the DVC deviation), `bugs/BUG_20260827_*` ×2 + `bugs/BUG_20260828_dual_voice_coil_fields_are_carried_but_never_simulated.md` |
| **this session** | `design/engine/{types,Engine,params,formulas,index,circuit,sweep}.ts`, `model/**`, `persistence/**`, `ui/**`, `vitest.config.ts`, `design/test/engine/{engine,formulas,hardening}.test.ts`, `bugs/BUG_20260828_{coverage_config,driver_type_gate,enterPrDatasheet,stored_box_type}*` (4 — NOT the fifth, see above), `docs/plans/PLAN_RELEASE_HARDENING.md` |

**`bugs/BUG_20260828_*` IS NOT ONE STREAM'S.** The glob expands to FIVE files; four are this
session's and the fifth — `..._dual_voice_coil_fields_are_carried_but_never_simulated.md` — is
api-design's QO96 record. Both rows now name their bug files explicitly instead of globbing.

### FOUR FILES ARE MIXED — no whole-file `git add` splits these correctly

Found by scanning every dirty diff for identifiers only one author introduced, NOT by inference.
Each needs a per-hunk split (`git add -p`), and two of them are listed in a stream row above that
does not own all of their content:

| file | api-design's hunks | this session's hunks |
|---|---|---|
| `design/domain/project.ts` | QO96 voice-coil, `SpecSection`, `DriverSpec` (~37 sites) | `SimulatableBoxType`, `#engineBoxType()`, `prCmsFromVas` SI, `'box-passive-radiator'` (4 sites) |
| `ui/src/logic/fields/fieldRegistry.ts` | WinISD field renames, `numVC`/`VCCon`/`alfaVC` entries | `appliesTo` → `BoxType[]`, `box-passive-radiator`, the `tempCoeff` unit group |
| `design/domain/index.ts` | `export { VoiceCoilWiring }` (runtime VALUE export) | removing `BoxType` from the barrel (QO86) |
| `questions.yml` | QO96, QO97 | QO98 |

**AT LEAST EIGHT MORE FILES IN `ui/**` AND `model/**` CARRY api-design's HUNKS** — the hover-wiring
work (`fieldHelp()` from the registry) and the air-default flip, all inside files the table assigns
wholly to this session:

`model/src/openisdProject.ts` (the `ignoreHumidityAndPressure: true` default), `ui/.../NumInput.vue`,
`ui/.../AdvancedOptions.vue`, `ui/.../PRDefineModal.vue`, `ui/.../PREditModal.vue`,
`ui/.../DriverEditorModal.vue`, `ui/.../OriginalShell.vue` (the `alfaVC` binding),
`ui/.../fieldRegistry.ts`.

**`packages/design/test/engine-wiring.test.ts` IS ALSO MIXED** — api-design's file, carrying three
of this session's `vas_m3` call sites from the SI change. It is UNTRACKED, so `git diff` returns
nothing for it and every diff-based scan either session ran was blind to it by construction.

**THE COUNT IS AT LEAST FOURTEEN AND IS A LOWER BOUND, NOT A TOTAL.** Four scans were run — two identifier-based, one by
each author enumerating their own edits — and each found files the others missed. Every one was
defeated by its own inputs at least once:

| method | structurally blind to |
|---|---|
| identifier grep | any word not on the list it was given |
| `^\+` diff scan | DELETIONS — this is how `domain/index.ts` was missed |
| any diff-based scan | UNTRACKED files — how `engine-wiring.test.ts` was missed |
| self-enumeration | the other author's half; needs both to run it |

The right claim is "at least fourteen files are mixed and the method is not proven complete",
never "all mixed files found". `ui/**` is the broadest pattern in the table and hides the most.

**`project.ts` is the dangerous one** — the table assigns it to api-design and it is ~1000 changed
lines, so this session's four hunks are easy to sweep in unnoticed. `fieldRegistry.ts` fails the
same way in the opposite direction: `ui/**` claims it for this session while carrying api-design's
field-naming work.

**`design/test/engine/` IS SPLIT PER FILE, not per directory** — `air.test.ts` and
`architecture.test.ts` are api-design's; `engine/`, `formulas/`, `hardening.test.ts` are this
session's. A commit split that moves that directory as a block moves work across streams.

`design/AGENTS.md` reads as John's because the insertion sits directly above his pre-existing
approved-globals section. It is api-design's, recording John's words verbatim.

## What this session did

**Units.** `NumInput`'s `scale` prop DELETED — 30 sites. The unit registry is now the only way a
number can be scaled for display. New `percent` unit group (one unit, `%`, factor 100) per John's
ruling. `PRDefineModal` and `PREditModal` converted to `NumInput` with `field`/`group`/`base`
triples, so both PR dialogs and the driver editor convert identically. No hand-rolled conversion
survives in any view.

**Engine takes SI.** `prVas` returns m³, `prCmsFromVas` takes m³; the ×1000/÷1000 deleted from
both directions. `enterPrDatasheet` now takes `vasM3`. Both litre helpers in the model became
dead and were removed.

**Box types are not alignments** (John's ruling). `AlignmentKind` → `BoxType`, `setAlignment` →
`setBoxType`, and the four `OpenISD…Alignment` record shapes → `…Box`; 84 identifiers moved by
ts-morph AST, plus a comment sweep. Legitimate uses of "alignment" — the Thiele/Small sense
(Butterworth, QB3), `engine/alignments.ts`, and CSS alignment — were left alone.

**ONE BoxType declaration repo-wide**, in `design/engine/types.ts`, six members per John's canon:
`sealed | vented | bandpass4 | bandpass6 | box-passive-radiator | abc`. The engine's 4-value
version, the domain's, the model's, `OgBox` and `BoxDiagramType` are all deleted. The `box-`
prefix is John's, disambiguating the enclosure from the DRIVER type of the same name (ruling D7);
it also removed a driver-type-gate false positive at the root.

`'pr'` is retired everywhere except the persisted wire format, where `projectRepo` maps it at the
single storage boundary — `.owpr` files and share links in the wild carry it.

`bandpass6` and `abc` are declared and REFUSED BY NAME: `Engine.simulatableBoxType()` is the one
place that decides, `validateParams` returns a stated error naming the enclosure, and
`OpenISDProject.canHold()` answers the separate question of whether a RECORD can store one.

## Bugs recorded tonight (4 by this session)

- `BUG_20260828_stored_box_type_is_cast_not_parsed...` — FIXED. Found by api-design reviewing my
  work. `box as BoxType` on a string off disk; an unknown value fell off a switch as `undefined`
  and reached a chart as NaN. Now parsed; unreadable payloads refused and quarantined.
- `BUG_20260828_coverage_config_measures_a_deleted_package...` — PARTLY FIXED, see QO98.
- `BUG_20260828_driver_type_gate_cannot_tell_a_box_type_comparison...` — superseded by the
  `box-` prefix, which removed the collision at its root.
- `BUG_20260828_enterPrDatasheet_takes_litres_for_vas...` — FIXED by the engine SI change.

## NEEDS JOHN

1. **QO98 — coverage config.** `coverage.include` names `packages/engine/src/**` (deleted at
   `7bb1f55`, matches nothing) and omits `packages/design` (27 files, the new central package)
   and `packages/persistence` entirely. Fixing it moves the thresholds (statements 15.8,
   branches 78.5, functions 54.0, lines 15.8), so the gate may fail until they are re-set — and
   re-setting them to whatever falls out would be fitting the gate to the code. That decision is
   John's. **Already fixed:** the missing `persistence` vitest project and the dead `engine` one
   (the suite went 96/2148 → 98/2162 — those 14 tests existed and never ran).
2. **The commit split** across the two streams above.
3. **`VENT_ARITY` bandpass6 = 2** is an unverified assumption by this session — the standard
   two-ported topology, NOT measured against real WinISD. `abc: 3` is John's own figure (QO85).
   Flagged in the constant, the test and the bug record so it cannot be quietly promoted to fact.
   One wine probe settles it.
4. **QO97** (`.wdr` dual-coil reader) deferred to daylight by mutual agreement — the adapter sits
   in this session's files while a refactor was mid-flight.

## What worked, and is worth keeping

Two real bugs were caught, one in each direction, neither of which its author would have found
alone. The check that found them: **"what would have to be true for this to be green AND wrong?"**
If the answer is "the mechanism produced nothing", that is an absent answer wearing the costume of
a right one, not a pass. Every failure tonight had that shape — a cast that disarmed the type
checker, a blanket `catch` swallowing a throw, tests asserting a deleted encoding, six probes from
an instrument that could not detect change, and a coverage config measuring nothing.

Corollary now practised by both sessions: **make every new gate, guard or probe fail on purpose
before trusting it.** Under a minute each. This session's BoxType narrowing was mutation-tested
that way — killing the refusal killed 3 tests, one of them api-design's, written hours earlier for
an unrelated reason. Our tests are load-bearing for each other's invariants without either session
intending it, so neither should tidy a test file that merely "looks like ours".
