import {
  expect, openAProject, setFocusedBoxType,
  setFocusedDriverSpecs, setFocusedSealedLosses, setFocusedSeriesResistance, test, W5_1138SMF,
} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur, fillAndCommit, numInputByLabel} from '../fixtures/numField.js';

/**
 * The Original shell's Box tab: the box-type selector, the per-type fields, the sealed Fsc/Qtc
 * readouts, and what the tab shows for each box type. Vents and the passive radiator have their
 * own tabs (original-vented-tab, original-pr-tab).
 */

const qtcInput = (page: Page) => page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input');
const fscInput = (page: Page) => page.locator('#og-box-resonance');
const boxTab = (page: Page) => page.locator('.project-nav li', { hasText: 'Box' });

test.beforeEach(async ({ appPage: page }) => {
  await page.goto('/');
  await openAProject(page);
});

/** The Fsc and Qtc readouts as the Box tab shows them. */
async function shownSealedReadouts(page: Page): Promise<{fsc: string; qtc: string}> {
  return {fsc: await fscInput(page).inputValue(), qtc: await qtcInput(page).inputValue()};
}

/** Each edit must re-render the readouts it affects: after it they show a number that differs from the one
 *  before (the stale-readout bug leaves the old value on screen). The values themselves are the engine's,
 *  and are tested there. */
async function expectReadoutsMoved(page: Page, before: {fsc: string; qtc: string}, message: string, moved: ReadonlyArray<'fsc' | 'qtc'> = ['fsc', 'qtc']): Promise<{fsc: string; qtc: string}> {
  for (const readout of moved) {
    await expect.poll(async () => (await shownSealedReadouts(page))[readout], { message: `${message}: ${readout}` }).not.toBe(before[readout]);
  }
  const now = await shownSealedReadouts(page);
  expect(Number.isFinite(parseFloat(now.fsc)) && Number.isFinite(parseFloat(now.qtc)), `${message}: numbers shown`).toBe(true);
  return now;
}

