# The app titlebar and its build datetime are gone

Status: OPEN (re-verified 2026-09-26) — the build date is defined at build time but shown nowhere.

## Symptom

`packages/ui/test/ui/original-skin.browser.spec.ts:78` asserts a build datetime in the app's
titlebar:

```ts
test('the titlebar displays the build datetime', async ({ page }) => {
  const tbCenter = page.locator('.titlebar .tb-center');
  await expect(tbCenter).toBeVisible();
  const text = await tbCenter.innerText();
  expect(text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
});
```

Neither the element nor the value it displays exists in `packages/ui/src`:

```
$ command grep -rn "tb-center" packages/ui/src/          # no matches
$ command grep -rn "titlebar" packages/ui/src/
packages/ui/src/ui/shells/original/OriginalShell.vue:1372:  <div class="modal-titlebar">   # modals only
```

`.original-root` opens directly on `.toolbar` (`OriginalShell.vue:797-799`). There is no app
titlebar, so no `.tb-center`, and no build stamp is defined anywhere in the package.

A sibling assertion in the same spec is stale for the same reason and is recorded separately:
`BUG_20260909_original_skin_test_asserts_a_titlebar_string_the_app_no_longer_renders.md`.

## Impact

Two things were lost, and only one of them is a test problem:

1. **The feature.** A visible build datetime is how anyone confirms which build the browser is
   actually running — directly relevant to this repo's own stale-bundle rule (`AGENTS.md`
   §"Port 4000": *"'The fix isn't showing' is a stale bundle until the served asset hash is
   compared"*). Without it, that check needs the asset hash instead of a glance.
2. **The evidence.** This test is now the only record in the tree that the app ever displayed
   one.

## Cause

NOT established. The titlebar was removed from `OriginalShell.vue` at some point and this test
was not removed or updated with it. Whether the removal was deliberate (a layout decision) or
incidental (lost in the shell rework) is not determinable from the current tree — the string,
the element and the build-time define are all absent, so there is nothing left to read.

## Fix

RULED (John, 2026-09-09): *"put the build datetime somewhere else out of the way in the screen,
the title bar was deliberately deleted"*.

So the titlebar does not come back. The build datetime does, in an unobtrusive place, and the
test is repointed at wherever it lands — it keeps asserting the datetime is displayed, not the
titlebar that used to carry it.

## Verification

`npx playwright test packages/ui/test/ui/original-skin.browser.spec.ts -g "build datetime"`
fails at `expect(tbCenter).toBeVisible()`.
