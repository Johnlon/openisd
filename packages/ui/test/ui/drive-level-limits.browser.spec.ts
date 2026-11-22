/**
 * The Signal tab's drive level on each shell (T918, QO953.c21).
 *  - Typed: 0 and -6 in the Driver input voltage box are refused: the box goes red with a note naming
 *    the 10 mV minimum, nothing is stored (the System input power box keeps its value) and the chart
 *    keeps drawing.
 *  - Opened (QO972, 21 Nov 2026): a project file holding -6 V opens with the box showing -6, exactly as
 *    the file states it, with a data-quality mark and no repair message; the chart still draws.
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

const VOLTS_NOTE = /^Driver input voltage \(each\) is below its minimum — enter a value between 0\.01 and 1000(\.00)? V\. The drive level must be at least 10 mV\.$/;

/** The sample project with its drive level set to an entered -6 V, as a file a person opens. */
function minusSixVoltProject(testInfo: TestInfo): string {
  const sample = readSampleProject().toString('utf8');
  const minusSix = sample.replace(/"signal": \{[\s\S]*?\n {4}\},/, '"signal": {"voltage_V": {"state": "E", "value": -6}},');
  expect(minusSix, 'the sample project states its signal block').not.toBe(sample);
  const path = testInfo.outputPath('minus-six-volts.owpr');
  writeFileSync(path, minusSix);
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

async function openSignal(page: Page, shell: Shell): Promise<void> {
  if (shell === 'phone') await page.locator('.mob-tab', {hasText: 'Signal'}).click();
  else await page.locator('.project-nav li', {hasText: /^Signal$/}).click();
}

/** The message shown when a project opens: the toast on the desktop, the message strip on the phone. */
function openingMessage(page: Page, shell: Shell): Locator {
  return shell === 'phone' ? page.getByTestId('flash-strip') : page.locator('.flash');
}

/** The box labelled `desktop` on the desktop and `phone` on the phone. */
function row(page: Page, shell: Shell, desktop: string, phone: string): Locator {
  return shell === 'phone' ? mobileFieldRow(page, phone) : page.locator('.field', {hasText: desktop});
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

for (const shell of ['desktop', 'phone'] as const) {
  test(`${shell}: 0 and -6 V typed into Driver input voltage are refused with a note naming 10 mV, and the power keeps its value`, async ({page}, testInfo) => {
    await open(page, shell, SAMPLE_PROJECT_OWPR);
    await openSignal(page, shell);
    const volts = row(page, shell, 'Driver input voltage', 'Volts');
    const power = row(page, shell, 'System input power', 'Power').locator('input').first();
    await expect(volts).toBeVisible();
    const powerBefore = await power.inputValue();
    for (const text of ['0', '-6']) {
      const input = volts.locator('input').first();
      await fillAndBlur(input, text);
      await expect(input).toHaveValue(text);
      await expect(input).toHaveClass(/inp-bad/);
      const mark = volts.locator('.ui-field-dq-btn');
      await expect(mark).toHaveAttribute('title', VOLTS_NOTE);
      await mark.click();
      const note = volts.locator('.ui-field-note');
      await expect(note).toHaveText(VOLTS_NOTE);
      await expectInside(page, note);
      await page.screenshot({path: testInfo.outputPath(`${shell}-typed-${text}-refused.png`)});
      await mark.click();
      await expect(note).toHaveCount(0);
      await expect(power, 'nothing was stored: the power box keeps its value').toHaveValue(powerBefore);
    }
  });

  test(`${shell}: a project file holding -6 V opens showing -6 V with a data-quality mark and no repair message`, async ({page}, testInfo) => {
    await open(page, shell, minusSixVoltProject(testInfo));
    await expect(openingMessage(page, shell)).not.toContainText('set to the 10 mV minimum');
    await openSignal(page, shell);
    const volts = row(page, shell, 'Driver input voltage', 'Volts');
    await expect(volts.locator('input').first()).toHaveValue('-6');
    await expect(volts.locator('.ui-field-dq-btn')).toHaveCount(1);
    await page.screenshot({path: testInfo.outputPath(`${shell}-opened-minus-six-volts-signal.png`)});
  });

  test(`${shell}: with -6 V loaded the System input power is shown whole in its box, never cut`, async ({page}, testInfo) => {
    await open(page, shell, minusSixVoltProject(testInfo));
    await openSignal(page, shell);
    const power = row(page, shell, 'System input power', 'Power').locator('input').first();
    await expect(power).toBeVisible();
    await expectWhole(power);
    await power.screenshot({path: testInfo.outputPath(`${shell}-power-box-minus-six-volts.png`)});
  });

  test(`${shell}: an open project stored with -6 V is restored showing -6 V, marked, with no repair toast`, async ({page}, testInfo) => {
    await open(page, shell, SAMPLE_PROJECT_OWPR);
    const raw = await page.evaluate(() => localStorage.getItem('openisd_open_sessions'));
    const stored = (raw ?? '').replace(/\\"signal\\":\{\\"power_W\\":\{[^}]*\},\\"voltage_V\\":\{[^}]*\}\}/g, String.raw`\"signal\":{\"voltage_V\":{\"state\":\"E\",\"value\":-6}}`);
    expect(stored, 'the stored project states its signal').not.toBe(raw ?? '');
    await page.evaluate(next => localStorage.setItem('openisd_open_sessions', next), stored);
    await page.reload();
    await expect(openingMessage(page, shell)).not.toContainText('set to the 10 mV minimum');
    await openSignal(page, shell);
    const volts = row(page, shell, 'Driver input voltage', 'Volts');
    await expect(volts.locator('input').first()).toHaveValue('-6');
    await expect(volts.locator('.ui-field-dq-btn')).toHaveCount(1);
    await page.screenshot({path: testInfo.outputPath(`${shell}-restored-minus-six-volts.png`)});
  });
}

/** The box's whole text fits inside it: nothing runs past its edge. */
async function expectWhole(input: Locator): Promise<void> {
  const fits = await input.evaluate(e => e.scrollWidth <= e.clientWidth);
  expect(fits, `the value ${await input.inputValue()} runs past the edge of its box`).toBe(true);
}

test('desktop: the chart keeps drawing while -6 V is refused', async ({page}) => {
  await open(page, 'desktop', SAMPLE_PROJECT_OWPR);
  await openSignal(page, 'desktop');
  const input = row(page, 'desktop', 'Driver input voltage', 'Volts').locator('input').first();
  await fillAndBlur(input, '-6');
  await expect(input).toHaveClass(/inp-bad/);
  await expectChartDrawn(page);
});

test('desktop: a project file holding -6 V draws its chart, at the reference drive level', async ({page}, testInfo) => {
  await open(page, 'desktop', minusSixVoltProject(testInfo));
  await expect(page.locator('.flash')).not.toContainText('set to the 10 mV minimum');
  await expectChartDrawn(page);
});