// T211 (John, 16 Oct 2026, clear-to-blank ruling): an emptied vented volume settles to the volume
// the current alignment gives (10.69 L for the sample's driver), never blank and never 0.
test('emptying the box volume settles it to the alignment volume', async ({ appPage: page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const vol = page.locator('#og-box-volume');
  await vol.fill('40');
  await vol.blur();
  await expect(vol).toHaveValue(/^40/);
  await vol.fill('');
  await vol.blur();
  await expect(vol).toHaveValue('10.69');
});

test.describe('Original Box tab', () => {
  test('the Box tab owns the box-type selector', async ({ appPage: page }) => {
    await boxTab(page).click();
    await expect(page.locator('#og-box-type')).toBeVisible();
  });

  test('no box type row is dim grey, and 6th-order bandpass and ABC are selectable', async ({ appPage: page }) => {
    await boxTab(page).click();
    const dim = 'rgb(153, 153, 153)';
    const sel = page.locator('select#og-box-type');
    for (const box of ['sealed', 'vented', 'bandpass4', 'box-passive-radiator', 'bandpass6', 'abc'])
      await expect(sel.locator(`option[value="${box}"]`)).not.toHaveCSS('color', dim);
    await sel.selectOption('abc');
    await expect(sel).toHaveValue('abc');
  });

  test('the Box tab exposes all six box types and drives the shared store for each', async ({ appPage: page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    const boxSel = page.locator('select#og-box-type');
    await expect(boxSel.locator('option')).toHaveCount(6);

    // Scope pending assertions to the active tab — hidden v-show tabs keep their text in
    // the DOM, so assert on the currently-visible Box section only.
    const boxTab = page.locator('.tab-section.active');
    await boxSel.selectOption('vented');
    await expect(page.locator('#og-box-diagram-vented')).toBeVisible();
    await expect(boxTab).not.toContainText(/response model pending/i);

    // Every box type simulates (6th-order and ABC since df81902c): selecting one writes the model.
    await boxSel.selectOption('abc');
    await expect(page.locator('#og-box-diagram-abc')).toBeVisible();
    await expect(boxTab).not.toContainText(/response model pending/i);
    await expect(boxSel).toHaveValue('abc');
  });

  test('the Closed (sealed) box hides the dynamic enclosure tab — Volume lives only on the Box tab', async ({ appPage: page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption('vented');
    const nav = page.locator('.project-nav li');
    await expect(nav).toHaveCount(7); // vented shows the dynamic enclosure/Vents tab

    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption('sealed');

    // For a closed box the enclosure tab only duplicated the Box tab's Volume — it is dropped.
    await expect(nav).toHaveCount(6);
    await expect(nav.filter({ hasText: 'Closed' })).toHaveCount(0);

    // Volume is still editable on the Box tab.
    await expect(page.locator('.tab-section.active')).toContainText('Volume');
  });

  test('an externally loaded box type re-syncs the Box tab', async ({ appPage: page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption('abc');
    await expect(page.locator('#og-box-diagram-abc')).toBeVisible();

    // A box type set from outside the Box tab (a file load) must re-sync the select, the diagram
    // and the graph.
    await setFocusedBoxType(page, 'sealed');

    await expect(page.locator('select#og-box-type')).toHaveValue('sealed');
    await expect(page.locator('#og-box-diagram-sealed')).toBeVisible();
    await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
  });

  test('the 6th-order bandpass Frc field persists a typed value instead of discarding it', async ({ appPage: page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption('bandpass6');
    const frc = page.locator('.field', { hasText: 'Tuning freq (Frc)' }).locator('input');
    await frc.click();
    await fillAndBlur(frc, '2222');
    await expect(frc).toHaveValue(/^2222(\.0+)?$/); // 2-dp display formatting, not the bug
    // Leaving the box type and coming back remounts the field from the project, not from the input's own state.
    await page.locator('select#og-box-type').selectOption('sealed');
    await page.locator('select#og-box-type').selectOption('bandpass6');
    await expect(frc).toHaveValue(/^2222(\.0+)?$/);
  });

  // bugs/BUG_20261007_bp6-abc-front-tuning-edits-the-vented-box.md
  test('the 6th-order bandpass Ffc field edits the front chamber, not the vented box', async ({ appPage: page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption('bandpass6');
    const select = page.locator('select#og-box-type');
    const ventedTuning = async (): Promise<string> => {
      await select.selectOption('vented');
      const shown = await page.locator('#og-fb-target').inputValue();
      await select.selectOption('bandpass6');
      return shown;
    };
    const before = await ventedTuning();
    const ffc = page.locator('#og-ffc-target');
    await fillAndBlur(ffc, '31.5');
    expect(await ventedTuning()).toBe(before);
    await expect(ffc).toHaveValue(/^31\.5(0+)?$/);
  });

  // bugs/BUG_20261005_no-common-ui-field-component.md: an emptied Frc is never stored as 0. Under the
  // clear rule (docs/design/FIELD_CLEAR_RULE.md) the vent length becomes the entry and Frc is calculated.
  test('the 6th-order bandpass Frc field, when emptied, shows the calculated tuning instead of 0', async ({ appPage: page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption('bandpass6');
    const frc = page.locator('.ui-field', { hasText: 'Tuning freq (Frc)' }).locator('input');
    const entered = await frc.inputValue();
    await fillAndBlur(frc, '');
    await expect(frc).toHaveValue(entered);
    await expect(frc).toHaveClass(/value-c/);
  });

  test('sealed box: Fs=37Hz, Qts=0.38, Vas=30L driver in a 20L box shows the WinISD-lossy Qtc and fc', async ({ appPage: page }) => {
    // Qtc = Qts × √(1 + Vas/Vb), fc = Fs × √(1 + Vas/Vb) in the lossless model; the default
    // WinISD-lossy model reads them from the loss-mode cubic, so the expected numbers come from
    // the W5-1138SMF table.
    await setFocusedDriverSpecs(page, { Fs_hz: 37, Qts: 0.38, Vas_m3: 0.030 });
    await setFocusedBoxType(page, 'sealed');
    await fillAndCommit(numInputByLabel(page, 'Volume').first(), '20');

    await expect(qtcInput(page)).not.toHaveValue('');
    const qtc = parseFloat(await qtcInput(page).inputValue());
    const fsc = parseFloat(await fscInput(page).inputValue());
    const expected = W5_1138SMF.expected.sealed!['20L'];
    expect(qtc).toBeCloseTo(parseFloat(expected.Qtc), 2);
    expect(fsc).toBeCloseTo(parseFloat(expected.fc_hz), 1);
  });

  test('sealed box WinISD golden: Fs=40 Vas=7.65L Qes=0.45 Qms=2.94 Re=6.6 Rg=0.1 Vb=6L Ql=10 Qa=100 → Fsc=63.1762Hz Qtc=0.5995', async ({ appPage: page }) => {
    // WinISD's own readout for this driver and box (user-supplied ground truth, verified against
    // the reverse-engineered SEALED_FSC_MODEL.md). The Box tab's Fsc/Qtc must show it, so the
    // source resistance Rg and the Qes/Qms-derived Qts are proven wired in — not just the engine.
    // Tolerances follow the fields' display precision (Fsc 2 dp, Qtc 3 dp) and still fail on the
    // un-fixed no-Rg / stale-Qts value (~63.32 Hz / ~0.575).
    await setFocusedDriverSpecs(page, { Fs_hz: 40, Qes: 0.450, Qms: 2.940, Vas_m3: 0.00765, Re_ohm: 6.6 });
    await setFocusedSeriesResistance(page, 0.1);
    await setFocusedBoxType(page, 'sealed');
    await setFocusedSealedLosses(page, { Ql: 10, Qa: 100 });
    // Two "Volume" fields exist in the DOM (the common row + the PR rear-chamber row); both bind
    // to the same state, so the first is authoritative.
    await fillAndCommit(numInputByLabel(page, 'Volume').first(), '6');

    await expect(fscInput(page)).not.toHaveValue('');
    expect(parseFloat(await fscInput(page).inputValue())).toBeCloseTo(63.1762, 1);
    expect(parseFloat(await qtcInput(page).inputValue())).toBeCloseTo(0.5995, 2);
  });

  test('sealed Fsc/Qtc readouts re-render after volume, losses and driver swap', async ({ appPage: page }) => {
    await setFocusedBoxType(page, 'sealed');
    await boxTab(page).click();

    // On first paint the readouts show numbers.
    let shown = await shownSealedReadouts(page);
    expect(Number.isFinite(parseFloat(shown.fsc)) && Number.isFinite(parseFloat(shown.qtc)), 'numbers at open').toBe(true);

    // 1. Volume edit must move the readout.
    const vbInput = numInputByLabel(page, 'Volume').first();
    await fillAndCommit(vbInput, '6');
    shown = await expectReadoutsMoved(page, shown, 'after volume = 6L');

    await fillAndCommit(vbInput, '40');
    shown = await expectReadoutsMoved(page, shown, 'after volume = 40L');

    // 2. Chamber losses (Ql/Qa, off their defaults of 10 and 100) move Qtc.
    await setFocusedSealedLosses(page, { Ql: 5, Qa: 20 });
    shown = await expectReadoutsMoved(page, shown, 'after losses Ql=5 Qa=20', ['qtc']);

    // 3. A driver swap must move the readouts to the new driver's resonance (the sample carries W5-1138SMF).
    await page.locator('li', { hasText: 'Driver' }).click();
    await page.locator('button.edit-btn', { hasText: 'Select Driver' }).click();
    const picker = page.locator('.wb-modal');
    await picker.locator('.ditem').filter({ hasNotText: 'W5-1138SMF' }).first().click();
    await picker.locator('button.use-btn').click();
    await expect(page.locator('.wb-modal')).toHaveCount(0);
    await expect(page.locator('.driver-id-row input').nth(1)).not.toHaveValue('W5-1138SMF');

    await boxTab(page).click();
    await expectReadoutsMoved(page, shown, 'after the driver swap');
  });

  test('bandpass4 box: 15L rear + 20L front chamber volumes enter and render', async ({ appPage: page }) => {
    // The front-chamber vent length is deliberately not asserted: the Box- and Enclosure-tab Ffc
    // inputs write box.vented.tuning_goal_hz even for bandpass4 while the front-vent solve reads
    // box.bandpass4.chambers.front.tuning_goal_hz, so it cannot solve through the UI (tracked app bug).
    await setFocusedDriverSpecs(page, { Fs_hz: 37, Qts: 0.38, Vas_m3: 0.030 });
    await setFocusedBoxType(page, 'bandpass4');

    await fillAndCommit(numInputByLabel(page, 'Volume').first(), '15');  // rear chamber
    await fillAndCommit(numInputByLabel(page, 'Volume').nth(1), '20');   // front chamber
    expect(parseFloat(await numInputByLabel(page, 'Volume').nth(1).inputValue())).toBeCloseTo(20, 1);
  });

  // BUG_20261016_box-tab-tuning-input-missing-for-bandpass4-and-pr: every two-chamber box has an
  // enterable front-chamber tuning on the Box tab, the 4th-order bandpass included.
  test('a 4th-order bandpass Box tab takes the front chamber tuning', async ({ appPage: page }) => {
    await setFocusedBoxType(page, 'bandpass4');
    const tuning = page.locator('#og-ffc-target');
    await expect(tuning).toBeEditable();
    await fillAndCommit(tuning, '42');
    await expect(tuning).toHaveValue(/^42/);
  });

  test('a CLOSED box never reports a passive-radiator tuning', async ({ appPage: page }) => {
    // A sealed box has no port or radiator, so its only resonance is the sealed Fsc on the
    // Box tab — labelled Fsc, never Fh/Fpr. The enclosure/Vents pane and its PR tuning are
    // dropped entirely for a closed box (no "Passive Radiator" nav entry to report one).
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('#og-box-type').selectOption('sealed');
    // The sample's sealed volume is empty; give it one so Fsc resolves to a real number.
    await fillAndCommit(numInputByLabel(page, 'Volume').first(), '20');

    const readout = page.locator('#og-box-resonance');
    await expect(readout).toBeVisible();
    await expect(page.locator('label[for="og-box-resonance"]')).toHaveText('Fsc');
    const onBox = await readout.inputValue();
    expect(Number(onBox)).toBeGreaterThan(0);

    // Nothing on the page reports a passive-radiator tuning for a closed box.
    await expect(page.locator('.project-nav li', { hasText: 'Passive Radiator' })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Fpr');
  });

  test('the box cut-through diagram sits at the same x for every box type', async ({ appPage: page }) => {
    await page.locator('.project-nav li', { hasText: /^Box$/ }).click();
    const select = page.locator('#og-box-type');
    const types = await select.locator('option').evaluateAll(os => os.map(o => {
      if (!(o instanceof HTMLOptionElement)) throw new Error('locator("option") matched a non-<option> element');
      return o.value;
    }));
    expect(types.length).toBeGreaterThan(3);

    const lefts: Record<string, number> = {};
    for (const t of types) {
      await select.selectOption(t);
      const diagram = (await page.locator('.box-diagram-col').boundingBox())!;
      const row = (await page.locator('.box-tab-row').boundingBox())!;
      lefts[t] = Math.round(diagram.x - row.x);       // offset within the pane, viewport-independent
    }
    const distinct = [...new Set(Object.values(lefts))];
    expect(distinct, `diagram x per box type: ${JSON.stringify(lefts)}`).toHaveLength(1);
  });
});
