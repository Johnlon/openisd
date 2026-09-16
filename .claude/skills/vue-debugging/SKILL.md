---
name: vue-debugging
description: Diagnose Vue app runtime problems in openisd's headless Playwright tests — component-tree introspection via #app.__vue_app__, the idle-CPU deadlock signature, .de-fld tab gating, and telemetry correlation. Use when a browser spec hangs (60s timeout with zero console/page/network errors), when a modal "opens" but its fields never render, or when asked how to debug Vue state from a headless test.
---

# Vue Debugging — openisd

Diagnosing this app's runtime bugs from headless Playwright tests, learned the hard way on
2026-09-16 (see `docs/debugging/vue-runtime-debugging.md` for the full case history).

## Why the obvious tools don't reach

The app is Vue 3, headless Chromium, automated. Two everyday tools are dead on arrival:

- **Vue DevTools extension** — needs a GUI browser with a human at the DevTools panel. Useless
  for a hang that happens at 02:00 under Playwright.
- **`debugger-for-chrome` / VSCode breakpoints** — interactive stepping; cannot attach to a
  Playwright worker mid-test.

The information they show is NOT locked to them though. Vue 3 stores the live app instance on
the mount element: **`document.querySelector('#app').__vue_app__`**. That hands a Playwright
`page.evaluate` the same component tree + reactive state DevTools paints — emit it as JSON and
a hang stops being mysterious.

## The one-page recipe (on any hanging test)

1. **Reproduce with trace ON, single test** (NEVER parallel — the WSL VM OOM-kills two runs,
   see `docs/debugging/vue-runtime-debugging.md`):
   ```
   OPENISD_TEST_PORT=4200 OPENISD_TEST_WORKERS=1 npx playwright test <spec> \
     --workers=1 --retries=0 --grep "<failing title>" --trace on --output build/trace-diagnostics
   ```
   This writes `error-context.md` + `trace.zip` per test — Playwright already recorded the DOM
   snapshot, console, network and (crucially) **the exact locator it was waiting on**.

2. **Read `error-context.md` FIRST.** 90% of the time the "waiting for" locator names the broken
   aspect directly (e.g. `.de-fld [label=Model] > input` never appearing).

3. **Classify the failure:** was the page spinning or frozen? Check the memory sampler:
   ```
   tail -20 build/ui-telemetry/memory.jsonl | jq .chromiumCpuPct
   ```
   - CPU ~0% during a 60s timeout → **idle deadlock** (promise/watcher never resolves).
   - CPU pegged → **busy loop** / re-render storm. Different fixes entirely.

4. **Ask the DOM what it was doing.** Empty page snapshot + alive shell = component mounted but
   fields gated off. Grep the Vue template for the missing node's wrapper and its `v-if`.

## Component-tree probe

Run inside `page.evaluate` on the hung page; walks `__vue_app__` and flattens the instance tree
with names + mounted state + subtree source. Returns JSON you can grep for `DriverEditorModal`,
`tab`, `isMounted`:

```js
function dumpVueTree() {
  const app = document.querySelector('#app')?.__vue_app__;
  if (!app) return { error: 'no __vue_app__ (is the app a dev build? app.mount sets it)' };
  const rows = [];
  const walk = (inst, depth) => {
    if (!inst || !inst.type) return;
    let name = '?';
    if (typeof inst.type === 'string') name = `<${inst.type}>`;
    else name = inst.type.name || inst.type.__name || 'Anonymous';
    rows.push({ depth, name, isMounted: !!inst.isMounted, tab: inst.setupState?.tab });
    const vnode = inst.subTree;
    if (vnode && vnode.children instanceof Array) {
      for (const child of vnode.children) walk(child.component, depth + 1);
    }
  };
  walk(app._instance, 0);
  return rows;
}
// page.evaluate(dumpVueTree)
```

Note: `inst.isMounted` is not public API — in dev builds it exists; if `undefined`, compare
`!!inst.subTree && !!inst.subTree.el` instead.

## Know-your-traps (openisd specifics, 2026-09)

- **The modal DELIBERATELY opens on `Parameters`** (`tab = ref('Parameters')`, eye-a8f0594).
  General-gated fields (`.de-fld` for Model/Brand, gated `v-if="tab === 'General'"`) do NOT
  mount until the user picks General. So a test that waits on a General field WITHOUT first
  switching tabs is a **test bug, not an app bug** — the app is showing you Parameters exactly
  as designed. Every test (except the one that verifies the DEFAULT tab) must switch tabs
  before asserting anything tab-gated — never assume the default (rule 66a). A snapshot showing
  the modal as an EMPTY shell (generic divs, no `.de-fld`, no labels) while `.de-modal` IS
  visible = test waited on a field gated behind a tab it never switched to, not a missing dialog.
- **".de-fld" is the universal editor-field selector**: `driver-selection`, `driver-editor-*`
  and `tune-panel-*` all hang on the same locator shape → one shared root cause, not N bugs.
- **Zero console/page/network errors on a hang is NORMAL here.** The auto-fixture asserting
  clean logs is a pass-gate; an idle deadlock produces exactly zero diagnostics. Absence of
  errors does NOT mean the page is healthy.
- **Every test run must be sequential** for telemetry attribution. `.claude/skills/` and the
  OOM histories document why; two concurrent runs historically get SIGKILLed.
- **App is a dev vite build under test** — `__vue_app__` is present (prod `app.mount(#app)`
  also sets it, but tree shape differs). Prefer matching on component `name`/`__name`, not vnode
  source.

## Creed

Test-driven, evidence-first: reproduce → get the waiting-locator → classify idle vs spinning →
ask the Vue instance tree → THEN touch source. Never hand-wave a Vue hang without the tree dump;
the `.de-fld` trap has burned a full day before (see `docs/debugging/vue-runtime-debugging.md`).