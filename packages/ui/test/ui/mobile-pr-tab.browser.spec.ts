/**
 * The mobile Passive Radiator tab. The FIELD WIRING itself (PR readouts) is proven once, in
 * `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s `createPassiveRadiatorActions` suite and the
 * domain's own tests. These specs prove the UI is correctly WIRED to that shared logic.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {fillAndCommit} from '../fixtures/numField.js';
import {shownPassiveRadiator} from '../fixtures/passiveRadiatorScreen.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobilePrTab', () => {
  test('mobile field labels stay inside their rows', async ({page}) => {
    await page.setViewportSize({width: 374, height: 705});
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    const rows = page.locator('.mob-classic .mob-ui-field.ui-field');
    const overflow = await rows.evaluateAll(elements => elements.flatMap(row => {
      const label = row.querySelector<HTMLElement>('.ui-field-label');
      if (!label) return [];
      const rowBox = row.getBoundingClientRect();
      const labelBox = label.getBoundingClientRect();
      const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
      const lineCount = Math.round(labelBox.height / lineHeight);
      return labelBox.top < rowBox.top - 0.5 || labelBox.bottom > rowBox.bottom + 0.5 || lineCount > 2
        ? [`${label.textContent?.trim() ?? 'unnamed label'} (${lineCount} lines)`] : [];
    }));
    expect(overflow, 'field labels must fit within two lines inside their phone rows').toEqual([]);
  });

  test('a passive-radiator box shows passive radiator fields and Select PR opens the browser', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await expect(page.locator('.mob-band-title', {hasText: /^Passive radiator$/})).toHaveCount(1);
    await expect(mobileFieldRow(page, 'Vas')).toBeVisible();
    await expect(page.locator('.ui-field-label', {hasText: /^Added mass$/})).toBeVisible();
    await expect(page.locator('.ui-field-label', {hasText: /^Fpr with mass$/})).toBeVisible();

    await page.getByText('Select PR', { exact: true }).click();
    await expect(page.getByText('Passive radiator library')).toBeVisible();
    await page.locator('.modal .x').click();
    await expect(page.getByText('Passive radiator library')).toHaveCount(0);
  });

  // John, 2026-10-05: every PR field is editable on the page, so the page has no Edit button.
  test('the PR page has no Edit button and edits every passive radiator field in place', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');

    await expect(page.locator('.mob-cbtns button', { hasText: /^Edit$/ })).toHaveCount(0);

    const input = (label: string) => mobileFieldRow(page, label).locator('input').first();
    await page.locator('#mob-pr-name').fill('Bench PR 12');
    await fillAndCommit(input('Vas'), '7.5');
    await fillAndCommit(input('Qms'), '12.25');
    await fillAndCommit(mobileFieldRow(page, 'Fpr').filter({ hasNotText: 'with added mass' }).locator('input').first(), '21.5');
    await fillAndCommit(input('Sd'), '300');
    await fillAndCommit(input('Xmax'), '12');
    await page.locator('#mob-pr-count').selectOption('2');

    const stored = await shownPassiveRadiator(page);
    expect(stored.name).toBe('Bench PR 12');
    expect(stored.vas_L).toBeCloseTo(7.5, 2);
    expect(stored.qms).toBeCloseTo(12.25, 2);
    expect(stored.fs_hz).toBeCloseTo(21.5, 2);
    expect(stored.sd_cm2).toBeCloseTo(300, 1);
    expect(stored.xmax_mm).toBeCloseTo(12, 1);
    expect(stored.count).toBe(2);
  });

  test('Mms keeps its unit toggle and both cues inside one phone field row', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    const field = mobileFieldRow(page, 'Mms').first();
    const input = field.locator('.ui-field-value input').first();
    const unit = field.locator('.ui-field-unit.unit-toggle');
    const deviation = field.locator('.ui-field-dev .winisd-deviation-cue');
    await expect(input).toBeVisible();
    await expect(unit).toHaveAttribute('role', 'button');
    await expect(unit).toHaveCSS('background-color', 'rgb(239, 239, 239)');
    await expect(deviation).toBeVisible();

    await input.fill('-1');
    await input.blur();
    const warning = field.locator('.ui-field-dq-btn');
    await expect(warning).toBeVisible();

    const boxes = await Promise.all([field, input, unit, deviation, warning].map(locator => locator.boundingBox()));
    const [rowBox, inputBox, unitBox, deviationBox, warningBox] = boxes;
    expect(boxes.every(box => box !== null), 'the field and each adornment must have layout geometry').toBe(true);
    expect(unitBox!.x).toBeGreaterThanOrEqual(inputBox!.x);
    expect(unitBox!.x + unitBox!.width).toBeLessThanOrEqual(inputBox!.x + inputBox!.width);
    for (const adornment of [unitBox!, deviationBox!, warningBox!]) {
      expect(adornment.x).toBeGreaterThanOrEqual(rowBox!.x);
      expect(adornment.y).toBeGreaterThanOrEqual(rowBox!.y);
      expect(adornment.x + adornment.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width);
      expect(adornment.y + adornment.height).toBeLessThanOrEqual(rowBox!.y + rowBox!.height);
    }
    const adornments = [unitBox!, deviationBox!, warningBox!].sort((a, b) => a.x - b.x);
    for (let index = 1; index < adornments.length; index++) {
      expect(adornments[index - 1]!.x + adornments[index - 1]!.width)
        .toBeLessThanOrEqual(adornments[index]!.x + 0.5);
    }

    const beforeUnit = (await unit.innerText()).trim();
    const beforeValue = Number(await input.inputValue());
    await unit.click();
    await expect(unit).not.toHaveText(beforeUnit);
    expect(Number(await input.inputValue())).not.toBe(beforeValue);
  });

  // John, 2026-10-05: "Save PR to library needs to ask for a name confirmation dialog." The
  // name typed there names the library copy only; the project's radiator keeps its own name.
  test('Save to library asks for a name, prefilled, and saves a copy under the typed name', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');

    await page.locator('#mob-pr-name').fill('Bench PR');
    await page.getByRole('button', { name: 'Save to library' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save passive radiator to library' });
    const name = dialog.locator('input');
    await expect(name).toHaveValue('Bench PR');
    await name.fill('Library Bench PR');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.locator('#mob-pr-name')).toHaveValue('Bench PR');
    await page.getByText('Select PR', { exact: true }).click();
    await expect(page.locator('.pr-lib-item .pr-lib-name', { hasText: 'Library Bench PR' })).toBeVisible();
  });
});
