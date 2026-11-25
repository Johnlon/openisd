import {expect, openAProject, test} from '../fixtures.js';
import {OLD_BASKET_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import {readSampleProject} from '../fixtures/sampleProject.js';
import {writeFileSync} from 'node:fs';
import {enterText, openScreen, openSweepProject} from '../fixtures/dependentValues.js';
import {openISDProjectSessionJsonSchema} from '../../../design/domain/openisdSchema.js';

function sampleSession() {
  const raw: unknown = JSON.parse(readSampleProject().toString('utf8'));
  return openISDProjectSessionJsonSchema.parse(raw);
}

test('desktop problems footer opens and closes the list', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const footer = page.getByRole('button', {name: /tracked problems?/});
  await expect(footer).toBeVisible();
  await footer.click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  await expect(list).toBeVisible();
  await expect(list.getByText('Some project warnings may not yet appear in this list.')).toBeVisible();
  await list.getByRole('button', {name: 'Close project problems'}).click();
  await expect(list).toBeHidden();
});

test('desktop problem opens the driver editor at the affected dimensions field', async ({page}) => {
  await page.goto('/');
  await openAProject(page, OLD_BASKET_PROJECT_OWPR);
  await page.getByRole('button', {name: /tracked problems?/}).click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const problem = list.locator('li').filter({hasText: /basket/i}).first();
  await expect(problem).toBeVisible();
  await problem.getByRole('button', {name: 'Go to'}).click();
  const editor = page.locator('.de-modal');
  await expect(editor).toBeVisible();
  await expect(editor.locator('[data-de-tab="Dimensions"]')).toBeVisible();
  await expect(editor.locator('[data-field-key="Basket_m"] input')).toBeFocused();
});

test('desktop problems list goes to an air warning and updates when it is fixed', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: /^Advanced$/}).click();
  const temperature = page.locator('#og-air-temperature');
  await temperature.fill('410');
  await temperature.press('Tab');
  await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  await page.getByRole('button', {name: /tracked problems?/}).click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const problem = list.locator('li').filter({hasText: /temperature/i}).first();
  await expect(problem).toBeVisible();
  await problem.getByRole('button', {name: 'Go to'}).click();
  await expect(temperature).toBeFocused();
  await temperature.fill('293.15');
  await temperature.press('Tab');
  await page.getByRole('button', {name: /tracked problems?/}).click();
  await expect(list.locator('li').filter({hasText: /temperature/i})).toHaveCount(0);
});

test('desktop problems list opens the filter with an invalid loaded setting', async ({page}, testInfo) => {
  const sample = readSampleProject().toString('utf8');
  const withFilter = sample.replace(/"filters": \[\]/, '"filters": [{"id": "00000000-0000-4000-0001-0000000009f1", "type": "peakHighpass", "enabled": true, "fpk": 50, "gainPk": -6}]');
  expect(withFilter).not.toBe(sample);
  const path = testInfo.outputPath('negative-filter.owpr');
  writeFileSync(path, withFilter);
  await page.goto('/');
  await openAProject(page, path);
  await page.getByRole('button', {name: /tracked problems?/}).click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const problem = list.locator('li').filter({hasText: /negative peak gain/i}).first();
  await expect(problem).toBeVisible();
  await problem.getByRole('button', {name: 'Go to'}).click();
  await expect(page.locator('.filter-edit-body')).toBeVisible();
  await expect(page.locator('.filter-edit-body input').first()).toBeFocused();
});

test('desktop radiator warning navigates to the radiator count', async ({page}) => {
  await openSweepProject(page, 'desktop', 'box-passive-radiator');
  await openScreen(page, 'desktop', {name: 'Signal', tab: /^Signal$/});
  await enterText(page.locator('[data-field="signal_Pin_W"] input:visible').first(), '1000');
  await page.getByRole('button', {name: /tracked problems?/}).click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const problem = list.locator('li').filter({hasText: /exceeds Xmax/i}).first();
  await expect(problem).toBeVisible();
  await problem.getByRole('button', {name: 'Go to'}).click();
  await expect(page.locator('#og-pr-count')).toBeFocused();
});

test('desktop problem opens the radiator editor at the affected figure', async ({page}, testInfo) => {
  const sample = sampleSession();
  sample.saved.box.boxType = 'box-passive-radiator';
  sample.saved.box.passiveRadiator.volume_m3 = 0.01;
  sample.saved.box.passiveRadiator.component.specs['passive-radiator'].Mms_kg = {state: 'E', value: 0.1};
  const path = testInfo.outputPath('radiator-disagreement.owpr');
  writeFileSync(path, JSON.stringify(sample));
  await page.goto('/');
  await openAProject(page, path);
  await page.getByRole('button', {name: /tracked problems?/}).click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const problem = list.locator('li').filter({hasText: /resonance.*moving mass.*compliance.*disagree/i}).last();
  await expect(problem).toBeVisible();
  await problem.getByRole('button', {name: 'Go to'}).click();
  await expect(page.locator('.prd-scrim')).toBeVisible();
  await expect(page.locator('.prd-scrim input:focus')).toBeVisible();
});

test('desktop vent problem navigates to the affected vent field', async ({page}, testInfo) => {
  const sample = sampleSession();
  sample.saved.box.vented.vent.diameter_m = {state: 'E', value: 0};
  const path = testInfo.outputPath('zero-vent-diameter.owpr');
  writeFileSync(path, JSON.stringify(sample));
  await page.goto('/');
  await openAProject(page, path);
  await page.getByRole('button', {name: /tracked problems?/}).click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const problem = list.locator('li').filter({hasText: /vent length cannot be calculated/i}).first();
  await expect(problem).toBeVisible();
  await problem.getByRole('button', {name: 'Go to'}).click();
  await expect(page.locator('#og-vent-length')).toBeFocused();
});

// Loading currently replaces Ql=0 before the warning can be shown.
test.fail('desktop box-loss problem opens the relevant loss setting', async ({page}, testInfo) => {
  const sample = sampleSession();
  sample.saved.box.boxType = 'sealed';
  sample.saved.box.sealed.volume_m3 = 0.01;
  sample.saved.box.sealed.losses.Ql = 0;
  const path = testInfo.outputPath('zero-box-leakage.owpr');
  writeFileSync(path, JSON.stringify(sample));
  await page.goto('/');
  await openAProject(page, path);
  await page.getByRole('button', {name: /tracked problems?/}).click();
  const list = page.getByRole('dialog', {name: 'Project problems'});
  const problem = list.locator('li').filter({hasText: /leakage.*(greater|zero)/i}).first();
  await expect(problem).toBeVisible();
  await problem.getByRole('button', {name: 'Go to'}).click();
  await expect(page.locator('#og-losses-whole-ql')).toBeFocused();
});
