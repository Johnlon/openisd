/**
 * T744: a stated Cms that disagrees with the stated Vas (Tang Band W5-1138SMF) is explained, in the driver editor opened
 * inside a project, by the one plain sentence the passive-radiator editor also shows. The old generic
 * "disagree by N%" text and the raw names of its inputs (roo_kg_per_m3, c_m_per_s) do not appear on Cms.
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAProject, test} from '../fixtures.js';
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
  expect(text).toMatch(/The stated Cms and Vas disagree, so the charts use Cms from Vas \([\d.]+ mm\/N\)\./);
  expect(text).not.toContain('disagree by');
  expect(text).not.toMatch(/roo_kg_per|c_m_per_s|_kg_|_m3|_m2/);
});

// QO530 (John, 10 Nov 2026): a value you type never moves; a stated Vas that then disagrees carries the one-sentence warning.
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

test('a typed Mms leaves Fs and Vas as stated, and the Vas popup says the charts use Fs and Mms', async ({page}) => {
  await openW5Parameters(page);
  const mms = fieldOf(page, /^Mms\b/).locator('input');
  await mms.fill('40.00');
  await mms.blur();
  const vas = fieldOf(page, /^Vas\b/);
  await vas.locator('.ui-field-dq-btn').first().click();
  await expect(vas.locator('.ui-field-note')).toHaveText(/Vas disagrees with Fs and Mms, so the charts use Fs and Mms\./);
});

test('a typed Cms leaves Vas as stated, and the Vas popup says the charts use your Cms', async ({page}) => {
  await openW5Parameters(page);
  const cms = fieldOf(page, /^Cms\b/).locator('input');
  await cms.fill('0.5000');
  await cms.blur();
  const vas = fieldOf(page, /^Vas\b/);
  await vas.locator('.ui-field-dq-btn').first().click();
  await expect(vas.locator('.ui-field-note')).toHaveText(/Vas disagrees with your Cms, so the charts use your Cms\./);
});
