import {editorTab, expect, openAProject, test} from '../fixtures.js';

// These editor-semantics tests run on the clean synthetic driver, not the scraped W5 sample:
// W5's scraped T/S is internally inconsistent (manufacturer-ballpark values), so its editor
// always carries a "those values disagree because … imply …" strip. That noise is exactly what
// these assertions must not depend on — a test that wants the W5 sample opens it itself.
import {COMPLETE_DRIVER_PROJECT_OWPR, SAMPLE_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page, COMPLETE);
});

test('brand and model fields are mandatory, have bold borders, and turn red when empty without losing focus', async ({ page }) => {
  // 1. Open the project driver editor
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();

  // Brand and Model live on the General pane, and the editor opens on Parameters by design, so
  // the cells do not exist until this switch (ui-bugfix.md testing creed).
  await editorTab(page, 'General');

  // 2. Locate the brand and model input elements
  const brandInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Brand' }) }).locator('input');
  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');

  // 3. Verify they have the mandatory class indicating they are mandatory and should have bold borders always
  await expect(brandInput).toHaveClass(/de-input-mandatory/);
  await expect(modelInput).toHaveClass(/de-input-mandatory/);

  // 4. Brand empty check (and verifying focus is kept)
  await brandInput.focus();
  await expect(brandInput).toBeFocused();
  await brandInput.fill('');
  // Verify it turns red / has empty validation class without losing focus
  await expect(brandInput).toHaveClass(/de-input-empty/);
  await expect(brandInput).toBeFocused();

  // 5. Model empty check (and verifying focus is kept)
  await modelInput.focus();
  await expect(modelInput).toBeFocused();
  await modelInput.fill('');
  // Verify it turns red / has empty validation class without losing focus
  await expect(modelInput).toHaveClass(/de-input-empty/);
  await expect(modelInput).toBeFocused();

  // 6. Switch to Parameters tab to verify Fs, Vas, Re, and Sd
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();

  const fsInput = page.locator('.de-fld', { has: page.locator('label', { hasText: /^Fs\b/ }) }).locator('input');
  const vasInput = page.locator('.de-fld', { has: page.locator('label', { hasText: /^Vas\b/ }) }).locator('input');
  const reInput = page.locator('.de-fld', { has: page.locator('label', { hasText: /^Re\b/ }) }).locator('input');
  const sdInput = page.locator('.de-fld', { has: page.locator('label', { hasText: /^Sd\b/ }) }).locator('input');

  // Verify parameters have bold border class
  await expect(fsInput).toHaveClass(/de-input-mandatory/);
  await expect(vasInput).toHaveClass(/de-input-mandatory/);
  await expect(reInput).toHaveClass(/de-input-mandatory/);
  await expect(sdInput).toHaveClass(/de-input-mandatory/);

  // Fs empty check without losing focus
  await fsInput.focus();
  await expect(fsInput).toBeFocused();
  await fsInput.fill('');
  await expect(fsInput).toHaveClass(/de-input-empty/);
  await expect(fsInput).toBeFocused();

  // Vas empty check without losing focus
  await vasInput.focus();
  await expect(vasInput).toBeFocused();
  await vasInput.fill('');
  await expect(vasInput).toHaveClass(/de-input-empty/);
  await expect(vasInput).toBeFocused();

  // Re empty check without losing focus
  await reInput.focus();
  await expect(reInput).toBeFocused();
  await reInput.fill('');
  await expect(reInput).toHaveClass(/de-input-empty/);
  await expect(reInput).toBeFocused();

  // Sd empty check without losing focus
  await sdInput.focus();
  await expect(sdInput).toBeFocused();
  await sdInput.fill('');
  await expect(sdInput).toHaveClass(/de-input-empty/);
  await expect(sdInput).toBeFocused();
});

/**
 * BUG_20260924: the Model input used to read sku, not model, whenever a sku was present, so
 * clearing Model showed the sku instead of going empty. The W5 sample has a sku, so it is the
 * one that exercises this.
 */
test('a sku-bearing driver: clearing Model empties it and sku is untouched', async ({ page }) => {
  await page.goto('/');
  await openAProject(page, SAMPLE_PROJECT_OWPR);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await editorTab(page, 'General');

  const modelInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Model' }) }).locator('input');
  const skuInput = page.locator('.de-fld', { has: page.locator('label', { hasText: 'Part Number' }) }).locator('input');

  await expect(skuInput).not.toHaveValue('');    // the W5 sample carries a sku
  const skuBefore = await skuInput.inputValue();

  await modelInput.fill('');
  await expect(modelInput).toHaveValue('');
  await expect(modelInput).toHaveClass(/de-input-empty/);
  await expect(skuInput).toHaveValue(skuBefore);    // untouched, no re-fill from sku
});

