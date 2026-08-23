import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.js';

// docs/design/STATE_MODEL.md rule 1: choosing a driver EMBEDS it in the project. The pick copies the
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
const PICKER = '.modal:not(.de-modal)';   // the library dialog

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(name => {
    // The CURRENT bucket shape: a { schema, drivers } envelope of conforming records
    // (BUG_20260822_driver_selection_spec_seeds_a_flat_shape — the old flat seed was a
    // shape myDrivers refuses, so the spec exercised the broken-row path, not selection).
    const spec = (v: number) => ({ origin: 'manual', readings: { manual: { read_value: v } }, dq: [] });
    localStorage.setItem('openisd_my_drivers', JSON.stringify({
      schema: 2,
      drivers: [{
        uuid: { value: 'spec-fixture-uuid', definition: 'stable record identity' },
        quality: { rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [],
          invalid: [], parse_errors: [], cross_source_only: [] },
        manufacturer: { value: 'Spec', origin: 'manual', definition: 'x', dq: [] },
        brand: { value: 'Spec', origin: 'manual', definition: 'x', dq: [] },
        model: { value: 'Fixture', origin: 'manual', definition: 'x', dq: [] },
        sku: { value: name, definition: 'x', grounds: [] },
        driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
        data_sources: { value: {}, definition: 'x' },
        authoritative: { value: 'manual', definition: 'x' },
        specs: { woofer: {
          Fs: spec(41), Qts: spec(0.35), Qes: spec(0.38), Qms: spec(4.5), Vas: spec(0.028),
          Sd: spec(0.0132), Re: spec(5.4), Le: spec(0.5e-3), Xmax: spec(0.0055),
          Pe: spec(70), Znom: spec(8),
        } },
      }],
    }));
  }, PICKED);
  await page.goto('/');
});

/** Open the library — the toolbar's Manage Drivers button, visible on every tab. */
function openPicker(page: Page) {
  return page.locator('.tb-btn[title^="Manage Drivers"]').click();
}

/**
 * What the project's driver is CALLED, read off the Driver tab's read-only Brand/Model pair.
 * That pair reflects the PROJECT's own copy, which is exactly what "choosing embeds" has to
 * change — the library row it came from is left alone.
 */
async function projectDriverName(page: Page): Promise<string> {
  // Select the tab only when it is not already showing. Reading this AFTER an edit happens
  // with the picker still open behind the editor, and a click would be intercepted by that
  // overlay — whereas reading a value never needs the element to be clickable.
  const tab = page.locator('.project-nav li', { hasText: 'Driver' });
  if (!(await tab.evaluate(el => el.classList.contains('active')))) await tab.click();
  const ids = page.locator('.driver-id-row input');
  return `${(await ids.nth(0).inputValue()).trim()} ${(await ids.nth(1).inputValue()).trim()}`.trim();
}

/** Open the full driver editor on the PROJECT's driver, from the Driver panel's Edit button. */
async function openProjectDriverEditor(page: Page) {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await expect(page.locator(EDITOR)).toBeVisible();
}

/** Open the library and choose the seeded driver. */
async function pickSeededDriver(page: Page) {
  await openPicker(page);
  await page.locator('.my-ditem b', { hasText: PICKED }).click();
  // A row click summarises; "Use" is what chooses.
  const use = page.locator('.use-btn');
  await use.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await use.isVisible()) await use.click();
}

test('choosing a driver embeds it in the project and closes the picker', async ({ page }) => {
  // No goto here: beforeEach already loaded the seeded page. A third navigation cancels the
  // second load's in-flight requests — `icon.svg` aborts — and the fixture rightly counts an
  // aborted same-origin request as a network failure.
  const before = await projectDriverName(page);

  await pickSeededDriver(page);

  // Straight back to the project: no editor, no picker.
  await expect(page.locator(EDITOR)).toBeHidden();
  await expect(page.locator(PICKER)).toBeHidden();

  // And the project now holds the chosen driver.
  const after = await projectDriverName(page);
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
  expect(saved).toContain('"value":"Fixture"');
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
  await openPicker(page);
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator(EDITOR)).toContainText('Edit My Driver');
  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await expect(modelInput).toHaveValue('Fixture');
});

test('editing a saved driver rewrites its entry and leaves the project alone', async ({ page }) => {
  const beforeProject = await projectDriverName(page);

  await openPicker(page);
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
  expect(await projectDriverName(page)).toBe(beforeProject);
});

test('the picker shows the new name as soon as the editor closes', async ({ page }) => {
  await openPicker(page);
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
  await openPicker(page);
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  await modelInput.fill('Never Saved');
  await page.locator(`${EDITOR} .de-footer button:has-text("Cancel")`).click();
  await expect(page.locator(EDITOR)).toBeHidden();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('openisd_my_drivers') ?? '[]'));
  expect(saved.map((d: { model: string }) => d.model)).toEqual(['Fixture']);
});
