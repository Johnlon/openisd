/**
 * T744, QO534 (John, 11 Nov 2026: "all get the mark"): a stated Cms that disagrees with the stated Vas (Tang Band W5-1138SMF) is
 * explained, in the driver editor opened inside a project, by one plain sentence naming the boxes that disagree and what the maths
 * gives. The raw names of its inputs (roo_kg_per_m3, c_m_per_s) do not appear. A typed value is kept, and every box in the set is marked.
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, editorTab, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();

test('the Cms popup of W5-1138SMF in the driver editor says the one sentence, in plain names', async ({page}) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.getByRole('button', {name: /^Select driver$/i}).click();
  await page.getByText('Tang Band W5-1138SMF', {exact: true}).click();
  await page.locator('.driver-library .use-btn').click();
  await page.locator('.edit-btn', {hasText: 'Edit'}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();

  const cms = page.locator('.de-modal .de-fld', {has: page.locator('label', {hasText: /^Cms\b/})});
  await cms.locator('.ui-field-dq-btn').first().click();
  const note = cms.locator('.ui-field-note');
  await expect(note).toBeVisible();
  const text = (await note.textContent()) ?? '';
  expect(text).toMatch(/Vas.*Cms.* disagree: .* gives .*, the box says /);
  expect(text).not.toContain('disagree by');
  expect(text).not.toMatch(/roo_kg_per|c_m_per_s|_kg_|_m3|_m2/);
});

async function openW5Parameters(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.getByRole('button', {name: /^Select driver$/i}).click();
  await page.getByText('Tang Band W5-1138SMF', {exact: true}).click();
  await page.locator('.driver-library .use-btn').click();
  await page.locator('.edit-btn', {hasText: 'Edit'}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
}

const fieldOf = (page: import('@playwright/test').Page, label: RegExp) =>
  page.locator('.de-modal .de-fld', {has: page.locator('label', {hasText: label})});

test('a typed Mms is kept; Fs, Mms and Cms all carry the mark, and the popup says what the maths gives', async ({page}) => {
  await openW5Parameters(page);
  const mms = fieldOf(page, /^Mms\b/).locator('input');
  await mms.fill('40.00');
  await mms.blur();
  await expect(mms).toHaveValue('40.00');
  for (const label of [/^Fs\b/, /^Mms\b/, /^Cms\b/]) await expect(fieldOf(page, label).locator('.ui-field-dq-btn')).toHaveCount(1);
  const mmsField = fieldOf(page, /^Mms\b/);
  await mmsField.locator('.ui-field-dq-btn').first().click();
  await expect(mmsField.locator('.ui-field-note')).toContainText(/ disagree: .+ gives .+, the box says /);
});

// QO532 (John, 11 Nov 2026: "not dimmed, just accentuated"; "not like that with the input cell fucked up").
test('the boxes the charts read are accented, the others are not, and no box changes size', async ({page}) => {
  await openW5Parameters(page);
  const accented = await page.locator('.de-modal .ui-field-drives-charts label').allTextContents();
  expect(accented.map(t => t.trim().split(/\s/)[0]).sort()).toEqual(['BL', 'Cms', 'Le', 'Mms', 'Re', 'Rms', 'Sd'].sort());
  const sizes = await page.locator('.de-modal .de-fld input').evaluateAll(inputs => inputs.map(el => {
    const r = el.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height), clipped: el instanceof HTMLInputElement && el.scrollWidth > el.clientWidth,
      accented: el.closest('.ui-field-drives-charts') !== null, weight: getComputedStyle(el).fontWeight, ring: getComputedStyle(el).boxShadow};
  }));
  const plain = sizes.filter(s => !s.accented);
  const ringed = sizes.filter(s => s.accented);
  expect(ringed).toHaveLength(7);
  for (const s of ringed) {
    expect(s.weight, JSON.stringify(s)).toBe('600');
    expect(s.ring).toContain('inset');
    expect(s.clipped).toBe(false);
    expect(plain.some(p => p.w === s.w && p.h === s.h), JSON.stringify(s)).toBe(true);
  }
});

test('on the phone the seven boxes are accented too, bold and not cut, and the Driver tab accents Re', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await expect(page.locator('.ui-field-drives-charts')).toHaveCount(1);
  await expect(page.locator('.ui-field-drives-charts label')).toHaveText(/^Re/);
  await page.getByText('Edit', {exact: true}).click();
  await editorTab(page, 'Parameters');
  await page.setViewportSize({width: 374, height: 2600});
  await page.evaluate(() => document.fonts.ready);
  const ringed = await page.locator('.de-modal .ui-field-drives-charts input').evaluateAll(inputs => inputs.map(el => ({
    value: el instanceof HTMLInputElement ? el.value : '', weight: getComputedStyle(el).fontWeight,
    cut: el.scrollWidth - el.clientWidth,
  })));
  expect(ringed).toHaveLength(7);
  // Only the accented boxes are set tighter; every other box and label keeps the font's own spacing.
  const plainSpacing = await page.locator('.de-modal .de-fld:not(.ui-field-drives-charts) input, .de-modal label').evaluateAll(els => [...new Set(els.map(el => getComputedStyle(el).letterSpacing))]);
  expect(plainSpacing).toEqual(['normal']);
  for (const box of ringed) {
    expect(Number(box.weight), JSON.stringify(box)).toBeGreaterThanOrEqual(600);
    expect(box.cut, JSON.stringify(box)).toBeLessThanOrEqual(0);
  }
});
