/**
 * A Peaking 2nd order highpass with a negative peak gain draws no curve; the engine says why and
 * the Filters list shows what it says (bugs/BUG_20261118_peak-highpass-negative-gain-nan.md, QO951).
 * A user's journey on each shell: open a project file holding a Peak HP filter at -6 dB, 50 Hz, and read
 * the message. The file is how a negative peak gets in: typing it is refused since QO951.c9 (John 18 Nov:
 * 'UI should not allow and maths should do what you said anyway'; T914).
 */
import {writeFileSync} from 'node:fs';
import type {Locator, Page, TestInfo} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {readSampleProject} from '../fixtures/sampleProject.js';

const MESSAGE = /WinISD closes when this filter has a negative peak gain, but a peak gain below 0 dB has no curve to draw, so OpenISD keeps the value and draws no curve for this filter \(here -6 dB at 50 Hz\)\./;

function field(scope: Locator, label: string): Locator {
  return scope.locator('.ui-field').filter({has: scope.page().locator('label').filter({hasText: new RegExp(`^${label}$`)})}).locator('input');
}

/** The sample project with one Peak HP filter at -6 dB, 50 Hz (saved before typing stopped at 0 dB), as a file a person opens. */
function negativePeakProject(testInfo: TestInfo): string {
  const sample = readSampleProject().toString('utf8');
  const withFilter = sample.replace(/"filters": \[\]/, '"filters": [{"id": "00000000-0000-4000-0001-0000000009f1", "type": "peakHighpass", "enabled": true, "fpk": 50, "gainPk": -6}]');
  expect(withFilter, 'the sample project lists its filters as "filters": []').not.toBe(sample);
  const path = testInfo.outputPath('negative-peak-hp.owpr');
  writeFileSync(path, withFilter);
  return path;
}

async function expectNotClipped(page: Page, message: Locator): Promise<void> {
  await expect(message).toBeVisible();
  const box = (await message.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await message.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
}

test('desktop: a file holding a Peak HP filter at -6 dB shows the engine message in the list, and 6 dB does not', async ({page}, testInfo) => {
  await page.goto('/');
  await openAProject(page, negativePeakProject(testInfo));
  await page.locator('.project-nav li', {hasText: 'Filters'}).click();
  const panel = page.locator('.content-panel');
  const message = panel.locator('.filter-issue');
  await expect(message).toHaveText(MESSAGE);
  await expectNotClipped(page, message);
  await panel.locator('.filter-edit-hint').click();
  await expect(field(panel, 'Gpk'), 'the loaded -6 dB is kept, not clamped').toHaveValue('-6.00');
  await fillAndBlur(field(panel, 'Gpk'), '6');
  await expect(message).toHaveCount(0);
  await expect(panel.getByText('WinISD closes when this filter')).toHaveCount(0);
});

test('phone: a file holding a Peak HP filter at -6 dB shows the engine message on its card', async ({appPage: page}, testInfo) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, negativePeakProject(testInfo));
  await page.locator('.mob-tab', {hasText: 'Filters'}).click();
  const card = page.locator('.mob-fcard');
  const message = card.locator('.filter-issue');
  await expect(message).toHaveText(MESSAGE);
  await expectNotClipped(page, message);
  await expect(field(card, 'Gpk'), 'the loaded -6 dB is kept, not clamped').toHaveValue('-6.00');
});
