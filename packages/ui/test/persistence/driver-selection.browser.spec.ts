import type {Page} from '@playwright/test';
import {editorTab, expect, openAProject, test} from '../fixtures.js';
import {MY_DRIVERS_KEY, myDriversJson} from '../fixtures/seedMyDrivers.js';

// docs/design/STATE_MODEL.md rule 1: choosing a driver EMBEDS it in the project. The pick copies the
// driver in, closes the picker, and returns the user to the project — there is no editor in
// the way and no live link back to where the driver came from. Editing is a separate act,
// from the Driver panel's Edit button, and it edits the project's own copy.
// The browserLog auto-fixture also asserts a clean console + network throughout.
//
// The driver under test is seeded into "My Drivers" rather than taken from the bundled
// catalogue: what is being tested is the choose → embed flow, which must not depend on how
// many records the bundler currently ships (see scripts/bundle-drivers.mjs).

// The row's name is the driver's own Brand + Model (displayNameOf) — there is no stored name.
const PICKED = 'Spec Fixture';
const EDITOR = '.de-modal';
const PICKER = '.modal:not(.de-modal)';   // the library dialog

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.evaluate(([key, json]) => {
    localStorage.setItem(key, json);
  }, [MY_DRIVERS_KEY, myDriversJson([{
    brand: 'Spec', model: 'Fixture', uuid: 'spec-fixture-uuid',
    specs: {
      Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028,
      Sd_m2: 0.0132, Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8,
    },
  }])] as const);
  await page.goto('/');
  await openAProject(page);
});

/** The model of every driver in My Drivers, out of the stored envelope. */
async function savedModels(page: Page): Promise<string[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    const env = raw ? JSON.parse(raw) as { entries?: { record?: { model?: { value?: string } } }[] } : { entries: [] };
    return (env.entries ?? []).map(e => e.record?.model?.value ?? '');
  }, MY_DRIVERS_KEY);
}

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

/**
 * The editor's Model cell. Model lives on the GENERAL pane and the editor opens on Parameters,
 * so the pane is ensured on every use rather than assumed: reaching for this cell on the
 * Parameters pane waits on an element that never mounts, which is a 60 s timeout, not a failure
 * (ui-bugfix.md testing creed).
 */
async function modelCell(page: Page) {
  await editorTab(page, 'General');
  return page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
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

  const modelInput = await modelCell(page);
  await modelInput.fill('Fixture Edited');
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
  await expect(page.locator(EDITOR)).toBeHidden();

  // The saved driver in My Drivers is untouched — a project embeds a COPY.
  const saved = await page.evaluate(() => localStorage.getItem('openisd_my_drivers'));
  expect(saved).toContain('"value":"Fixture"');
  expect(saved).not.toContain('Fixture Edited');
});

test('OK on the project driver updates the project — it is left edited, nothing is saved', async ({ page }) => {
  await openProjectDriverEditor(page);

  await (await modelCell(page)).fill('Fixture Edited');
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
  await expect(page.locator(EDITOR)).toBeHidden();

  // OK routed the change into the PROJECT (editor → project.update): the project is now
  // EDITED — Save arms and Revert offers to discard. It did NOT head for My Drivers.
  await expect(page.locator('.tb-btn.dirty')).toBeVisible();
  // The toolbar's Revert, specifically: the save rail carries a second one with the same
  // title, under every project tab.
  await expect(page.locator('.tb-btn[title^="Revert — discard all unsaved"]')).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('openisd_my_drivers'));
  expect(saved).not.toContain('Fixture Edited');
});

test('Copy to My Drivers writes the edited driver into the saved list', async ({ page }) => {
  await pickSeededDriver(page);

  await openProjectDriverEditor(page);

  const modelInput = await modelCell(page);
  await modelInput.fill('Fixture Copy');
  await page.locator('.de-copy-my').click();
  await page.locator('.save-confirm-btn').click();

  // A new identity (spec/fixture-copy) means a new saved driver beside the original.
  const savedM = await savedModels(page);
  expect(savedM.sort()).toEqual(['Fixture', 'Fixture Copy']);
});

test('Escape closes the editor and leaves the project driver as it was', async ({ page }) => {
  await pickSeededDriver(page);
  await openProjectDriverEditor(page);

  // Type into the draft, then abandon it. `.driver-id-row` is the Original shell's
  // read-only Brand/Model pair, which reflects the PROJECT's driver.
  const projectModel = page.locator('.driver-id-row input').nth(1);
  const before = await projectModel.inputValue();

  const modelInput = await modelCell(page);
  await modelInput.fill('Discarded');
  await page.keyboard.press('Escape');

  await expect(page.locator(EDITOR)).toBeHidden();
  await expect(projectModel).toHaveValue(before);
});

// ---- editing a SAVED driver ------------------------------------------------------------
// The same dialog serves two subjects. The ✎ on a My Drivers row opens it on that SAVED
// driver: OK commits through the save dialog and the project is not involved. The title says
// which, so the user is never guessing what OK will change.
//
// Identity is (brand, model) and it is immutable once saved: a name-changing OK does not
// REWRITE the entry, it writes a NEW entry under the new identity and keeps the original —
// exactly the "Save as a copy keeps the original" outcome the name-changing-rename question
// offers on the Save path (my-drivers-failures spec). The project is a bystander throughout.

test('the ✎ on a My Drivers row opens the editor on that saved driver', async ({ page }) => {
  await openPicker(page);
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator(EDITOR)).toContainText('Edit My Driver');
  const modelInput = await modelCell(page);
  await expect(modelInput).toHaveValue('Fixture');
});

test('editing a saved driver writes a new entry under the new identity and leaves the project alone', async ({ page }) => {
  const beforeProject = await projectDriverName(page);

  await openPicker(page);
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  const modelInput = await modelCell(page);
  await modelInput.fill('Fixture Mk2');
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
  await page.locator('.save-confirm-btn').click();
  await page.locator('.save-as-copy-btn').click();
  await expect(page.locator(EDITOR)).toBeHidden();

  // A changed identity can't rewrite the saved entry (identity is the storage key) — the save
  // ADDS the driver under its new name and keeps the original (the copy outcome, not a move).
  const savedM = await savedModels(page);
  expect(savedM.sort()).toEqual(['Fixture', 'Fixture Mk2']);

  // The project's driver never entered into it.
  expect(await projectDriverName(page)).toBe(beforeProject);
});

test('the picker shows a driver under its new name as soon as the editor closes', async ({ page }) => {
  await openPicker(page);
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  const modelInput = await modelCell(page);
  await modelInput.fill('Renamed Live');
  await page.locator(`${EDITOR} .de-footer button:has-text("OK")`).click();
  await page.locator('.save-confirm-btn').click();
  await page.locator('.save-as-copy-btn').click();

  // The picker is still open behind the editor; its list must not be stale — the renamed save
  // is listed at once, next to the preserved original.
  await expect(page.locator('.my-ditem', { hasText: 'Renamed Live' })).toBeVisible();
  await expect(page.locator('.my-ditem', { hasText: PICKED })).toBeVisible();
});

test('Cancel on a saved driver writes nothing', async ({ page }) => {
  await openPicker(page);
  await page.locator('.my-ditem', { hasText: PICKED }).locator('.my-edit').click();

  const modelInput = await modelCell(page);
  await modelInput.fill('Never Saved');
  await page.locator(`${EDITOR} .de-footer button:has-text("Cancel")`).click();
  await expect(page.locator(EDITOR)).toBeHidden();

  const savedM = await savedModels(page);
  expect(savedM).toEqual(['Fixture']);
});
