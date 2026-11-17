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

  test('mass-loaded resonance has the same numeric box width as editable PR fields', async ({page}) => {
    await page.setViewportSize({width: 374, height: 705});
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    const editable = mobileFieldRow(page, 'Added mass').locator('input');
    const readout = mobileFieldRow(page, 'Fpr with mass').locator('input[readonly]');
    const [inputBox, outputBox] = await Promise.all([editable.boundingBox(), readout.boundingBox()]);
    expect(inputBox).not.toBeNull();
    expect(outputBox).not.toBeNull();
    expect(Math.abs(inputBox!.width - outputBox!.width), 'access must not change the standard value-box width').toBeLessThanOrEqual(1);
  });

  // John, 16 Nov 2026 (QO946.c115, 12:57): the radiator by name and its Key figures; its other figures are in the editor.
  test('a passive-radiator box shows the radiator, its Key figures and User options, and Select PR opens the browser', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await expect(page.locator('.mob-band-title', {hasText: /^Passive radiator$/})).toHaveCount(1);
    await expect(page.locator('.mob-band-title', {hasText: /^Key figures$/})).toHaveCount(1);
    await expect(mobileFieldRow(page, 'Vas')).toHaveCount(0);
    await expect(mobileFieldRow(page, 'Mms')).toBeVisible();
    await expect(page.locator('.ui-field-label', {hasText: /^Added mass$/})).toBeVisible();
    await expect(page.locator('.ui-field-label', {hasText: /^Fpr with mass$/})).toBeVisible();

    await page.getByText('Select PR', { exact: true }).click();
    await expect(page.getByText('Passive radiator library')).toBeVisible();
    await page.locator('.modal .x').click();
    await expect(page.getByText('Passive radiator library')).toHaveCount(0);
  });

  // John, 16 Nov 2026 (QO946.c115, c117): the phone Box tab shows the radiator by name; every field is edited in its editor (Edit), as the driver's.
  test('Edit opens the editor, which edits every passive radiator field; OK keeps them', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');

    await page.locator('#mob-pr-edit').click();
    const editor = page.locator('.prd-panel');
    await editor.getByRole('tab', { name: 'General' }).click();
    await editor.locator('#pr-editor-name').fill('Bench PR 12');
    await editor.getByRole('tab', { name: 'Parameters' }).click();
    await fillAndCommit(editor.locator('#pr-editor-vas'), '7.5');
    await fillAndCommit(editor.locator('#pr-editor-qms'), '12.25');
    await fillAndCommit(editor.locator('#pr-editor-fs'), '21.5');
    await fillAndCommit(editor.locator('#pr-editor-sd'), '300');
    await fillAndCommit(editor.locator('#pr-editor-xmax'), '12');
    await editor.getByRole('button', { name: 'OK', exact: true }).click();
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
    await page.locator('#mob-pr-edit').click();   // the radiator's figures are in its editor (QO946.c115)
    const field = page.locator('.prd-panel .ui-field').filter({ has: page.locator('.ui-field-label', { hasText: 'Mms' }) }).first();
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

  // John, 2026-10-05: a library copy is named on its own; the project's radiator keeps its name. John, 16 Nov 2026
  // (QO946.c117, c118): Save to library is the editor's Copy to My PRs (in More), as the driver editor's Copy to My Drivers.
  test('Copy to My PRs in the editor saves a copy under the editor\'s name; the project keeps its own until OK', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');

    await page.locator('#mob-pr-edit').click();
    const dialog = page.getByRole('dialog', { name: "Edit Project's Passive Radiator" });
    await dialog.getByRole('tab', { name: 'General' }).click();
    const before = await dialog.locator('#pr-editor-name').inputValue();
    await dialog.locator('#pr-editor-name').fill('Library Bench PR');
    await dialog.getByRole('button', { name: /More/ }).click();
    await dialog.getByRole('menuitem', { name: 'Copy to My PRs' }).click();
    await expect(dialog.getByRole('status')).toContainText('Library Bench PR');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.locator('#mob-pr-name-btn')).toContainText(before === '' ? 'Unnamed passive radiator' : before);
    await page.getByText('Select PR', { exact: true }).click();
    await expect(page.locator('.pr-lib-item .pr-lib-name', { hasText: 'Library Bench PR' })).toBeVisible();
  });
});

// The dummy must exist through the real wizard/type-switch path, not only an imported PR file.
test('a new sealed project switching to PR receives a consistent Dummy PR', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await page.locator('.mob-hamburger').click();
  await page.getByRole('button', {name: 'New project', exact: true}).click();
  await page.getByText('Tang Band W5-1138SMF', {exact: true}).click();
  const footer = page.locator('.mob-np-footer');
  const next = footer.getByRole('button', {name: 'Next ▸', exact: true});
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption('sealed');
  await next.click();
  await next.click();
  await page.getByLabel('Project name', {exact: true}).fill('Sealed to dummy PR');
  await footer.getByRole('button', {name: 'Create Project', exact: true}).click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
  await expect(page.locator('#mob-box-type')).toHaveValue('sealed');
  await page.locator('#mob-box-type').selectOption('box-passive-radiator');
  await expect(page.locator('#mob-pr-name-btn')).toHaveText('Dummy PR');
  await page.locator('#mob-pr-edit').click();   // the radiator's figures are in its editor (QO946.c115)
  const qms = page.locator('.prd-panel .mob-ui-field').filter({has: page.locator('label', {hasText: /^Qms$/})});
  expect(Number(await qms.locator('input').inputValue())).toBe(5);
  for (const name of ['Qms', 'Mms', 'Cms']) {
    const row = page.locator('.prd-panel .mob-ui-field').filter({has: page.locator('label', {hasText: new RegExp(`^${name}$`)})});
    await expect(row.locator('input')).not.toBeEmpty();
    await expect(row.locator('.ui-field-dq-btn')).toHaveCount(0);
  }
});
