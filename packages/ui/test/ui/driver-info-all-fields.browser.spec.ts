/**
 * The driver summary shows every field the driver's record holds (John, 20 Nov 2026: "the driver
 * info screen has many known params missing (SB Acoustics SB23NRXS45-4 8" Woofer) sensitivity for
 * instance, many"). Before T938 it showed a fixed 12 Thiele/Small rows plus EBP, on desktop and phone.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {measureSummaryContent} from '../fixtures/fieldVisualContract.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

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
  ['Driver Weight', /^2\.74/],
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

test('phone: the summary rounds long figures and preserves shorter figures', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await forceMobileSkin(page);
  await page.goto('/');
  await page.getByText('New project').click();
  await page.locator('.filter').fill('CX120-8');
  await page.locator('.dlist .ditem').filter({hasText: 'CX120-8'}).first().click();
  const preview = page.locator('.mob-np-library .preview');
  for (const [label, value] of [
    ['Rms', '0.9169'], ['rho', '1.201'], ['c', '343.7'], ['gamma', '1054'], ['Gloss', '1.081'],
    ['Xmax', '3.00'], ['Fs', '87.50'],
  ]) {
    await expect.soft(row(preview, page, label).locator('.spec-val b')).toHaveText(value);
  }
  const labels = await preview.locator('.spec-lbl').evaluateAll(elements => elements.map(element => element.textContent));
  expect(labels).toEqual([...new Set(labels)]);
});

test('phone: the driver library fits the weight, basket and wrapped model alongside the summary actions', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await forceMobileSkin(page);
  await page.goto('/');
  await tapMobileMenuItem(page, 'Manage Drivers');
  await page.locator('.filter').fill('CX120-8');
  await page.locator('.dlist .ditem').filter({hasText: 'CX120-8'}).first().click();
  const preview = page.locator('.driver-library .preview');
  const footer = preview.locator('.prev-footer');
  await page.evaluate(() => document.fonts.ready);
  await expect(footer.getByRole('button', {name: 'Cancel', exact: true})).toBeInViewport({ratio: 1});
  await expect(footer.getByRole('button', {name: 'Use', exact: true})).toBeInViewport({ratio: 1});
  for (const name of [/^Driver Weight$/, /^Basket Diameter$/]) {
    const label = preview.locator('.spec-lbl').filter({hasText: name});
    await expect(label).toHaveCount(1);
    const lines = await label.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    });
    expect.soft(lines, String(name)).toBeLessThanOrEqual(2);
  }
  expect.soft((await preview.evaluate(measureSummaryContent)).issues).toEqual([]);
  const model = preview.locator('.prev-textrow').filter({has: page.getByText('Model', {exact: true})});
  await model.scrollIntoViewIfNeeded();
  await expect(model).toBeInViewport({ratio: 0.99});
  const lineStarts = await model.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element.lastChild!);
    return Array.from(range.getClientRects(), rect => Math.round(rect.left));
  });
  expect(lineStarts.length).toBeGreaterThan(1);
  expect(new Set(lineStarts).size, 'wrapped model lines stay in the value column').toBe(1);
  await expect(footer.getByRole('button', {name: 'Use', exact: true})).toBeInViewport({ratio: 1});
});
