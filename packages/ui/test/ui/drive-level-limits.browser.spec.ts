/**
 * The Signal tab's drive level on each shell (T918; John, 18 Nov 2026, QO953.c21, c26, c30, c31).
 *  - Typed: 0 and -6 in the Driver input voltage box are refused: the box goes red with a note naming
 *    the 10 mV minimum, nothing is stored (the System input power box keeps its value) and the chart
 *    keeps drawing.
 *  - Opened: a project file holding -6 V opens with the box at 0.01 V (10 mV) and no data-quality
 *    mark; the opening message names the repair, one line ("there won't be a dq flag on a repair as
 *    the dq always relate to the value the user can see"; "all you can do is show a toast").
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
/** The System input power that drives 10 mV, in four figures: the phone's narrow box shows it in exponent form. */
const POWER_AT_10_MV: Readonly<Record<Shell, RegExp>> = {phone: /^\d\.\d{3}e-\d$/, desktop: /^0\.0000\d{4}$/};
const REPAIR_LINE = 'Driver input voltage (each) -6 V in the file: set to the 10 mV minimum';

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

  test(`${shell}: a project file holding -6 V opens at 0.01 V with no data-quality mark, and the opening message names the repair`, async ({page}, testInfo) => {
    await open(page, shell, minusSixVoltProject(testInfo));
    const message = openingMessage(page, shell);
    await expect(message).toHaveText(`Project imported from minus-six-volts.owpr\n${REPAIR_LINE}`, {useInnerText: true});
    await expectInside(page, message);
    await page.screenshot({path: testInfo.outputPath(`${shell}-opened-minus-six-volts-message.png`)});
    await openSignal(page, shell);
    const volts = row(page, shell, 'Driver input voltage', 'Volts');
    const input = volts.locator('input').first();
    await expect(input).toHaveValue('0.01');
    await expect(input).not.toHaveClass(/dq-flag/);
    await expect(volts.locator('.ui-field-dq-btn')).toHaveCount(0);
    await page.screenshot({path: testInfo.outputPath(`${shell}-opened-minus-six-volts-signal.png`)});
  });

  test(`${shell}: the System input power that drives 10 mV is shown whole in its box, never cut`, async ({page}, testInfo) => {
    await open(page, shell, minusSixVoltProject(testInfo));
    await openSignal(page, shell);
    const power = row(page, shell, 'System input power', 'Power').locator('input').first();
    await expect(power).toHaveValue(POWER_AT_10_MV[shell]);
    await expectWhole(power);
    await power.screenshot({path: testInfo.outputPath(`${shell}-power-box-at-10mV.png`)});
    await page.screenshot({path: testInfo.outputPath(`${shell}-power-at-10mV-signal.png`)});
  });

  test(`${shell}: an open project stored by an earlier build with -6 V is restored at 0.01 V, and a toast names the repair`, async ({page}, testInfo) => {
    await open(page, shell, SAMPLE_PROJECT_OWPR);
    // The stored open project as an earlier build, which let -6 V through, could have left it.
    const raw = await page.evaluate(() => localStorage.getItem('openisd_open_sessions'));
    const broken = (raw ?? '').replace(/\\"signal\\":\{\\"power_W\\":\{[^}]*\},\\"voltage_V\\":\{[^}]*\}\}/g, String.raw`\"signal\":{\"voltage_V\":{\"state\":\"E\",\"value\":-6}}`);
    expect(broken, 'the stored project states its signal').not.toBe(raw ?? '');
    await page.evaluate(next => localStorage.setItem('openisd_open_sessions', next), broken);
    await page.reload();
    const message = openingMessage(page, shell);
    await expect(message).toHaveText(new RegExp(`^Project opened: [^\\n]+\\n${escaped(REPAIR_LINE)}$`), {useInnerText: true});
    await expectInside(page, message);
    await page.screenshot({path: testInfo.outputPath(`${shell}-restored-minus-six-volts-toast.png`)});
    await openSignal(page, shell);
    const input = row(page, shell, 'Driver input voltage', 'Volts').locator('input').first();
    await expect(input).toHaveValue('0.01');
    await expect(row(page, shell, 'Driver input voltage', 'Volts').locator('.ui-field-dq-btn')).toHaveCount(0);
  });
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

test('desktop: a project file holding -6 V draws its chart at 10 mV', async ({page}, testInfo) => {
  await open(page, 'desktop', minusSixVoltProject(testInfo));
  await expect(page.locator('.flash')).toContainText('set to the 10 mV minimum');
  await expectChartDrawn(page);
});
