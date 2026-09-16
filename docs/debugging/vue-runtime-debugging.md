# Vue Runtime Debugging — case history (openisd)

Working notes from 2026-09-16's marathon UI run: **284 tests sequential, 184 passed,
64 failed, 36 timed out**. The timed-outs and a large share of the "fail" bucket were one
deadlock, reproduced with the `vue-debugging` skill and instruments in `scripts/`.

## The hang in one line

The Driver **Editor modal opens** (heading *Edit My Driver*, all four tabs in the DOM)
**but the General gated Brand/Model fields never mount** because `DriverEditorModal.vue`
opens on the tab `'Parameters'`:

- `const tab = ref<Tab>('Parameters')` — the DEFAULT tab is Parameters, and the modal
  opens there intentionally.
- Every non-General tab's fields are gated `v-if="tab === 'General'"` etc. So `Model`/`Brand`
  (which live under General) are **not in the DOM until the test switches to General**.
- A test locator that waits on `.de-fld` for `Model` **without first switching to General**
  times out. `locator.fill` waits on a field that is behind `v-if`; the page sits idle at
  ~0% CPU because nothing threw and nothing keeps looping — the app **correctly** did not
  render a field the user never asked to see.

The idle-CPU signature (0.0–0.5% while a timeout is active, 3.1–3.6 GB RAM available, `jq`
showing `chromiumPct` flat) is the *tell*: this is **not** an OOM and **not** a busy loop —
it is a test waiting forever on a field the app deliberately left un-rendered.

## Root rule (project creed, applies to EVERY spec, not just Vue)

> **Tests may not assume initial state** unless they are the test that *verifies* initial
> state. In general tests must arrange their own precondition before asserting.

Concretely for the driver editor and any modal with tabs:

1. **Only ONE test may assert the default tab** — the one whose very purpose is "the editor
   opens on Parameters". It alone reads `tab` without touching it.
2. **Every other test that cares about a tab switches to it first**, no matter what tab the
   modal currently shows. `await page.locator('.de-tab', { hasText: 'General' }).click()` is
   the arrangement; then assert your fields.
3. Never write `expect(...input).toBeVisible()` for a field you have not first selected the
   tab that contains it. If the assertion is about a field, the test must arrange the tab.

This is a general testing rule — the same holds for the project/box tabs in the Project
editor and for the Signal pane. Arrange, then assert; never bet on the app's default.

## Why it deadlocked instead of failing fast

The failing locators (e.g. `driver-selection.browser.spec.ts:154`) fill a field that never
mounts → `locator.fill` spins until the 60 s per-test timeout. Playwright's reporter records
`timedOut`. Because the editor *is* visible and has zero console/page/network errors, the
obvious "is the modal open?" probes all pass — the only thing that can prove the bug is
prompting the Vue tree (`.claude/skills/vue-debugging/SKILL.md` > "Component-tree probe").

## Applying the fix

The fix is in the SPECS, not the app: each test that fills/asserts a General-gated field
(Brand, Model, Mms…) must first click the `General` tab (see rule 2). The one test that
asserts the *default* tab ("editor opens on Parameters") is unchanged.

### Hinted-by-telemetry correlation

- Chromium CPU% idle-flat across the whole wait window + high memAvailable → the app is
  not starving; the test is waiting on a field behind `v-if`.
- Cluster shape: the same `.de-fld`-for-Model locator appears in 6+ failing files → one
  root rule, not N app bugs. Before touching source, re-read the creed above.

## Files

- `packages/ui/src/ui/components/DriverEditorModal.vue` — `tab` default + `v-if` gating.
- `packages/ui/test/ui/persistence/driver-selection.browser.spec.ts` and
  `my-drivers-failures.browser.spec.ts` — the specs that assumed the old default.
- `scripts/analyze-telemetry.mjs` — cluster analysis over `ui-telemetry/events.jsonl`.
