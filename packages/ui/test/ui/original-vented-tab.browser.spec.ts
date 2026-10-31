import {expect, openAProject, setFocusedBoxType, setFocusedVentedDesign, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur, fillAndCommit, numInputByLabel, PageOps, setNumField} from '../fixtures/numField.js';

/**
 * The Original shell's Vented tab (the dynamic enclosure tab of a vented box): the vent group
 * (volume, target tuning Fb, port diameter, solved length), the vent count and shape, the
 * 1st port resonance readout and the port velocity limit. Box-type selection is the Box tab's.
 */

test.beforeEach(async ({ appPage: page }) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'vented');
});

/** A 40 Hz target gives the vent count a solvable port; then show the Vented tab. */
async function openVentedTab(page: Page): Promise<void> {
  await new PageOps(page).setNum('#og-fb-target', '40');
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
}

test.describe('Original Vented tab', () => {
  test.describe('vent count', () => {
    test('Number of Vents shows one port by default and offers the registry\'s 1..4', async ({ appPage: page }) => {
      await openVentedTab(page);
      const count = page.locator('select#vent-count');
      await expect(count).toHaveValue('1');
      await expect(count.locator('option')).toHaveCount(4);
    });

    test('picking two vents makes the solved port length longer than with one', async ({ appPage: page }) => {
      await openVentedTab(page);
      const length = page.locator('#og-vent-length');
      await expect(length).not.toHaveValue(/^[—\s]*$/);
      const one = parseFloat(await length.inputValue());
      expect(one).toBeGreaterThan(0);

      await page.locator('select#vent-count').selectOption('2');
      await expect.poll(async () => parseFloat(await length.inputValue())).toBeGreaterThan(one);
    });

    // WinISD's Cross area box reads all ports together (bugs/BUG_20261019_openisd-vents-tab-cross-area-is-one-port-winisd-shows-all-ports.md).
    test('picking two vents makes the Cross area box show twice the one-port area', async ({ appPage: page }) => {
      await openVentedTab(page);
      const area = page.locator('.field', { hasText: 'Cross area' }).locator('input');
      const one = parseFloat(await area.inputValue());
      expect(one).toBeGreaterThan(0);
      await page.locator('select#vent-count').selectOption('2');
      await expect.poll(async () => parseFloat(await area.inputValue()) / one).toBeCloseTo(2, 2);
    });
  });

  test.describe('vent shape and end correction', () => {
    test('the port end correction shows Two free ends by default, not blank', async ({ appPage: page }) => {
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const endSel = page.locator('.field', { hasText: 'End Correction' }).locator('select');
      await expect(endSel).toHaveValue(/0\.613/);
      await expect(endSel.locator('option:checked')).toHaveText('Free (0.613)');
      await expect(endSel.locator('option:checked')).toHaveAttribute('title','Two free ends');
    });

    test('the vent shape offers slotted, and slotted inputs are reachable', async ({ appPage: page }) => {
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const shape = page.locator('.field', { hasText: 'Shape' }).locator('select');
      await expect(shape.locator('option[value="slotted"]')).toHaveCount(1);
      await shape.selectOption('slotted');
      const width = page.locator('.field', { hasText: 'Slot width' }).locator('input');
      const height = page.locator('.field', { hasText: 'Slot height' }).locator('input');
      await expect(width).toBeVisible();
      await expect(height).toBeVisible();
      await fillAndBlur(width, '5');
      await expect(width).toHaveValue(/5/);
    });

    // bugs/BUG_20261005_no-common-ui-field-component.md: an emptied box clears the value, never
    // stores 0. A cleared diameter keeps the cross area as entered and is calculated from it
    // (John, 2026-10-16); the slot width goes back to the driver's Dd (John, 2026-10-09).
    test('emptied vent dimensions keep the partner or settle instead of becoming 0', async ({ appPage: page }) => {
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const diameter = page.locator('.ui-field', { hasText: 'Vent diameter' }).locator('input');
      const area = page.locator('.field', { hasText: 'Cross area' }).locator('input');
      const areaBefore = await area.inputValue();
      await fillAndBlur(diameter, '');
      await expect(diameter).toHaveValue(/^5(\.0+)?$/);
      await expect(diameter).toHaveClass(/value-c/);
      await expect(area).toHaveValue(areaBefore);
      await page.locator('.field', { hasText: 'Shape' }).locator('select').selectOption('slotted');
      const width = page.locator('.ui-field', { hasText: 'Slot width' }).locator('input');
      await fillAndBlur(width, '7');
      await expect(width).toHaveValue(/7/);
      await fillAndBlur(width, '');
      await expect(width).not.toHaveValue('');
      await expect(width).not.toHaveValue(/^0(\.0*)?$/);
    });
  });

  test.describe('tuning frequency', () => {
    test('the vented box names its tuning frequency and explains the port dimensions', async ({ appPage: page }) => {
      const field = page.locator('#og-fb-target-field');
      await expect(field.locator('label')).toHaveText('Tuning freq (Fb)');
      await expect(field).toHaveAttribute('title', /port dimension/i);
    });

    test('a target the port cannot reach is reported, and the length shows as unbuildable', async ({ appPage: page }) => {
      const pageOps = new PageOps(page);

      // 40 Hz in the fixture's 7 L box with its 5 cm vent is reachable — no warning.
      await pageOps.setNum('#og-fb-target', '40');
      await expect(page.locator('#og-fb-unreachable')).toHaveCount(0);

      // 200 Hz is not: the highest this volume + 5 cm vent can tune to is the physical length
      // zero, whose acoustic length is still the end correction — 134 Hz — so the solve is negative.
      await pageOps.setNum('#og-fb-target', '200');
      await expect(page.locator('#og-fb-unreachable')).toBeVisible();
      await expect(page.locator('#og-fb-unreachable')).toContainText('134 Hz');

      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      await expect(page.locator('#og-vent-unreachable')).toBeVisible();
      // The failure is SHOWN, not hidden behind a buildable-looking floor: the solve would be a
      // negative length, which is not a length, so the readout is left unavailable, marked with
      // the row's ⚠, and the DQ flag is genuinely set in the model.
      await expect(page.locator('#og-vent-length')).toHaveValue('');
      await expect(page.locator('.ui-field', { has: page.locator('#og-vent-length') }).locator('.ui-field-dq-btn')).toBeVisible();
      // The mark sits on the field the solve FAILED to produce — the vent's own length — not on
      // the target that was asked for.
      await expect(page.locator('.ui-field', { has: page.locator('#og-vent-length') }).locator('.ui-field-dq-btn'))
        .toHaveAttribute('title', /This port can't reach that tuning/);
    });

    // John, 2026-10-16: clearing the entered target tuning keeps the vent length at its value as
    // entered, and the tuning shows what that length gives, calculated. The box volume is never
    // overwritten, and nothing goes blank (the 2026-10-01 blank-pair bug stays fixed).
    test('clearing Tuning freq keeps the vent length and the volume; the tuning is calculated', async ({ appPage: page }) => {
      const pageOps = new PageOps(page);
      await pageOps.setNum('#og-fb-target', '40');
      // T607 (62151d66e): an entered value keeps the precision it was typed with, so 40 shows as 40; only the calculated tuning below shows 40.00.
      await expect(page.locator('#og-fb-target')).toHaveValue('40');
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const length = page.locator('#og-vent-length');
      const lengthBefore = await length.inputValue();
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      const volumeBefore = await page.locator('#og-box-volume').inputValue();

      await fillAndCommit(page.locator('#og-fb-target'), '');

      await expect(page.locator('#og-fb-target')).toHaveClass(/value-c/);
      await expect(page.locator('#og-fb-target')).toHaveValue('40.00');
      await expect(page.locator('#og-box-volume')).toHaveValue(volumeBefore);
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      await expect(length).toHaveClass(/value-e/);
      await expect(length).toHaveValue(lengthBefore);
      await expect(page.locator('.ui-field', { has: length }).locator('.ui-field-dq-btn')).toHaveCount(0);
    });

    // John, 2026-10-06: "vent length should be editable". Typing a length while the target tuning
    // is entered makes the length the entered side and the tuning the calculated one.
    test('vent length is editable while the target tuning is entered, and moves the tuning', async ({ appPage: page }) => {
      const pageOps = new PageOps(page);
      await pageOps.setNum('#og-fb-target', '40');
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const length = page.locator('#og-vent-length');
      await expect(length).toBeEditable();
      const before = Number(await length.inputValue());
      await fillAndCommit(length, String(Math.round(before * 2)));
      await expect(length).toHaveClass(/value-e/);
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      await expect.poll(async () => Number(await page.locator('#og-fb-target-field input').inputValue()),
        'a longer vent must lower the tuning').toBeLessThan(40);
    });

    // John, 2026-10-06: "target freq and vent len editable, relative to each other with fixed dim
    // port". Whichever was typed last is entered; the other is recalculated; the port's
    // cross-section never moves.
    test('target tuning and vent length each recalculate the other, the port size fixed', async ({ appPage: page }) => {
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const fb = page.locator('#og-vent-fb-target'), len = page.locator('#og-vent-length');
      const area = async () => page.locator('.field', { hasText: 'Cross area' }).locator('input').inputValue();
      const area0 = await area();
      await fillAndCommit(fb, '40');
      await expect(fb).toHaveClass(/value-e/); await expect(len).toHaveClass(/value-c/);
      const lenAt40 = Number(await len.inputValue());
      await fillAndCommit(len, String(Math.round(lenAt40 * 2)));
      await expect(len).toHaveClass(/value-e/); await expect(fb).toHaveClass(/value-c/);
      expect(Number(await fb.inputValue()), 'a longer vent lowers the tuning').toBeLessThan(40);
      await fillAndCommit(fb, '45');
      await expect(fb).toHaveClass(/value-e/); await expect(len).toHaveClass(/value-c/);
      expect(Number(await len.inputValue()), 'a higher tuning shortens the vent').toBeLessThan(lenAt40);
      expect(await area()).toBe(area0);
    });

    // The human's QO11 ruling: the target tuning is the port solver's INPUT, so it belongs on the
    // Vents pane as well as the Box tab — the user sizing a vent must see, and be able to change,
    // the target those dimensions were solved for. WinISD shows it only on its Box screen; this is
    // a deliberate OpenISD addition. One stored `P.Fb`, two places to see and edit it.
    test('the Vents pane carries the SAME editable target tuning as the Box tab', async ({ appPage: page }) => {
      const pageOps = new PageOps(page);
      await pageOps.setNum('#og-fb-target', '42');

      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const ventField = page.locator('#og-vent-fb-target-field');
      await expect(ventField.locator('label')).toHaveText('Tuning freq (Fb)');
      await expect(page.locator('#og-vent-fb-target')).toHaveValue('42.00');

      // Vents → Box: editing here must move the Box tab's field AND re-solve the vent length.
      const lenBefore = await page.locator('#og-vent-length').inputValue();
      await pageOps.setNum('#og-vent-fb-target', '30');
      const lenAfter = await page.locator('#og-vent-length').inputValue();
      expect(Number(lenAfter), 'a lower target must lengthen the vent').toBeGreaterThan(Number(lenBefore));

      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      await expect(page.locator('#og-fb-target')).toHaveValue('30.00');

      // Box → Vents: the other direction of the same single value.
      await pageOps.setNum('#og-fb-target', '35');
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      await expect(page.locator('#og-vent-fb-target')).toHaveValue('35.00');
    });
  });

  test.describe('port solve and readouts', () => {
    test('a 30L box with a 5cm bore tuned to Fb=37.9Hz solves a 10.6cm port, and the target is one value on two tabs', async ({ appPage: page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      // Volume: multiple "Volume" labels exist (tune + enclosure panes)
      await fillAndCommit(numInputByLabel(page, 'Volume').first(), '30');  // scale=1000: 30 → stores 0.030 m³

      // Go to Vented (Enclosure) tab
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();

      await setNumField(page, 'Vent diameter', 5);  // scale=100: 5 → stores 0.05 m
      await fillAndCommit(page.locator('#og-vent-fb-target'), '37.9');

      // Helmholtz resonator: Fb = (C/2π)·√(Sp/(Leff·Vb)); Sp = π·0.025², Leff = L + end correction.
      const ventLReadout = page.locator('#og-vent-length');
      await expect(ventLReadout).not.toHaveValue('');
      const length = parseFloat(await ventLReadout.inputValue());
      expect(length).toBeCloseTo(10.6, 1);

      // One stored Fb, two renders: the Box tab's target mirrors what was typed on the Vented pane
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      const mirrorFb = parseFloat(await page.locator('#og-fb-target').inputValue());
      expect(mirrorFb).toBeCloseTo(37.9, 1);

      // Wiring both ways: retune the target and the solved length responds; restoring the
      // original target restores the original length.
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      await fillAndCommit(page.locator('#og-vent-fb-target'), '32.0');
      const retuned = parseFloat(await page.locator('#og-vent-length').inputValue());
      expect(retuned).not.toBeCloseTo(10.6, 1);
      await fillAndCommit(page.locator('#og-vent-fb-target'), '37.9');
      const restored = parseFloat(await page.locator('#og-vent-length').inputValue());
      expect(restored).toBeCloseTo(10.6, 1);
    });

    test('the Vented "1st port resonance" shows the vent pipe resonance c/(2·ventL), not the box tuning', async ({ appPage: page }) => {
      // Build a real vent through the same domain seam the UI typing drives: the solver produces
      // ventL, making the resonance readout a real number.
      await setFocusedVentedDesign(page, { volume_m3: 0.06, tuning_hz: 40, diameter_m: 0.1 });
      await page.locator('.project-nav li').nth(2).click(); // dynamic Vents tab
      const field = page.locator('.field', { hasText: '1st port resonance' }).locator('input');
      await expect(field).toHaveValue(/^\d+(\.\d+)?$/);      // vent length solved → finite Hz readout
      const v = Number(await field.inputValue());
      // WinISD's "1st port resonance" = c/(2·physical vent length). A ~10 cm vent → ~1.7 kHz — far
      // above the box Helmholtz tuning (~tens of Hz), the wrong value this assertion pins against.
      expect(v).toBeGreaterThan(500);
    });

    test('the port velocity limit is a per-project setting, 17 m/s by default', async ({ appPage: page }) => {
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const field = page.locator('#og-vent-velocity-limit');
      await expect(field).toHaveValue(/^17(\.0+)?$/);
      await fillAndBlur(field, '25');
      // Leaving the tab and coming back shows the limit the project holds.
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      await expect(field).toHaveValue(/^25(\.0+)?$/);
    });
  });

  test.describe('layout', () => {
    test('the vented enclosure tab has no box-type selector', async ({ appPage: page }) => {
      await page.locator('.project-nav li', {hasText: 'Vented'}).click();
      await expect(page.locator('#vent-count')).toBeVisible();          // we are on the vents pane
      await expect(page.locator('#og-box-type-enclosure')).toHaveCount(0);
    });
  });
});
