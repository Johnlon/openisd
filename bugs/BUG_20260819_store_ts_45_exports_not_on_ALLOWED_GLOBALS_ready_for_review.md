# store.ts's exports vs `ALLOWED_GLOBALS` — the review list, with TEN of them dead

# Status
OPEN — the ten dead exports are removed from `store.ts` (task A1, 2026-08-21: eight deleted,
`curveIssues`/`restoreProblems` un-exported but kept internal); the gate's offence list now
reads 34, and the review of those remaining 34 is what stays open for the human.

## Symptom

`architecture.test.ts`'s `'module-level globals — only openProjects()/focusedProject() are
legal'` gate flags 45 of `store.ts`'s exports as not present in its own `ALLOWED_GLOBALS`
array (currently `['openProjects', 'focusedProject', 'focusProject', 'removeProject',
'addProject']`, `store.ts:97-99`). That array is explicitly human-edit-only (the test's own
comment: "ONLY the human may add, remove, or edit an entry here — no agent may widen this list
on its own judgement to make a red test pass").

## Investigation (this session)

Checked every one of the 45 flagged exports for actual external usage (`.vue` components,
other `logic/` modules, tests).

**CORRECTION, re-measured 2026-08-21 — the original "every one of them has real callers; none is
dead code" is FALSE for TEN of them.** Counting references across `packages/ui/src` and
`packages/ui/test`, excluding `store.ts`'s own declaration and `architecture.test.ts`'s offence
list:

| export | external refs | what the refs actually are |
|---|---|---|
| `driverMetaCell` | 0 | — |
| `driverWarnings` | 0 | — |
| `curveIssues` | 0 | — |
| `restoreProblems` | 0 | — |
| `unitLabelOf` | 0 | — |
| `enterPrField` | 1 | its own declaration in `logic/usePrGroup.ts` — a DIFFERENT module, so the store's export is unused |
| `clearPrField` | 1 | same |
| `prFieldState` | 1 | same |
| `prTargetUnreachable` | 1 | same |
| `loadDriverRecord` | 6 | every one resolves to `managedProject.loadDriverRecord`, never the store's |

So all ten can be un-exported with no caller change, which is objective 1 of
`docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md` and shrinks the list before any human review of it.
The remaining 35 are the ones that need judgement. One (`restoreProblems`) is itself a separate,
already-filed bug (write-with-no-reader,
`BUG_20260819_restoreProblems_computed_but_never_read_by_the_ui.md`) — worth resolving THAT
bug (wire it to a UI element, or delete it) before deciding its fate here, since the answer to
"should this stay a global" differs depending on whether the write is ever meant to be read.

## Proposal — grouped for tomorrow's review, not applied

**Registry (write side of the already-approved openProjects/focusedProject pair) — add as-is:**
`focusProject`, `removeProject`, `addProject` are already IN `ALLOWED_GLOBALS`, listed here only
to confirm they need no further action.

**Vent/PR group accessors — thin delegates to `useVentGroup.ts`/`usePrGroup.ts`, called
directly by UI components (`OgTune.vue`, box/PR panels):**
`enterVentField`, `clearVentField`, `ventFieldState`, `ventTargetUnreachable`,
`ventMaxReachableFb`, `enterPrField`, `clearPrField`, `prFieldState`, `prTargetUnreachable`

**Driver read/write — the store's delegate surface onto `managedProject`'s driver cell API:**
`loadDriverRecord`, `setDriverFromWdr`, `enterDriverField`, `clearDriverField`, `driverCell`,
`driverMetaCell`, `engineDriver`, `_projectToPersist`, `openDriverPicker`, `driverErrors`,
`driverConsistencyIssues`

**Ground/save state:**
`markProjectSaved`, `groundCheckpoint`, `restoreGroundCheckpoint`, `resetProjectToGround`,
`newProject`, `applyState`

**Unit-token presentation state:**
`unitToken`, `cycleUnitToken`, `resetUnitTokens`, `unitLabelOf`, `formatInUnit`

**The two objects everything above is built from — genuinely THE state:**
`managedProject`, `state`

**Reactive read-outs (Vue `computed`s and one `ref`):**
`driverRecord`, `driverName`, `driverWarnings`, `syncedP`, `curvesData`, `maxData`,
`curveIssues`, `paramIssues`, `allIssues`, `isModified`, `simVcInductance`

**Needs its own decision first, not a blanket add — see the linked bug above:**
`restoreProblems`

## Fix

Not applied. Tomorrow's options, in order of effort:
1. **Minimal**: paste the ~35 names above (everything except `restoreProblems`, pending its own
   bug) into `ALLOWED_GLOBALS` as-is. Gate goes green immediately; matches today's actual
   architecture (store.ts as the UI-facing API surface).
2. **QO60-aligned**: build the SERVICE layer QO60's `ARCHITECTURE.md` ruling calls for first,
   moving these exports (or thin wrappers around them) there instead, and `ALLOWED_GLOBALS`
   stays small. Bigger, correct-per-target-architecture, not a one-sitting change.

## Verification

Not yet — no fix applied, this is a proposal for the human's own edit.
