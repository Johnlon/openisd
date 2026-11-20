/**
 * The driver summary shows every field the driver's record holds (John, 20 Nov 2026: "the driver
 * info screen has many known params missing (SB Acoustics SB23NRXS45-4 8" Woofer) sensitivity for
 * instance, many"). Before T938 it showed a fixed 12 Thiele/Small rows plus EBP, on desktop and phone.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const MODEL = 'SB23NRXS45-4';

/** Label on screen → value shown, for fields the SB Acoustics sheet states. */
const STATED: ReadonlyArray<readonly [string, RegExp]> = [
  ['SPL', /^92(\.0+)?$/],
  ['Mms', /^27\.2/],
  ['Cms', /^1\.33/],
  ['Rms', /^0\.80?/],
  ['Hc', /^19(\.0+)?$/],
  ['Hg', /^6(\.0+)?$/],
  ['Voice Coil Dia (Vcd)', /^45\.5/],
  ['Driver Weight (Weight)', /^2\.74/],
];

/** Labels of fields the record holds as calculated. */
const CALCULATED: readonly string[] = ['USPL', 'Vd', 'Dd', 'SPLmax'];

function row(preview: Locator, page: Page, label: string): Locator {
  return preview.locator('.spec-row').filter({has: page.locator('.spec-lbl', {hasText: new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`)})});
}

async function expectEveryField(preview: Locator, page: Page): Promise<void> {
  for (const [label, value] of STATED) {
    const r = row(preview, page, label);
    await expect(r, `${label} is shown`).toHaveCount(1);
    await expect(r.locator('.spec-val b')).toHaveText(value);
    await expect(r).toHaveClass(/\bvalue-e\b/);
  }
  for (const label of CALCULATED) {
    const r = row(preview, page, label);
    await expect(r, `${label} is shown`).toHaveCount(1);
    await expect(r).toHaveClass(/\bvalue-c\b/);
  }
  await expect(row(preview, page, 'Fs')).toHaveClass(/\bvalue-e\b/);
}

test('desktop: the library summary of SB23NRXS45-4 shows sensitivity and every other field it holds', async ({page}) => {
  await page.setViewportSize({width: 1600, height: 1000});
  await page.goto('/');
  await page.locator('[title*="librar" i]').first().click();
  await page.locator('.filter').fill(MODEL);
  await page.locator('.dlist .ditem:not(.my-ditem)').filter({hasText: MODEL}).first().click();
  const preview = page.locator('.driver-library .preview');
  await expect(preview).toBeVisible();
  await expectEveryField(preview, page);
});

test('phone: the new-project summary of SB23NRXS45-4 shows sensitivity and every other field it holds', async ({page}) => {
  await page.setViewportSize({width: 412, height: 915});
  await forceMobileSkin(page);
  await page.goto('/');
  await page.getByText('New project').click();
  await page.locator('.filter').fill(MODEL);
  await page.locator('.dlist .ditem').filter({hasText: MODEL}).first().click();
  const preview = page.locator('.mob-np-library .preview');
  await expect(preview).toBeVisible();
  await expectEveryField(preview, page);
});
