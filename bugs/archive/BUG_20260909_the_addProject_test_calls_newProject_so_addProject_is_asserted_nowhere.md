# The `addProject()` test calls `newProject()`, so `addProject` is asserted nowhere

Status: RESOLVED 2026-09-09

## Symptom

```
packages/ui/test/logic/projectRegistry.test.ts
  13:62  error  'addProject' is defined but never used  @typescript-eslint/no-unused-vars
```

The lint error is the visible half. The test named for `addProject` never calls it:

```ts
it('addProject() appends and focuses the new project', () => {
    const before = openProjects().length;

    newProject();

    assert.equal(openProjects().length, before + 1);
    assert.equal(focusedProject(), openProjects()[before], 'the newly added project becomes focused');
});
```

A later test's message also credits it for behaviour it did not exercise:
`assert.equal(focusedProject(), p2, 'addProject focused it')`.

## Impact

`addProject(project)` — the registry's entry point for a project that already exists (a `.owpr`
opened from disk, a share link, a `.wpr` import) — has no test. `newProject()` happens to call
it, so the suite is green while the function's own contract is unasserted: hand it an existing
project, it appends that project and focuses it. A change breaking that path is caught only if
it also breaks `newProject`.

The two are not interchangeable: `newProject()` builds a blank project, `addProject(p)` adopts
one that was built elsewhere. Every file-open door uses the second.

## Fix

Assert `addProject` directly: build a project, hand it over, and check both that the registry
grew by that exact object and that focus moved to it.

## Verification

The test now builds a project and hands it over, asserting the registry holds that exact object
and that focus moved to it.

```
npx vitest run packages/ui/test/logic/projectRegistry.test.ts   7 passed
npx eslint packages/ui/test/logic/projectRegistry.test.ts       clean
```

Made to fail on purpose: dropping the `focusedIndex.value = ...` line from `addProject` turned it
red (along with the clamp test), then restored.
