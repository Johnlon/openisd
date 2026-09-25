# Handover — UI bugs & tests (openisd)

Written 2026-09-16. Audience: the next agent picking up UI work in this tree. Everything here is
verified against the real tree at `/home/john/work/winisd/openisd` — no fabricated IDs, no guessed
paths. Two source-of-truth files govern this work and were obeyed this session:
`packages/ui/test/AGENTS.md` and the repo `questions.yml` ledger (last number seen QO153).

---

## 1. CURRENT PRIORITY (human ruling, verbatim intent)

> "UI tests and bugs are the priority — log this bug + solution, then go back to fixing all the
>('Parameters')`,
flipped by real commit `a8f0594`). General-tab-only fields (Brand/Model `.de-fld`) are gated behind
`v-if="tab === 'General'"` and **never mount** unless a test switches tabs. Tests that wait on those
cells via `.de-fld` without switching → hang (idle CPU 0–0.5%, ~36 timeouts in the run).

**General testing creed (human's rule — applies to EVERY test):**
- ONLY the test that wants to know the default tab may assert the default.
- THE RULE: every test asserts the editor/project tab it intends **by switching to it**,
  regardless of current tab.
- No test may assume initial state; each must ensure its own initial conditions.

Fix is **test-side**, no source touch: switch to the tab before every `.de-fld` wait.

## 4. A SELF-MADE FILE — REPAIRED IN PLACE on 2026-09-16 (no deletion, no restore)

`packages/ui/test/ui/signal-commits-as-blur-notification.browser.spec.ts` was corrupted on disk
(garbage fragments `…0xh`, `1ESEparameter 1'`, `ISEparameter` — LSP syntax errors at ~L52, L60-61).
Per the COMMIT-FIRST / repair-in-place creed it was PATCHED, not reverted: the `0xh` hex junk → `0`,
and the `1ESEparameter 1'` tails → the trailing `1` precision arg of `toBeCloseTo`. The law the spec
asserts is unchanged and correct: on a blur of a cell modified since commit, the drive group
re-derives the derived member from the still-entered ones (`V=√(P·Re)` / `P=V²/Re`). It references
`docs/debugging/vue-runtime-debugging.md` — that file is fine. **Do NOT `git restore`/`git checkout`
this file again** — the corruption is gone; only the patched bytes are on disk.

**Note for the next agent:** a more robust locator strategy is wanted (V/P/Re rows keyed by a
stable, human-meaningful constant like `power`/`voltage`, NOT by text; cf. the `rowHas` helpers
already used in `packages/ui/test/ui/ui/driver-editor-layout.browser.spec.ts`). Follow the
vue-debugging skill: never hardcode unstable generated IDs.

## 5. FAILING TEST CLUSTERS (from the 2026-08-16 run, 284 tests, `--workers=1`)

- `original-skin.browser.spec.ts` (~32 fails, largely the General-tab hang above)
- `driver-selection` (~7)
- driver-editor-mandatory (~5)
- signal-defaults + several more — each must switch to its intended tab first, then re-drive.

Run sequentially only: `npx playwright test --workers=1 --retries=0` (4 workers OOMs this box —
see BUG_20260913_oom_kills_wsl_vm_during_ui_tests.md). Never parallel.

## 6. FILES THAT BACK THIS (real paths, the only ones to touch)

