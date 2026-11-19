/**
 * The Advanced tab's air boxes on each shell (T924; John, 18 Nov 2026, QO953.c14 "Agree: refuse
 * impossible, warn odd"; c28, c30, c31 for a loaded value).
 *  - Typed impossible: relative humidity above 100 % or below 0 %, and a temperature at or below 0 K,
 *    are refused: the box goes red with a note saying what to enter, and nothing is stored.
 *  - Typed odd: an air pressure of 5000 Pa or a temperature of 400 K is kept and used, and the box
 *    carries a ⚠ warning that names the normal band.
 *  - Opened: a project file holding an air pressure of 0 Pa, a humidity of 150 % and a sound velocity
 *    of 0 m/s opens with each box showing the app's or the calculated value, no ⚠ on any air box, the
 *    opening message naming each repair, and the chart drawn.
 * A user's actions only: opening a file, tabs, typing, the ⚠.
 */
import {writeFileSync} from 'node:fs';
import type {Locator, Page, TestInfo} from '@playwright/test';
import {expect, expectChartDrawn, openAMobileProject, openAProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {readSampleProject, SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';

type Shell = 'desktop' | 'phone';

const HUMIDITY_NOTE_ABOVE = /^Relative humidity is above its maximum — enter a value between 0(\.00)? and 100(\.00)? %\.$/;
const HUMIDITY_NOTE_BELOW = /^Relative humidity is below its minimum — enter a value between 0(\.00)? and 100(\.00)? %\.$/;
const TEMPERATURE_NOTE = /^Temperature must be greater than 0 — enter a value above 0 K\.$/;
/** A band warning conflicts with nothing, so its ⚠ says only the warning, with no conflict prefix. */
const PRESSURE_WARNING = 'Air pressure 5000 Pa is outside the sane range for air (30000 Pa to 110000 Pa). It is kept and used; check it.';
const TEMPERATURE_WARNING = 'Temperature 400.00 K is outside the sane range for air (174.00 K to 373.00 K). It is kept and used; check it.';
/** In the order the boxes stand on the Advanced tab. */
const REPAIR_LINES = [
  "Relative humidity 150 % in the file: emptied, so the box shows the app's humidity (Options)",
  "Air pressure 0 Pa in the file: emptied, so the box shows the app's pressure (Options)",
  'Sound velocity 0 m/s in the file: emptied, so the box shows the value worked out from the temperature, humidity and pressure',
];

/** The sample project with its air pressure 0 Pa, humidity 150 % and sound velocity 0 m/s, as a file a person opens. */
function impossibleAirProject(testInfo: TestInfo): string {
  const sample = readSampleProject().toString('utf8');
  // Only the project's own air: the embedded driver record has a c_m_per_s of its own, earlier in the file.
  const at = sample.indexOf('"environment": {');
  expect(at, 'the sample project has an environment block').toBeGreaterThan(0);
  const broken = sample.slice(0, at) + sample.slice(at)
    .replace(/("pressure_Pa": \{\s*"state": )"[EC]",(\s*"value": )[-\d.e]+/, '$1"E",$20')
    .replace(/("humidity_pct": \{\s*"state": )"[EC]",(\s*"value": )[-\d.e]+/, '$1"E",$2150')
    .replace(/("c_m_per_s": \{\s*"state": )"[EC]",(\s*"value": )[-\d.e]+/, '$1"E",$20');
  expect(broken, 'the sample project states its pressure').toMatch(/"pressure_Pa": \{\s*"state": "E",\s*"value": 0\b/);
  expect(broken, 'the sample project states its sound velocity').toMatch(/"c_m_per_s": \{\s*"state": "E",\s*"value": 0\b/);
  expect(broken, 'the sample project states its humidity').toMatch(/"humidity_pct": \{\s*"state": "E",\s*"value": 150/);
  const path = testInfo.outputPath('impossible-air.owpr');
  writeFileSync(path, broken);
  return path;
}

async function open(page: Page, shell: Shell, file: string): Promise<void> {
  if (shell === 'phone') {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, file);
  } else {
    await page.goto('/');
    await openAProject(page, file);
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

/** The message shown when a project opens: the toast on the desktop, the message strip on the phone. */
function openingMessage(page: Page, shell: Shell): Locator {
  return shell === 'phone' ? page.getByTestId('flash-strip') : page.locator('.flash');
}

/** The air box labelled `label` on the Advanced tab. */
function row(page: Page, shell: Shell, label: string): Locator {
  return shell === 'phone' ? mobileFieldRow(page, label) : page.locator('.tab-section.active .field', {hasText: label});
}

async function expectInside(page: Page, el: Locator): Promise<void> {
  await expect(el).toBeVisible();
  const box = (await el.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  expect(await el.evaluate(e => e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1)).toBe(true);
}

/** Types `text`; the box stays red with the ⚠ note `note`, shown whole, and nothing is stored. */
async function expectRefused(page: Page, field: Locator, text: string, note: RegExp, picture: string): Promise<void> {
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
  await page.screenshot({path: picture});
  await mark.click();
  await expect(shown).toHaveCount(0);
  await input.focus();
  await input.press('Escape');
  await expect(input).not.toHaveClass(/inp-bad/);
}

/** Types `text`; it is stored and the box carries the ⚠ warning `warning`, shown whole in an amber
 *  note. The box is amber (`dq-warn`), never red: red is a refusal (`inp-bad`) or a conflict (`dq-flag`). */
async function expectWarned(page: Page, field: Locator, text: string, warning: string, picture: string): Promise<void> {
  const input = field.locator('input').first();
  await fillAndBlur(input, text);
  await expect(input).not.toHaveClass(/inp-bad/);
  expect(Number(await input.inputValue())).toBeCloseTo(Number(text), 6);
  await expect(input).toHaveClass(/dq-warn/);
  await expect(input).not.toHaveClass(/dq-flag/);
  await expect(input).toHaveCSS('border-top-color', 'rgb(184, 121, 15)');   // --acc2, the amber of the ⚠
  const mark = field.locator('.ui-field-dq-btn');
  await expect(mark).toHaveAttribute('title', warning);
  await mark.click();
  const shown = field.locator('.ui-field-note');
  await expect(shown).toHaveText(warning);
  await expect(shown).toHaveClass(/ui-field-note-warning/);
  await expectInside(page, shown);
  await page.screenshot({path: picture});
  await mark.click();
  await expect(shown).toHaveCount(0);
}

for (const shell of ['desktop', 'phone'] as const) {
  test(`${shell}: humidity above 100 % or below 0 %, and a temperature of 0 K or below, are refused with a note`, async ({page}, testInfo) => {
    await open(page, shell, SAMPLE_PROJECT_OWPR);
    await expect(openingMessage(page, shell)).toBeHidden();
    await openAdvanced(page, shell);
    const humidity = row(page, shell, 'Relative humidity');
    await expect(humidity).toBeVisible();
    const before = await humidity.locator('input').first().inputValue();
    await expectRefused(page, humidity, '101', HUMIDITY_NOTE_ABOVE, testInfo.outputPath(`${shell}-humidity-101-refused.png`));
    await expectRefused(page, humidity, '-5', HUMIDITY_NOTE_BELOW, testInfo.outputPath(`${shell}-humidity-minus5-refused.png`));
    await expect(humidity.locator('input').first(), 'nothing was stored').toHaveValue(before);
    const temperature = row(page, shell, 'Temperature');
    await expectRefused(page, temperature, '0', TEMPERATURE_NOTE, testInfo.outputPath(`${shell}-temperature-0K-refused.png`));
  });

  test(`${shell}: an air pressure of 5000 Pa and a temperature of 400 K are kept with a warning naming the normal band`, async ({page}, testInfo) => {
    await open(page, shell, SAMPLE_PROJECT_OWPR);
    await expect(openingMessage(page, shell)).toBeHidden();
    await openAdvanced(page, shell);
    await expectWarned(page, row(page, shell, 'Air pressure'), '5000', PRESSURE_WARNING, testInfo.outputPath(`${shell}-pressure-5000-warned.png`));
    await expectWarned(page, row(page, shell, 'Temperature'), '400', TEMPERATURE_WARNING, testInfo.outputPath(`${shell}-temperature-400K-warned.png`));
  });

  test(`${shell}: a project file with air pressure 0, humidity 150 % and sound velocity 0 opens repaired, unmarked, the repairs named`, async ({page}, testInfo) => {
    await open(page, shell, impossibleAirProject(testInfo));
    const message = openingMessage(page, shell);
    await expect(message).toHaveText(`Project imported from impossible-air.owpr\n${REPAIR_LINES.join('\n')}`, {useInnerText: true});
    await expectInside(page, message);
    await page.screenshot({path: testInfo.outputPath(`${shell}-opened-impossible-air-message.png`)});
    await expect(message).toBeHidden();
    await openAdvanced(page, shell);
    for (const label of ['Temperature', 'Relative humidity', 'Air pressure', 'Sound velocity', 'Air density']) {
      const field = row(page, shell, label);
      const input = field.locator('input').first();
      await expect(input).not.toHaveValue('');
      expect(Number(await input.inputValue()), label).toBeGreaterThan(0);
      await expect(field.locator('.ui-field-dq-btn'), `${label}: no ⚠ on a repaired value`).toHaveCount(0);
    }
    await page.screenshot({path: testInfo.outputPath(`${shell}-opened-impossible-air-advanced.png`)});
  });
}

test('desktop: a project file with impossible air draws its chart', async ({page}, testInfo) => {
  await open(page, 'desktop', impossibleAirProject(testInfo));
  await expect(page.locator('.flash')).toContainText('emptied, so the box shows');
  await expectChartDrawn(page);
});