// ── Incomplete drivers are SAVEABLE; only Brand+Model gate ────────────────────────────
// Human ruling 2026-08-05: "all the buttons on driver editor need to work regardless of
// driver — only brand and model are 100% required as they are the index key. So gate the
// save or copy to my drivers or OK buttons on those two fields and if clicked then popup a
// message saying Brand and Model are both required."
//
// So: nothing is ever DISABLED. OK/Save/Copy answer the click — either they act, or they
// say why not. Missing T/S is a data-quality state that only stops the CHARTS.

async function openParameters(page: import('@playwright/test').Page) {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await editorTab(page, 'Parameters');
}
function field(page: import('@playwright/test').Page, label: string) {
  return page.locator('.de-fld', { has: page.locator('label', { hasText: new RegExp(`^${label}\\b`) }) })
             .locator('input').first();
}
const okBtn   = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-footer button:has-text("OK")');
const saveBtn = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-footer button:has-text("Save")');
const copyBtn = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-footer button:has-text("Copy to My Drivers")');

test('OK, Save and Copy stay live on an incomplete driver, and it commits', async ({ page }) => {
  await openParameters(page);
  for (const f of ['Fs', 'Vas', 'Re', 'Sd', 'Qts', 'Qes', 'Qms']) await field(page, f).fill('');
  await field(page, 'Qms').blur();

  await expect(okBtn(page)).toBeEnabled();
  await expect(saveBtn(page)).toBeEnabled();
  await expect(copyBtn(page)).toBeEnabled();

  await okBtn(page).click();
  await expect(page.locator('.de-modal')).toHaveCount(0);   // it really did commit and close
});

// Brand + Model is the index key — the pair My Drivers, the project and the saved filename
// all look the driver up by — so it is the ONE thing the filing actions insist on.
const brandInputOf = (page: import('@playwright/test').Page) => page.locator('.de-modal .de-brand');

test('a missing Brand pops a message instead of a dead button, and lands the caret on it', async ({ page }) => {
  await openParameters(page);
  await editorTab(page, 'General');          // Brand only exists on this pane
  await brandInputOf(page).fill('');

  await expect(okBtn(page)).toBeEnabled();          // never disabled — it answers the click
  await okBtn(page).click();
  await expect(page.getByText('Brand and Model are both required')).toBeVisible();
  await expect(page.locator('.de-modal')).toBeVisible();   // nothing was committed

  await page.getByRole('button', { name: 'Fill them in' }).click();
  await expect(brandInputOf(page)).toBeFocused();

  await brandInputOf(page).fill('Acme');
  await okBtn(page).click();
  await expect(page.locator('.de-modal')).toHaveCount(0);  // now it commits
});

test('Copy to My Drivers and Save are gated the same way', async ({ page }) => {
  await openParameters(page);
  await editorTab(page, 'General');
  await brandInputOf(page).fill('');

  await copyBtn(page).click();
  await expect(page.getByText('Brand and Model are both required')).toBeVisible();
  await page.getByRole('button', { name: 'Fill them in' }).click();

  await saveBtn(page).click();
  await expect(page.getByText('Brand and Model are both required')).toBeVisible();
});

/**
 * The incompleteness panel is THREE strips, and the separation is the point: a missing Brand
 * stops the driver being FILED under a name and changes no curve; a missing Fs blanks every
 * chart and has nothing to do with filing; stated values that disagree with each other do
 * neither, because all of them are present and every chart plots from them as stated.
 * Collapsing them into one list would tell the user their charts are blank because they have
 * not typed a brand name, or because two stated numbers disagree.
 *
 * No strip blocks anything — the driver still saves, which is what "Saves fine…" promises.
 */
test('a missing Brand raises the IDENTITY strip only, and blanks no chart', async ({ page }) => {
  await openParameters(page);
  await editorTab(page, 'General');
  await brandInputOf(page).fill('');
  await brandInputOf(page).blur();

  const identity = page.locator('.de-incomplete', { hasText: 'filed under a name' });
  await expect(identity).toBeVisible();
  await expect(identity).toContainText('Brand is not set');

  // The clean fixture driver has its T/S values, so nothing blanks a chart. If this strip
  // appears here, the two lists have been merged and a naming problem is being reported as a
  // physics one.
  await expect(page.locator('.de-incomplete', { hasText: 'charts stay blank' })).toHaveCount(0);

  await expect(okBtn(page)).toBeEnabled();       // "Saves fine, but..." — it must still save
  await expect(saveBtn(page)).toBeEnabled();
});