- `packages/ui/src/ui/components/NumInput.vue` — blur emit (bug site #1 of the Signal fix).
- `packages/ui/src/ui/components/DriverEditorModal.vue` — `tab = ref('Parameters')`, the Signal
  pane rows, blur consumers (bug site #2 of the Signal fix).
- `packages/design/engine/solver.ts` — the law `V=√(P·Re)`; domain must stay focus-free.
- `packages/ui/test/ui/ui/original-skin.browser.spec.ts`, `signal-defaults.browser.spec.ts`,
  the driver-editor / driver-selection specs — the sweep targets for the tab-switch creed.
- `docs/debugging/vue-runtime-debugging.md` — debugging case history (fine as-is).
- `.claude/skills/vue-debugging/SKILL.md` — the skill; keep it free of unstable IDs.

## 6.5. THE DEBUGGING APPROACH (how the root causes were found — reuse this, don't reinvent it)

The two root causes were found by a **measured-evidence chain, not by reading code**, and each claim
below carries its evidence. Reuse this exact method on the next flake cluster:

    1. TELEMETRY FIRST, THEORIES SECOND. Sampled system+chromium CPU/RSS/PSS every 5 s during the
       52-min sequential run (`scripts/telemetry-sampler.mjs` + `analyze-telemetry.mjs`) into
       `build/ui-telemetry/run.log|events.jsonl|memory.jsonl|run.json`. The timeout cluster reads
       as: idle CPU 0-0.5%, memory flat (3.1-3.6 GB free) — that is a DEADLOCK-on-mount signature,
       NOT an OOM and NOT an infinite loop. Never debug from the failure count; debug from the
       telemetry shape.
    2. GENERATED-SOURCE RULE. The `.de-fld`-gating was proven by reading the REAL modal's tab
       default (`tab = ref('Parameters')` in DriverEditorModal.vue, flipped by real commit
       `a8f0594`) and the `v-if="tab === 'General'"` around the Brand/Model rows. Tests that wait on
       `.de-fld` cells for Model/Brand WITHOUT switching to the General tab hang — the General-only
       rows never mount. This is a TEST defect, never the app's; fix test-side only.
    3. THE LAW, NOT THE LABEL. The Signal pane's 1 W background was proven from the coupling law in
       the engine (`packages/design/engine/…`): `V = √(P·Re)`. The observed `1.844 = √(1·3.4)` is
       exactly "1 W into Re=3.4" — never a blank/broken value. Derived V can only exist if P and Re
       are known; a blank P with a non-blank V is impossible, so a 1 W was hiding in the background.
    4. BLUR IS A NOTIFICATION, THREE LAYERS. Losing focus on a cell whose value changed since it was
       committed is a NOTIFICATION EVENT owned by the numeric-input component (NumInput), consumed
       by the hook layer that owns the drive draft, and NEVER seen by the domain (the solver stays
       pure law). Rule: on such a blur the group re-derives its derived member from the still-entered
       ones — never leaves a derived cell blank.
    5. RUN SEQUENTIALLY ONLY. `npx playwright test --workers=1 --retries=0` (4 workers OOMs this WSL
       box — see BUG_20260913_oom…). Never parallel; parallel failures are the box, not the code.

## 6.6. AGENT INSTRUCTIONS ADDED/CHANGED THIS SESSION (persist these as the working creed)

  - TAB-SWITCH CREED (controls every browser spec): ALL tests assert the tab they intend by
    switching to it; NONE may wait on `.de-fld` fields gated behind a non-General tab without
    first switching to General. Only a test whose WHOLE PURPOSE is to verify the default tab may
    assert the default. No test may assume initial state; each must ensure its own initial
    conditions. Generalised: only the test that wants to know the default is the exception.
  - BLUR-AS-NOTIFICATION (component-layer bug, now a creed): a blur where the cell was modified
    since entry is a notification event, emitted by NumInput and consumed by the hook; the domain
    never learns about focus. Lost focus is NEVER a bare focus event to the domain — it is a
    "modified since entry + is leaving" notification the hook re-derives from.
  - FIRST the failing test (TDD), then the fix; the doc §1 creed is the human's ruling verbatim and
    is the only authority for test intent.
  - The vue-debugging skill + docs/debugging/* are real and stay as the knowledge home for Vue
    runtime debugging; the SPEC files in §6 are the only ones to touch.

## 7. NEXT ACTION (exactly one)

Sweep ⊆5 sequentially: add the `switchTo('General')` (or the tab each intends) before every
`.de-fld` wait in `original-skin.browser.spec.ts`, run that ONE file `--workers=1 --retries=0`,
confirm the timeout cluster collapses, THEN spread the same fix to the other clusters. Repair
§4's corrupted spec in passing per its own creed. No source changes. TDD creed applies to any
new test: write the failing test first.
