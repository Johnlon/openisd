import {expect, openAProject, setFocusedBoxType, setFocusedDriverSpecs, setFocusedSealedLosses, shownBoxVolume, test} from '../fixtures.js';

/** The Alignment editor opened from the Box tab (a modal shared by the sealed and vented boxes). */

test.beforeEach(async ({ appPage: page }) => {
  await page.goto('/');
  await openAProject(page);
});

test.describe('Alignment popup', () => {
  test('sealed Box tab opens and cancels the Alignment editor', async ({ appPage: page }) => {
    await setFocusedBoxType(page, 'sealed');
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.getByRole('button', { name: 'Alignment', exact: true }).click();
    await expect(page.locator('.alignment-modal')).toBeVisible();
    await expect(page.locator('.alignment-modal select option')).toHaveCount(9);
    const selectorWidth = await page.locator('.alignment-modal select').evaluate(element => element.getBoundingClientRect().width);
    expect(selectorWidth).toBeGreaterThan(300);
    await expect(page.locator('.alignment-modal input[data-numinput], .alignment-modal input[type="number"]')).toHaveValue(/^\d+\.\d{2}$/);
    await expect(page.locator('.alignment-readout')).toContainText(/Either sealed or vented|Suitability unavailable/);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.alignment-modal')).toBeHidden();
  });

  test('Cancel after changing the alignment leaves the sealed volume and Fsc/Qtc untouched', async ({ appPage: page }) => {
    await setFocusedDriverSpecs(page, { Fs_hz: 37, Qts: 0.38, Vas_m3: 0.030, Qes: null });
    await setFocusedBoxType(page, 'sealed');
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    const volumeBefore = await shownBoxVolume(page);
    const qtcBefore = await page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input').inputValue();
    const fscShown = await page.locator('#og-box-resonance').inputValue();

    await page.getByRole('button', { name: 'Alignment', exact: true }).click();
    const select = page.locator('.alignment-modal select');
    const current = await select.inputValue();
    const values = await select.locator('option').evaluateAll(opts => opts.map(o => o.getAttribute('value') ?? ''));
    const others = values.filter(v => v !== current && v !== '');
    expect(others.length, 'the Alignment popup offers another alignment').toBeGreaterThan(0);
    await select.selectOption(others[0]!);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.alignment-modal')).toBeHidden();

    expect(await shownBoxVolume(page)).toBe(volumeBefore);
    await expect(page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input')).toHaveValue(qtcBefore);
    await expect(page.locator('#og-box-resonance')).toHaveValue(fscShown);
  });

  test('vented Box tab opens and cancels the Alignment editor', async ({ appPage: page }) => {
    await setFocusedBoxType(page, 'vented');
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.getByRole('button', { name: 'Alignment', exact: true }).click();
    await expect(page.locator('.alignment-modal')).toBeVisible();
    await expect(page.locator('.alignment-modal select option')).toHaveCount(5);
    // Volume/tuning are read-only readouts here (no closestAlignment reverse lookup for vented,
    // unlike sealed's editable Volume field) — just check both are present.
    await expect(page.locator('.alignment-modal input[readonly]')).toHaveCount(2);
    await expect(page.locator('.alignment-readout')).toContainText(/Either sealed or vented|Suitability unavailable/);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.alignment-modal')).toBeHidden();
  });

  test('choosing Butterworth 0.707 sizes the sealed box: Fs=37Hz, Qts=0.38, Vas=30L give the Box tab the picked Qtc=0.707 and fc=67.2Hz (Ql and Qa at their top value)', async ({ appPage: page }) => {
    // Qts + Vas → sealedFromQtc() → Vb → Qtc;  Fs + Vb → fc. Qes is cleared so the Q trio re-solves
    // from the typed Qts against the catalogue driver's Qms; left as it came, Qes/Qms would still
    // describe the OTHER driver and the loaded Qts the Qtc readout uses would have nothing to do
    // with the Qts the alignment sized the box from.
    await setFocusedDriverSpecs(page, { Fs_hz: 37, Qts: 0.38, Vas_m3: 0.030, Qes: null });

    // Ql and Qa at their top value (1000, the most the fields accept) is the nearest to lossless a user can get, then Box tab, sealed box
    await setFocusedBoxType(page, 'sealed');
    await setFocusedSealedLosses(page, { Ql: 1000, Qa: 1000 });
    await page.locator('.project-nav li', { hasText: 'Box' }).click();

    // Open Alignment modal and choose Butterworth 0.707
    await page.getByRole('button', { name: 'Alignment', exact: true }).click();
    await expect(page.locator('.alignment-modal')).toBeVisible();
    await page.locator('.alignment-modal select').selectOption('0.707');
    await page.locator('.alignment-modal button.ok-btn').click();
    await expect(page.locator('.alignment-modal')).toBeHidden();

    const qtcInput = page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input');
    const fscInput = page.locator('#og-box-resonance');
    await expect(qtcInput).not.toHaveValue('');
    await expect(fscInput).not.toHaveValue('');
    const qtc = parseFloat(await qtcInput.inputValue());
    const fsc = parseFloat(await fscInput.inputValue());
    // The picked Qtc is the box's entered Qtc, so the Box tab shows exactly it (BUG_20261016_sealed-alignment-
    // picker-qtc-disagrees-with-box-tab-qtc). The volume is worked out against the SOURCE-LOADED Qts (the
    // default Rg 0.1 Ω over Re 3.4 Ω lifts Qes 0.4254 → 0.4379, Qts_loaded 0.390): Fsc = 37 Hz · 0.707 / 0.390
    // = 67.0 Hz, and the residual losses at Ql = Qa = 1000 add a tenth of a hertz.
    expect(qtc).toBeCloseTo(0.707, 3);
    await expect(qtcInput).toHaveClass(/value-e/);
    expect(fsc).toBeGreaterThan(67.0);
    expect(fsc).toBeLessThan(67.3);
  });
});
