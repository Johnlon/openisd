/**
 * The mobile Vented tab (the tab bar's label for a vented box; the panel itself is headed "Vents").
 * The FIELD WIRING itself (the vent-group Helmholtz relation) is proven once, in
 * `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s `createVentReadouts` suite and the
 * domain's own tests — the same factories this tab calls. These specs prove the UI is correctly
 * WIRED to that shared logic, not that the logic itself is correct.
 *
 * The sample fixture (`SAMPLE_PROJECT_OWPR`) opens as a VENTED box, which is what puts this tab in
 * the bar to begin with.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ appPage: page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileVentedTab', () => {
  test('shows the vent config and readouts', async ({ appPage: page }) => {
    // The tab bar's label is the box type's own name ("Vented" — enclosureNavLabel falls back to
    // boxLabel for anything that isn't sealed/PR); the panel's own section header says "Vents".
    await expect(page.locator('.mob-band-title', {hasText: /^Vents$/})).toHaveCount(1);
    await expect(page.getByText('Number of Vents')).toBeVisible();
    await expect(page.getByText('Shape')).toBeVisible();
    await expect(mobileFieldRow(page, 'Vent diameter')).toBeVisible();
    await expect(mobileFieldRow(page, '1st port resonance')).toBeVisible();
  });

  test('editing the vent diameter writes through to the field', async ({ appPage: page }) => {
    const diameterInput = mobileFieldRow(page, 'Vent diameter').locator('input');
    await diameterInput.fill('6');
    await diameterInput.blur();
    await expect(diameterInput).toHaveValue(/6/);
  });

  // John, 2026-10-16: clearing the entered target tuning keeps the vent length at its value as
  // entered; the tuning shows what that length gives. The volume is never overwritten and nothing
  // goes blank. Mirrors the desktop spec in original-vented-tab.browser.spec.ts.
  test('clearing Target Tuning Freq keeps the vent length; the tuning is calculated', async ({ appPage: page }) => {
    const fbInput = mobileFieldRow(page, 'Fb').locator('input');
    await fbInput.fill('40');
    await fbInput.blur();
    await expect(fbInput).toHaveValue(/40/);
    const lengthInput = mobileFieldRow(page, 'Vent length').locator('input');
    const lengthBefore = await lengthInput.inputValue();

    await fbInput.fill('');
    await fbInput.blur();

    await expect(fbInput).toBeVisible();
    await expect(fbInput).toHaveValue(/^40(\.0+)?$/);
    await expect(fbInput).toHaveClass(/value-c/);
    await expect(lengthInput).toHaveValue(lengthBefore);
    await expect(lengthInput).toHaveClass(/value-e/);
  });

  test('clearing Vent diameter keeps the cross area; the diameter is calculated', async ({ appPage: page }) => {
    const diameter = mobileFieldRow(page, 'Vent diameter').locator('input');
    // A calculated value is a read-only box (T607), so its text is the box's value.
    const area = mobileFieldRow(page, 'Cross area').locator('input');
    const areaBefore = await area.inputValue();
    const diameterBefore = await diameter.inputValue();

    await diameter.fill('');
    await diameter.blur();

    await expect(diameter).toHaveValue(diameterBefore);
    await expect(diameter).toHaveClass(/value-c/);
    await expect(area).toHaveValue(areaBefore);
  });

  test('picking two vents makes the Cross area box show twice the one-port area', async ({ appPage: page }) => {
    const area = mobileFieldRow(page, 'Cross area').locator('input');
    const one = parseFloat(await area.inputValue());
    expect(one).toBeGreaterThan(0);
    await page.locator('.mob-crow', { hasText: 'Number of Vents' }).locator('select').selectOption('2');
    await expect.poll(async () => parseFloat(await area.inputValue()) / one).toBeCloseTo(2, 2);
  });

  // John, 2026-10-01: the port velocity limit sits on the vent section in both layouts.
  test('the port velocity limit shows 17 m/s and takes an edit', async ({ appPage: page }) => {
    const input = page.locator('#mob-vent-velocity-limit');
    await expect(input).toHaveValue(/^17(\.0+)?$/);
    await input.fill('25');
    await input.blur();
    await expect(input).toHaveValue(/^25(\.0+)?$/);
  });
});
