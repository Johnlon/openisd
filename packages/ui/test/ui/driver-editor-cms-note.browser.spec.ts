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
