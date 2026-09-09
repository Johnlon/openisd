# No project can be opened from a file when none is open

Status: OPEN

## Symptom

With no project open, the app renders its empty state:

```
packages/ui/src/ui/App.vue:90-93
  <div v-else class="no-project-open">
    <p>No project is open.</p>
    <button type="button" @click="presentationState.newProjectOpen = true">Start a new project</button>
  </div>
```

Its only action starts the New Project wizard. Every file input in the app is inside the
shell, which `App.vue:78` gates behind `v-if="project"`:

```
$ command grep -rn 'type="file"' packages/ui/src/
packages/ui/src/ui/components/DriverBrowserWinisd.vue:347   # inside the picker
packages/ui/src/ui/components/DriverEditorModal.vue:929     # inside the editor
packages/ui/src/ui/shells/original/OriginalShell.vue:1413   # inside the shell
```

`OriginalShell.vue:1413` is the one that accepts project files
(`accept=".owpr,.wpr,.owdr,.wdr,.json"`), and its opener is the toolbar's Open button
(`openClick()`, line 419) — also inside the gate.

So on a cold start with no autosave and no share link, a user holding a `.owpr` file has no
way to open it. The only route to a project is the wizard, which requires picking a driver
from the library.

## Impact

A saved project cannot be reopened from a cold start. That is the ordinary "I saved my work
yesterday, let me carry on" path: the file exists, the app can parse it
(`projectRepo.readProjectText`), and there is no control to hand it over.

Workarounds that do exist are all indirect — restore from autosave, follow a share link, or
build a throwaway project through the wizard first and then use File → Open. Each depends on
state the user may not have.

It also blocks the browser suite: opening a `.owpr` is the realistic, few-step way for a test
to arrive at a populated app (John's instruction, 2026-09-09), and no such path exists from
the empty state.

## Cause

The no-project empty state (PROMPT_RELEASE_HARDENING plan) was given one recovery action.
File opening lives entirely in `OriginalShell.vue`, which only renders once a project exists,
so the two never meet. The same gate is why `App.vue:95`'s `!project && browseOpen` branch is
unreachable — recorded separately in
`BUG_20260909_the_empty_state_renders_a_driver_picker_no_user_can_open.md`.

## Fix

Give the empty state its own Open control, reusing the existing import path rather than a
second one: a hidden `<input type="file">` with the same `accept` list, wired to the same
`importFile()` used by the shell's `onFile`. `importFile` already opens a project file in a
new tab and handles the driver-file cases, so nothing about the import logic changes.

## Verification

Pending.
