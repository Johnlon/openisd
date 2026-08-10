import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

// STATE_MODEL.md rule 1: choosing a driver EMBEDS it in the project. The pick copies the
// driver in, closes the picker, and returns the user to the project — there is no editor in
// the way and no live link back to where the driver came from. Editing is a separate act,
// from the Driver panel's Edit button, and it edits the project's own copy.
// The browserLog auto-fixture also asserts a clean console + network throughout.
//
// The driver under test is seeded into "My Drivers" rather than taken from the bundled
// catalogue: what is being tested is the choose → embed flow, which must not depend on how
// many records the bundler currently ships (see scripts/bundle-drivers.mjs).

const PICKED = 'Spec Fixture Driver';
const EDITOR = '.de-modal';
const PICKER = '.modal:not(.de-modal)';   // the library dialog, whichever skin drew it

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(name => {
    localStorage.setItem('openisd_my_drivers', JSON.stringify([{
      name, brand: 'Spec', model: 'Fixture',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Z: 8, _savedAt: 1,
    }]));
  }, PICKED);
  await page.goto('/');
});

// Open the library and choose the seeded driver — the flow every skin shares.
/**
 * Open the full driver editor on the PROJECT's driver. Only the WinISD-style shells carry a
 * real Edit button for it (`OriginalShell.vue` → `state.editDriverInfo`); the Modern skin
 * edits through its inline What-If panel instead. So these tests switch to Original, which
 * is also the app's default outside the test port.
 */
async function openProjectDriverEditor(page: Page) {
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await expect(page.locator(EDITOR)).toBeVisible();
}

async function pickSeededDriver(page: Page) {
  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  await page.locator('.my-ditem b', { hasText: PICKED }).click();
  // The Modern skin previews first, so "Use this driver" is the choice there; the
  // WinISD-style skins choose on the row click itself.
  const use = page.locator('.use-btn');
  await use.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await use.isVisible()) await use.click();
}

test('choosing a driver embeds it in the project and closes the picker', async ({ page }) => {
  // No goto here: beforeEach already loaded the seeded page. A third navigation cancels the
  // second load's in-flight requests — `icon.svg` aborts — and the fixture rightly counts an
  // aborted same-origin request as a network failure.
  const before = (await page.locator('.nm').first().textContent())?.trim();

  await pickSeededDriver(page);

  // Straight back to the project: no editor, no picker.
  await expect(page.locator(EDITOR)).toBeHidden();
  await expect(page.locator(PICKER)).toBeHidden();

  // And the project now holds the chosen driver.
  const after = (await page.locator('.nm').first().textContent())?.trim();
  expect(after).not.toBe(before);
  expect(after).toContain('Spec');
});

test('the embedded driver is a copy — editing it does not touch the saved driver', async ({ page }) => {
  await pickSeededDriver(page);

  // Edit the project's driver, changing its model.
  await openProjectDriverEditor(page);

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await modelInput.fill('Fixture Edited');
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
  await expect(page.locator(EDITOR)).toBeHidden();

  // The saved driver in My Drivers is untouched — a project embeds a COPY.
  const saved = await page.evaluate(() => localStorage.getItem('openisd_my_drivers'));
  expect(saved).toContain('"model":"Fixture"');
  expect(saved).not.toContain('Fixture Edited');
});

test('Copy to My Drivers writes the edited driver into the saved list', async ({ page }) => {
  await pickSeededDriver(page);

  await openProjectDriverEditor(page);

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await modelInput.fill('Fixture Copy');
  await page.locator('.de-copy-my').click();
  await page.locator('.save-confirm-btn').click();

  // A new identity (spec/fixture-copy) means a new saved driver beside the original.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('openisd_my_drivers') ?? '[]'));
  expect(saved.map((d: { model: string }) => d.model).sort()).toEqual(['Fixture', 'Fixture Copy']);
});

test('Escape closes the editor and leaves the project driver as it was', async ({ page }) => {
  await pickSeededDriver(page);
  await openProjectDriverEditor(page);

  // Type into the draft, then abandon it. `.driver-id-row` is the Original shell's
  // read-only Brand/Model pair, which reflects the PROJECT's driver.
  const projectModel = page.locator('.driver-id-row input').nth(1);
  const before = await projectModel.inputValue();

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await modelInput.fill('Discarded');
  await page.keyboard.press('Escape');

  await expect(page.locator(EDITOR)).toBeHidden();
  await expect(projectModel).toHaveValue(before);
});

// ---- editing a SAVED driver ------------------------------------------------------------
// The same dialog serves two subjects. The ✎ on a My Drivers row opens it on that SAVED
// driver: OK rewrites the My Drivers entry and the project is not involved. The title says
// which, so the user is never guessing what OK will change.

test('the ✎ on a My Drivers row opens the editor on that saved driver', async ({ page }) => {
  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator(EDITOR)).toContainText('Edit My Driver');
  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await expect(modelInput).toHaveValue('Fixture');
});

test('editing a saved driver rewrites its entry and leaves the project alone', async ({ page }) => {
  const beforeProject = (await page.locator('.nm').first().textContent())?.trim();

  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await modelInput.fill('Fixture Mk2');
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
  await page.locator('.save-confirm-btn').click();
  await expect(page.locator(EDITOR)).toBeHidden();

  // The rename MOVES the entry — one saved driver, under its new identity, no stale twin.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('openisd_my_drivers') ?? '[]'));
  expect(saved.map((d: { model: string }) => d.model)).toEqual(['Fixture Mk2']);

  // The project's driver never entered into it.
  expect((await page.locator('.nm').first().textContent())?.trim()).toBe(beforeProject);
});

test('the picker shows the new name as soon as the editor closes', async ({ page }) => {
  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await modelInput.fill('Renamed Live');
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
  await page.locator('.save-confirm-btn').click();

  // The picker is still open behind the editor; its list must not be stale.
  await expect(page.locator('.my-ditem', { hasText: 'Renamed Live' })).toBeVisible();
  await expect(page.locator('.my-ditem', { hasText: PICKED })).toBeHidden();
});

test('Cancel on a saved driver writes nothing', async ({ page }) => {
  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await modelInput.fill('Never Saved');
  await page.locator(`${EDITOR} .de-footer button:has-text("Cancel")`).click();
  await expect(page.locator(EDITOR)).toBeHidden();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('openisd_my_drivers') ?? '[]'));
  expect(saved.map((d: { model: string }) => d.model)).toEqual(['Fixture']);
});
