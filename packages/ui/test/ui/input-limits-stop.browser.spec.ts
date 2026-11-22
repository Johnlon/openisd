/**
 * A value no design can use stops at its box with a note, on each shell (T916,
 * bugs/BUG_20261118_input-limits-sweep.md; QO951, QO953).
 *  - Air pressure, sound velocity and air density (Advanced tab): 0 and -1 are refused; a value above 0
 *    is stored as before, however odd (1000 Pa, 1 kPa, is out of scope and accepted).
 *  - Tuning freq (Frc) of a 6th-order bandpass (Box tab): 0 Hz is refused; 30 Hz is stored.
 * A refused entry stays in its box, red, with a ⚠ whose note says what to enter; nothing is stored, so
 * the chart keeps drawing. A user's actions only: tabs, the box type picker, typing, the ⚠.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, expectChartDrawn, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

type Shell = 'desktop' | 'phone';

async function open(page: Page, shell: Shell): Promise<void> {
  if (shell === 'phone') {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
  } else {
    await page.goto('/');
    await openAProject(page);
  }
}

async function openAdvanced(page: Page, shell: Shell): Promise<void> {
  if (shell === 'phone') {
    await page.locator('.mob-hamburger').click();
    await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
  } else {
    await page.locator('.project-nav li', {hasText: /^Advanced$/}).click();
  }
}

/** The box labelled `label`: its field row on either shell. */
function row(page: Page, shell: Shell, label: string): Locator {
  return shell === 'phone' ? mobileFieldRow(page, label) : page.locator('.field', {hasText: label});
}

async function expectInside(page: Page, el: Locator): Promise<void> {
  await expect(el).toBeVisible();
  const box = (await el.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);
}

/** Types `text`, then checks the box keeps it red with a ⚠ whose note says `note`. */
async function expectRefused(page: Page, field: Locator, text: string, note: RegExp): Promise<void> {
  const input = field.locator('input').first();
  await fillAndBlur(input, text);
  await expect(input).toHaveValue(text);
  await expect(input).toHaveClass(/inp-bad/);
  const mark = field.locator('.ui-field-dq-btn');
  await expect(mark).toHaveAttribute('title', note);
  await mark.click();
  const shown = field.locator('.ui-field-note');
  await expect(shown).toHaveText(note);
  await expectInside(page, shown);
  await mark.click();
  await expect(shown).toHaveCount(0);
}

/** Types `text`, then checks it is stored: no red, no refusal. */
async function expectAccepted(field: Locator, text: string): Promise<void> {
  const input = field.locator('input').first();
  await fillAndBlur(input, text);
  await expect(input).not.toHaveClass(/inp-bad/);
  expect(Number(await input.inputValue())).toBeCloseTo(Number(text), 6);
}

const AIR: readonly {readonly label: string; readonly note: RegExp; readonly odd: string}[] = [
  {label: 'Air pressure', note: /^Air pressure must be greater than 0 — enter a value above 0 Pa\.$/, odd: '1000'},
  {label: 'Sound velocity', note: /^Sound velocity must be greater than 0 — enter a value above 0 m\/s\.$/, odd: '5'},
  {label: 'Air density', note: /^Air density must be greater than 0 — enter a value above 0 kg\/m³\.$/, odd: '0.5'},
];

/** The Box tab's Tuning freq (Frc) box: the desktop Box tab's first one (the Vents pane has another), the phone's row. */
function frcField(page: Page, shell: Shell): Locator {
  return shell === 'phone'
    ? mobileFieldRow(page, 'Frc')
    : page.locator('.field', {has: page.getByRole('textbox', {name: 'Tuning freq (Frc)'}).first()}).first();
}

const FRC_NOTE = /^Tuning freq \(Frc\) must be greater than 0 — enter a value above 0, up to 20000(\.00)? Hz\.$/;

for (const shell of ['desktop', 'phone'] as const) {
  test(`${shell}: air pressure, sound velocity and air density refuse 0 and -1 with a note, and take a value above 0`, async ({page}) => {
    await open(page, shell);
    await openAdvanced(page, shell);
    for (const {label, note, odd} of AIR) {
      const field = row(page, shell, label);
      await expect(field).toBeVisible();
      await expectRefused(page, field, '0', note);
      await expectRefused(page, field, '-1', note);
      await expectAccepted(field, odd);
    }
  });

  test(`${shell}: Frc 0 Hz on a 6th-order bandpass is refused with a note, and 30 Hz is taken`, async ({page}) => {
    await open(page, shell);
    await setFocusedBoxType(page, 'bandpass6');
    const field = frcField(page, shell);
    await expect(field).toBeVisible();
    await expectRefused(page, field, '0', FRC_NOTE);
    await expectAccepted(field, '30');
  });
}

test('desktop: the chart keeps drawing while Frc 0 Hz is refused', async ({page}) => {
  await open(page, 'desktop');
  await setFocusedBoxType(page, 'bandpass6');
  const field = frcField(page, 'desktop');
  await expect(field).toBeVisible();
  await expectRefused(page, field, '0', FRC_NOTE);
  await expectChartDrawn(page);
});
