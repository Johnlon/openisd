import { test, expect, openAProject } from '../fixtures.js';
import { PageOps, fillAndCommit, numInputByLabel } from '../fixtures/numField.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
});

test('§A3 — a PR box\'s Fh tracks the PR\'s own added mass, so it is the PR tuning not the sealed Fc', async ({ page }) => {
  const pageOps = new PageOps(page);
  // A PR box needs a real radiator and volume before Fh can resolve (the sample has neither).
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('box-passive-radiator');
  await fillAndCommit(numInputByLabel(page, 'Volume').first(), '30');

  // Load the bundled ND140-PR through the PR pane — the real user path to a solvable PR.
  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
  await page.locator('button.edit-btn', { hasText: 'Select PR' }).click();
  const lib = page.locator('.modal');
  await lib.locator('.pr-lib-item .pr-lib-name', { hasText: 'ND140-PR' }).first().click();
  // The radiator editor opens for review; Done confirms the load.
  const editor = page.locator('.modal');
  await editor.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#og-pr-fs')).toHaveValue(/44\./); // ND140 free-air Fpr loaded

  // The Box tab's Fh is the PR SYSTEM tuning; it tracks the radiator's added mass.
  const readFh = async () => Number(await page.locator('#og-box-resonance').inputValue());
  await pageOps.setNum('#og-pr-madd', '10');
  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  const before = await readFh();
  expect(before).toBeGreaterThan(0);

  // Mass on the radiator cone lowers the PR system tuning; the sealed Fc cannot see it.
  await page.locator('.project-nav li', { hasText: 'Passive Radiator' }).click();
  await pageOps.setNum('#og-pr-madd', '50');
  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  const after = await readFh();
  expect(after, 'adding 50 g to the radiator must lower Fh — the sealed Fc ignores the PR')
    .toBeLessThan(before);
});

test('§A3 — a CLOSED box never reports a passive-radiator tuning', async ({ page }) => {
  // A sealed box has no port or radiator, so its only resonance is the sealed Fsc on the
  // Box tab — labelled Fsc, never Fh/Fpr. The enclosure/Vents pane and its PR tuning are
  // dropped entirely for a closed box (no "Passive Radiator" nav entry to report one).
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('sealed');
  // The sample's sealed volume is empty; give it one so Fsc resolves to a real number.
  await fillAndCommit(numInputByLabel(page, 'Volume').first(), '20');

  const readout = page.locator('#og-box-resonance');
  await expect(readout).toBeVisible();
  await expect(readout.locator('xpath=preceding-sibling::label[1]')).toHaveText('Fsc');
  const onBox = await readout.inputValue();
  expect(Number(onBox)).toBeGreaterThan(0);

  // Nothing on the page reports a passive-radiator tuning for a closed box.
  await expect(page.locator('.project-nav li', { hasText: 'Passive Radiator' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Fpr');
});

test('§A1 — the vented box calls Fb the TARGET, and says what it drives', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('vented');

  const field = page.locator('#og-fb-target-field');
  await expect(field.locator('label')).toHaveText('Target Tuning Freq');
  await expect(field).toHaveAttribute('title', /port dimension/i);
});

test('§A1 — a target the port cannot reach is reported, and the length shows as unbuildable', async ({ page }) => {
  const pageOps = new PageOps(page);
  await page.locator('select#og-box-type').selectOption('vented');

  // 40 Hz in the fixture's 7 L box with its 5 cm vent is reachable — no warning.
  await pageOps.setNum('#og-fb-target', '40');
  await expect(page.locator('#og-fb-unreachable')).toHaveCount(0);

  // 200 Hz is not: this volume + 5 cm vent tops out at ~165.6 Hz (L = 0), so the solve is negative.
  await pageOps.setNum('#og-fb-target', '200');
  await expect(page.locator('#og-fb-unreachable')).toBeVisible();
  await expect(page.locator('#og-fb-unreachable')).toContainText('165.62');

  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  await expect(page.locator('#og-vent-unreachable')).toBeVisible();
  // The failure is SHOWN, not hidden behind a buildable-looking floor: the length is negative,
  // redlined (the `.impossible` class), and the DQ flag is genuinely set in the model.
  const len = await page.locator('#og-vent-length-ro').inputValue();
  expect(Number(len), `solved vent length "${len}" must read negative for an impossible target`)
    .toBeLessThan(0);
  await expect(page.locator('#og-vent-length-ro')).toHaveClass(/impossible/);
  const dq = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const p = (await import(/* @vite-ignore */ modPath)).requireFocusedProject();
    return { unreachable: p.ventTargetUnreachable.value, dqCount: p.box.vented.tuning_hz.get().dq().length };
  });
  expect(dq.unreachable).toBe(true);   // the DQ aggregation is on, not just the visual
  expect(dq.dqCount).toBeGreaterThan(0);
});

// The human's QO11 ruling: the target tuning is the port solver's INPUT, so it belongs on the
// Vents pane as well as the Box tab — the user sizing a vent must see, and be able to change,
// the target those dimensions were solved for. WinISD shows it only on its Box screen; this is
// a deliberate OpenISD addition. One stored `P.Fb`, two places to see and edit it.
test('§A1 — the Vents pane carries the SAME editable target tuning as the Box tab', async ({ page }) => {
  const pageOps = new PageOps(page);
  await page.locator('select#og-box-type').selectOption('vented');
  await pageOps.setNum('#og-fb-target', '42');

  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  const ventField = page.locator('#og-vent-fb-target-field');
  await expect(ventField.locator('label')).toHaveText('Target Tuning Freq');
  await expect(page.locator('#og-vent-fb-target')).toHaveValue('42.00');

  // Vents → Box: editing here must move the Box tab's field AND re-solve the vent length.
  const lenBefore = await page.locator('#og-vent-length-ro').inputValue();
  await pageOps.setNum('#og-vent-fb-target', '30');
  const lenAfter = await page.locator('#og-vent-length-ro').inputValue();
  expect(Number(lenAfter), 'a lower target must lengthen the vent').toBeGreaterThan(Number(lenBefore));

  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  await expect(page.locator('#og-fb-target')).toHaveValue('30.00');

  // Box → Vents: the other direction of the same single value.
  await pageOps.setNum('#og-fb-target', '35');
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
  await expect(page.locator('#og-vent-fb-target')).toHaveValue('35.00');
});

// WinISD's PR screen labels the radiator's own free-air resonance "Fs" (docs/winisd_screenshots/
// view_3_passive_radiator.png: Fs 30.00 Hz), which collides with the DRIVER's Fs. The human
// ruled Fpr, for consistency with the other F* symbols. This is the PR's own resonance — NOT
// the system tuning, which is the Box tab's Fh (view_2_box.png: 40.25 Hz on the same project).
test('§A3 — the PR pane labels the radiator\'s own resonance Fpr, not Fs', async ({ page }) => {
  await page.locator('select#og-box-type').selectOption('box-passive-radiator');
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
