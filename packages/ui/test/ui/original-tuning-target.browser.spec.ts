/**
 * The Original skin's tuning readouts and the vented box's DIRECTION.
 *
 * Two defects from winisd_research/GAPS.md, both "a wrong number under a WinISD field name",
 * which reads as verified parity:
 *
 *   §A3 — a PR box's "Fh" is the PASSIVE RADIATOR system tuning (box compliance in series
 *         with the PR's own, against the PR's moving mass). The sealed Fc = Fs·√(1+Vas/Vb)
 *         ignores the PR entirely, so it is not a near-miss but a different quantity —
 *         72.25 Hz vs 194.87 Hz on WinISD's own trial inputs. The `.wpr` writer already
 *         calls `prTuning()` (logic/wprMapping.ts), so a wrong pane also disagrees with the
 *         file the same project exports.
 *
 *   §A1 — `Fb` is a TARGET the port solver designs to, not a system output (human ruling,
 *         QO11). The solver already runs in WinISD's direction; what was missing is saying
 *         so on screen, and admitting when the target cannot be met.
 *
 * The A3 test does not read a hard-coded frequency: it changes a quantity ONLY the PR model
 * depends on (mass added to the radiator cone) and requires the readout to move. The sealed
 * formula cannot depend on it, so no binding to the sealed Fc can pass.
 */
import { test, expect } from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('§A3 — a PR box\'s Fh tracks the PR\'s own added mass, so it is the PR tuning not the sealed Fc', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('pr');

  const fh = page.locator('#og-box-resonance');
  await expect(fh).toBeVisible();
  const before = Number(await fh.inputValue());
  expect(before).toBeGreaterThan(0);

  // Mass on the radiator cone lowers the PR system tuning; the sealed Fc cannot see it.
  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
  await page.locator('#og-pr-madd').fill('50');
  await page.locator('#og-pr-madd').blur();

  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  const after = Number(await fh.inputValue());
  expect(after, 'adding 50 g to the radiator must lower Fh — the sealed Fc ignores the PR')
    .toBeLessThan(before);
});

test('§A3 — a CLOSED box never reports a passive-radiator tuning', async ({ page }) => {
  // The Closed pane is only reachable with the enclosure tab already active, which the box
  // picker itself never leaves in that state — so restore it the way a saved project does.
  await page.locator('select#og-box-type').selectOption('vented');
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('openisd.state') ?? '{}');
    s.box = 'sealed';
    localStorage.setItem('openisd.state', JSON.stringify(s));
  });
  await page.reload();

  const readout = page.locator('#og-sealed-enclosure-resonance');
  await expect(readout).toBeVisible();
  await expect(readout.locator('xpath=preceding-sibling::label[1]')).toHaveText('Fsc');
  const onEnclosure = await readout.inputValue();

  // It must be the SAME quantity the Box tab shows for a closed box, not the PR tuning.
  // (The Closed pane's own nav entry is dropped for a sealed box, so this trip is one-way.)
  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  await expect(page.locator('#og-box-resonance')).toHaveValue(onEnclosure);
});

test('§A1 — the vented box calls Fb the TARGET, and says what it drives', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('vented');

  const field = page.locator('#og-fb-target-field');
  await expect(field.locator('label')).toHaveText('Target Tuning Freq');
  await expect(field).toHaveAttribute('title', /port dimension/i);
});

test('§A1 — a target the port cannot reach is reported, and the length shows as unbuildable', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('vented');

  // 40 Hz in a 30 L box with the default 5 cm vent is reachable — no warning.
  await page.locator('#og-fb-target').fill('40');
  await page.locator('#og-fb-target').blur();
  await expect(page.locator('#og-fb-unreachable')).toHaveCount(0);

  // 120 Hz is not: the default geometry's L = 0 ceiling is 73.15 Hz, so the solve is negative.
  await page.locator('#og-fb-target').fill('120');
  await page.locator('#og-fb-target').blur();
  await expect(page.locator('#og-fb-unreachable')).toBeVisible();
  await expect(page.locator('#og-fb-unreachable')).toContainText('73.15');

  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  await expect(page.locator('#og-vent-unreachable')).toBeVisible();
  // The failure is SHOWN, not hidden behind a buildable-looking floor: the length is negative.
  const len = await page.locator('#og-vent-length-ro').inputValue();
  expect(Number(len), `solved vent length "${len}" must read negative for an impossible target`)
    .toBeLessThan(0);
});

// The human's QO11 ruling: the target tuning is the port solver's INPUT, so it belongs on the
// Vents pane as well as the Box tab — the user sizing a vent must see, and be able to change,
// the target those dimensions were solved for. WinISD shows it only on its Box screen; this is
// a deliberate OpenISD addition. One stored `P.Fb`, two places to see and edit it.
test('§A1 — the Vents pane carries the SAME editable target tuning as the Box tab', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('vented');
  await page.locator('#og-fb-target').fill('42');
  await page.locator('#og-fb-target').blur();

  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  const ventField = page.locator('#og-vent-fb-target-field');
  await expect(ventField.locator('label')).toHaveText('Target Tuning Freq');
  await expect(page.locator('#og-vent-fb-target')).toHaveValue('42.00');

  // Vents → Box: editing here must move the Box tab's field AND re-solve the vent length.
  const lenBefore = await page.locator('#og-vent-length-ro').inputValue();
  await page.locator('#og-vent-fb-target').fill('30');
  await page.locator('#og-vent-fb-target').blur();
  const lenAfter = await page.locator('#og-vent-length-ro').inputValue();
  expect(Number(lenAfter), 'a lower target must lengthen the vent').toBeGreaterThan(Number(lenBefore));

  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  await expect(page.locator('#og-fb-target')).toHaveValue('30.00');

  // Box → Vents: the other direction of the same single value.
  await page.locator('#og-fb-target').fill('35');
  await page.locator('#og-fb-target').blur();
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  await expect(page.locator('#og-vent-fb-target')).toHaveValue('35.00');
});

// WinISD's PR screen labels the radiator's own free-air resonance "Fs" (docs/winisd_screenshots/
// view_3_passive_radiator.png: Fs 30.00 Hz), which collides with the DRIVER's Fs. The human
// ruled Fpr, for consistency with the other F* symbols. This is the PR's own resonance — NOT
// the system tuning, which is the Box tab's Fh (view_2_box.png: 40.25 Hz on the same project).
test('§A3 — the PR pane labels the radiator\'s own resonance Fpr, not Fs', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('pr');
  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();

  await expect(page.locator('#og-pr-fs').locator('xpath=preceding-sibling::label[1]'))
    .toHaveText('Fpr');
  await expect(page.locator('#og-pr-fs-mass').locator('xpath=preceding-sibling::label[1]'))
    .toHaveText('Fpr (with added mass):');

  // The two are different quantities and must stay on different readouts: the Box tab's Fh is
  // the system tuning (box compliance in series with the PR's own), so it must NOT equal the
  // PR's free-air Fpr.
  const fpr = Number(await page.locator('#og-pr-fs').inputValue());
  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  const fh = Number(await page.locator('#og-box-resonance').inputValue());
  expect(fh, 'the system tuning Fh must not be the PR\'s free-air Fpr').not.toBeCloseTo(fpr, 2);
});