test('a missing Fs raises the CHART strip only, and the driver can still be filed', async ({ page }) => {
  await openParameters(page);
  await field(page, 'Fs').fill('');
  await field(page, 'Fs').blur();

  const charts = page.locator('.de-incomplete', { hasText: 'charts stay blank' });
  await expect(charts).toBeVisible();
  await expect(charts).toContainText('Fs');

  // Brand and Model are untouched, so the driver still has a name to be filed under.
  await expect(page.locator('.de-incomplete', { hasText: 'filed under a name' })).toHaveCount(0);
});

/**
 * BUG_20260924: the scraped W5 driver states Qts, Qes, Qms, Fs, Mms and Cms, and the stated
 * numbers contradict each other. Every one of them is present, so no chart is blank — the
 * editor must say they disagree, and must not claim the charts are blank.
 */
test('stated values that disagree raise the CONSISTENCY strip, and no chart strip', async ({ page }) => {
  await page.goto('/');
  await openAProject(page, SAMPLE_PROJECT_OWPR);
  await openParameters(page);

  const disagree = page.locator('.de-incomplete', { hasText: 'those values disagree' });
  await expect(disagree).toBeVisible();
  await expect(disagree).toContainText('the others imply');

  await expect(page.locator('.de-incomplete', { hasText: 'charts stay blank' })).toHaveCount(0);
  await expect(okBtn(page)).toBeEnabled();       // "Saves fine…" — it must still save
});

/**
 * The heading states a CAUSE, and each item under it is a present-tense fact — "Brand is not
 * set". "until:" would read as "blocked until it stays unset", which is the opposite of what
 * is meant, so the connective has to be "because".
 */
test('each strip says BECAUSE, matching the present-tense facts it lists', async ({ page }) => {
  await openParameters(page);
  await editorTab(page, 'General');
  await brandInputOf(page).fill('');
  await editorTab(page, 'Parameters');       // Fs is a Parameters cell, Brand was a General one
  await field(page, 'Fs').fill('');
  await field(page, 'Fs').blur();

  for (const heading of await page.locator('.de-incomplete-hd').allTextContents()) {
    expect(heading, `"${heading}" must state a cause, not a future condition`).toContain('because');
    expect(heading, `"${heading}" still says "until" over a list of present-tense facts`)
      .not.toContain('until');
  }
});

test('an incomplete driver is flagged in the editor, naming what is missing', async ({ page }) => {
  await openParameters(page);
  const warn = page.locator('.de-incomplete');
  await expect(warn).toHaveCount(0);                        // the clean fixture driver is complete

  await field(page, 'Fs').fill('');
  await field(page, 'Fs').blur();
  await expect(warn).toBeVisible();
  await expect(warn).toContainText('Fs');
});

test('two of Qts/Qes/Qms are needed to simulate — the trio is flagged as a GROUP', async ({ page }) => {
  await openParameters(page);
  await field(page, 'Qts').fill('');
  await field(page, 'Qes').fill('');
  await field(page, 'Qms').blur();
  // No single Q is mandatory, so the warning names the trio, not one field.
  await expect(page.locator('.de-incomplete')).toContainText('Qts');
  await expect(okBtn(page)).toBeEnabled();
});

test('an entered zero for Fs is out of range — red on the field, reverted on blur (QO11.5)', async ({ page }) => {
  await openParameters(page);
  const fs = field(page, 'Fs');
  const good = await fs.inputValue();

  // Fs has a min of 1. Type the zero with keystrokes so the caret-safe raw-echo path runs
  // (the path fill() never exercises): the field says OUT OF RANGE while the model keeps the
  // last good value, and blur re-commits that value. Zero is thereby neither blanked nor
  // accepted — it is rejected in the open, which is what red-while-typing means.
  await fs.click();
  await fs.press('Control+a');
  await fs.pressSequentially('0');
  await expect(fs).toHaveValue('0');
  await expect(fs).toHaveClass(/inp-bad/);
  await expect(fs).toBeFocused();

  await fs.blur();
  await expect(fs).toHaveValue(good);                    // reverted to the last good value
  await expect(fs).not.toHaveClass(/inp-bad/);
  await expect(okBtn(page)).toBeEnabled();               // still saveable
});

test('every Parameters input reports its E/C/N state', async ({ page }) => {
  await openParameters(page);
  const unstyled = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('.de-params .de-fld').forEach(f => {
      const i = f.querySelector('input');
      // The provenance classes are value-e / value-c / value-n (DriverEditorModal.vue's styles);
      // st-[ecn] was their old name and matched nothing, so every input read as unstyled.
      if (i && !/\bvalue-[ecn]\b/.test(i.className)) out.push(f.querySelector('label')?.textContent?.trim() ?? '?');
    });
    return out;
  });
  expect(unstyled).toEqual([]);
});
