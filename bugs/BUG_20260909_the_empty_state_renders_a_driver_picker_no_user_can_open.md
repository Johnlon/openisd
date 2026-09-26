# The empty state renders a driver picker no user can open

Status: RESOLVED (re-verified 2026-09-26) — confirmed: `DriverBrowser` (renamed from `DriverBrowserWinisd`) is always mounted and self-gates.

## Symptom

`App.vue` renders the driver browser specifically for the no-project case:

```
packages/ui/src/ui/App.vue:95
  <DriverBrowserWinisd v-if="!project && presentationState.browseOpen" />
```

The `!project` half of that condition can never be satisfied through the UI. The empty state
rendered beside it offers exactly one control, and it opens the New Project wizard:

```
packages/ui/src/ui/App.vue:90-93
  <div v-else class="no-project-open">
    <p>No project is open.</p>
    <button type="button" @click="presentationState.newProjectOpen = true">Start a new project</button>
  </div>
```

`browseOpen` is set in one place only — the shell's "Manage Drivers" toolbar button
(`OriginalShell.vue:820`) — and the whole shell sits inside `v-if="project"`
(`App.vue:78`). So while there is no project there is no toolbar, nothing can set
`browseOpen`, and the `!project` branch never renders.

```
$ command grep -n "browseOpen" packages/ui/src/ui/App.vue
95:  <DriverBrowserWinisd v-if="!project && presentationState.browseOpen" />
```

## Impact

Either the app is missing a way to browse drivers before starting a project, or line 95 is
dead markup that reads as a working feature. Both are worth knowing:

- If browsing driver-first is intended (pick a driver, then build a box around it —
  `openProjectFromDriver()` in `appState.ts:446` exists for exactly that), the empty state is
  missing its second button and users cannot reach a documented path.
- If it is not intended, line 95's `!project` condition is misleading and should go.

It also blocks tests: five `packages/ui/test/persistence/driver-*.browser.spec.ts` specs open
the picker with `page.locator('[title*="librar" i]')` straight after `page.goto('/')`, which
can only work when a project already exists.

## Cause

The no-project empty state (PROMPT_RELEASE_HARDENING plan) was added with a single recovery
action. `App.vue:95`'s `!project` branch anticipates a no-project browse path whose entry
point was never added to the empty state, or was removed with the old shell-selection screen.

NOT established: which of the two. The condition's existence shows someone intended the
picker to work without a project.

## Fix

John's call — it is a product question about whether driver-first browsing is a supported
path:

- **Supported**: add a "Browse drivers" button to the empty state setting
  `presentationState.browseOpen = true`. `App.vue:95` then works as written, and
  `chooseDriver` already routes through `openProjectFromDriver()` to make a project from the
  chosen driver.
- **Not supported**: drop the `!project &&` half of line 95, since the picker only ever
  renders inside the shell.

Not doing either unilaterally: one adds a button to the app's first screen, the other deletes
a branch someone wrote deliberately.

## Verification

The five affected specs currently time out on
`waiting for locator('[title*="librar" i]').first()`, since the toolbar that carries that
title does not exist without a project.
