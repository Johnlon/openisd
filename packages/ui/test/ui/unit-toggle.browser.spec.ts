import {boxVolumeUnitToken, expect, focusedAddedMass_kg, focusedBoxVolume, openAProject, setFocusedBoxType, setFocusedVentedDesign, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * UnitToggle.vue on the Original shell's fields: clicking a field's unit label rescales only the
 * shown value (and converts typed input back); the model always holds SI. The store ALWAYS holds
 * SI, which replaced the old decorative cycleUnit that rotated the label alone.
 */

test.describe('Unit toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('clicking an entered field\'s unit label rescales the DISPLAY and keeps the model SI', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    const field = page.locator('.tab-section.active .ui-field', { hasText: 'Volume' }).first();
    const vol = field.locator('input').first();
    const label = field.locator('.ui-field-unit');

    await vol.click();
    await fillAndBlur(vol, '6');            // 6 L
    await expect(vol).toHaveValue('6.00');
    await expect(label).toHaveText('L');
    expect(await focusedBoxVolume(page)).toBeCloseTo(0.006, 9);   // stored in SI m³

    await label.click();           // L → cu ft
    await expect(label).toHaveText('cu ft');
    await expect(vol).toHaveValue('0.212');             // 0.006 m³ × 35.3147, 3 dp
    expect(await focusedBoxVolume(page)).toBeCloseTo(0.006, 9);   // MODEL unchanged by a unit switch
    expect(await boxVolumeUnitToken(page)).toBe('cuft');       // token persisted (survives refresh)

    await vol.click();
    await fillAndBlur(vol, '0.3');         // now typing in cu ft
    expect(await focusedBoxVolume(page)).toBeCloseTo(0.3 / 35.3147, 6); // converted back to SI
  });

  test('a calculated readout also rescales when its unit is rotated (Hz → kHz)', async ({ page }) => {
    await setFocusedBoxType(page, 'vented');
    await setFocusedVentedDesign(page, { volume_m3: 0.06, tuning_hz: 40, diameter_m: 0.1 });
    await page.locator('.project-nav li').nth(2).click();               // dynamic enclosure/Vents tab
    const field = page.locator('.tab-section.active .field', { hasText: '1st port resonance' });
    const val = field.locator('input');
    const label = field.locator('.unit-cyc');

    await expect(label).toHaveText('Hz');
    const hz = parseFloat(await val.inputValue());
    expect(hz).toBeGreaterThan(0);

    await label.click();           // Hz → kHz
    await expect(label).toHaveText('kHz');
    const khz = parseFloat(await val.inputValue());
    expect(khz).toBeCloseTo(hz / 1000, 3);                             // same SI value, finer unit (display-rounded to 2dp)
  });

  test('Added mass to cone: clicking the unit converts g → kg; the model stays SI (kg)', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    const field = page.locator('.field', { hasText: 'Added mass to cone' });
    const amc = field.locator('input');
    const unit = field.locator('.unit');

    await amc.fill('100');
    await amc.dispatchEvent('input');
    await amc.blur();
    await expect(unit).toHaveText('g');
    const readMadd = () => focusedAddedMass_kg(page);
    expect(await readMadd()).toBeCloseTo(0.1, 6);   // 100 g entered → 0.1 kg in the model

    await unit.click();                              // g → kg
    await expect(unit).toHaveText('kg');
    expect(parseFloat(await amc.inputValue())).toBeCloseTo(0.1, 6); // now shown in kg
    expect(await readMadd()).toBeCloseTo(0.1, 6);    // MODEL unchanged by the display-unit switch
  });

  test('Advanced Temperature: K → °C converts via OFFSET; the model stays in kelvin', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
    const tempField = page.locator('.tab-section.active .field', { hasText: 'Temperature' });
    const temp = tempField.locator('input');
    const unit = tempField.locator('.unit-cyc');
    const sv = page.locator('.tab-section.active .field', { hasText: 'Sound velocity' }).locator('input');

    await expect(unit).toHaveText('K');
    await expect(temp).toHaveValue('293.15');
    const svBefore = await sv.inputValue();          // depends on temperature IN KELVIN

    await unit.click();                              // K → °C (affine: −273.15, not a factor)
    await expect(unit).toHaveText('°C');
    await expect(temp).toHaveValue('20.00');         // 293.15 K − 273.15 = 20.00 °C
    await expect(sv).toHaveValue(svBefore);          // unchanged ⇒ the model stayed in kelvin
  });

  test('Voice coil temp rise, resistance TC, and added mass all convert, each keeping its own resolution', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();

    // Voice coil temp rise: K → °F is a DIFFERENCE conversion (×1.8, no offset — distinct from
    // the Advanced tab's ABSOLUTE temperature, which needs the −273.15 offset).
    const riseField = page.locator('.field', { hasText: 'Voice coil temp rise' });
    const rise = riseField.locator('input');
    const riseUnit = riseField.locator('.unit');
    await rise.fill('40');
    await rise.dispatchEvent('input');
    await rise.blur();
    await expect(riseUnit).toHaveText('K');
    await riseUnit.click();                       // K → °F
    await expect(riseUnit).toHaveText('°F');
    expect(parseFloat(await rise.inputValue())).toBeCloseTo(72, 3); // 40 K rise = 72 °F rise

    // Voice coil resistance TC: 1000/K → %/K → 1/K.
    const tcField = page.locator('.field', { hasText: 'Voice coil resistance TC' });
    const tc = tcField.locator('input');
    const tcUnit = tcField.locator('.unit');
    await expect(tcUnit).toHaveText('1000/K');
    await expect(tc).toHaveValue('3.9000');
    await tcUnit.click();                         // 1000/K → %/K
    await expect(tcUnit).toHaveText('%/K');
    expect(parseFloat(await tc.inputValue())).toBeCloseTo(0.39, 3);

    // Added mass to cone: converting to kg keeps the field's own resolution. The registry states
    // it to 5 decimals of a gram, so kilograms need 8 to say the same thing — those digits ARE the
    // resolution, and a ceiling on them would show a coarser number than the field holds (John,
    // 2026-09-25: "the display resolution must track the absolute precision we want to support").
    const maddField = page.locator('.field', { hasText: 'Added mass to cone' });
    const madd = maddField.locator('input');
    const maddUnit = maddField.locator('.unit');
    await madd.fill('100');
    await madd.dispatchEvent('input');
    await madd.blur();
    await maddUnit.click();                       // g → kg
    await expect(maddUnit).toHaveText('kg');
    await expect(madd).toHaveValue('0.10000000');
    expect(parseFloat(await madd.inputValue())).toBeCloseTo(0.1, 3);
  });
});
