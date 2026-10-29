import {expect, openAProject, test} from '../fixtures.js';

/**
 * T522: the Box volume spinner marks the stepped digit on every box type, Closed included
 * (John, 21 Oct 2026: "Not all boxes in the demo support the underline on the spin - Box volume on Closed").
 * The selected inverse cursor marks the digit; the spinner keeps focus for keyboard navigation.
 */
for (const boxType of ['vented', 'sealed'] as const) {
  test(`Box volume ▲ on ${boxType} marks the stepped digit and keeps focus on the spinner`, async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
    await page.locator('select#og-box-type').selectOption(boxType);

    const box = page.locator('#og-box-volume');
    await box.focus();
    await box.fill('20.00');
    await box.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 4); });
    await page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first().click();

    await expect(box).toHaveValue('20.10');
    await expect(page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first()).toBeFocused();
    await expect(box.locator('..').locator('.num-mark-underline')).toHaveText('1');
  });
}

test('Box volume ▲ after typing selects the final digit and preserves its place', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  await page.locator('select#og-box-type').selectOption('sealed');

  const box = page.locator('#og-box-volume');
  await box.fill('20.00');
  await box.blur();
  await page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first().click();

  await expect(box).toHaveValue('20.01');
  await expect(box.locator('..').locator('.num-mark-underline')).toHaveText('1');
  await expect(box.locator('..').locator('.num-mark-pre')).toHaveText('20.0');
});

test('What-if Vb ▲ on a Closed box marks the stepped tenths digit', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  await page.locator('select#og-box-type').selectOption('sealed');
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.locator('.edit-btn', {hasText: 'What-if'}).click();
  const field = page.locator('.what-if-panel .what-if-fld').filter({has: page.locator('label', {hasText: /^Vb$/})});
  const box = field.locator('input');
  const before = Number(await box.inputValue());
  await field.locator('.num-stepper-btn').first().click();
  expect(Number(await box.inputValue())).toBeCloseTo(before + 0.1, 5);
  const marked = await box.evaluate(el => el instanceof HTMLInputElement ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) : null);
  expect(marked).toHaveLength(1);
  expect(await box.evaluate(el => el instanceof HTMLInputElement ? el.selectionStart : null)).toBe((await box.inputValue()).indexOf('.') + 1);
});
