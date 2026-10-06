import {expect, focusedPortVelocityLimit, focusedVentLengthDq, openAProject, setFocusedBoxType, setFocusedVentedDesign, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur, fillAndCommit, numInputByLabel, PageOps, setNumField} from '../fixtures/numField.js';

/**
 * The Original shell's Vented tab (the dynamic enclosure tab of a vented box): the vent group
 * (volume, target tuning Fb, port diameter, solved length), the vent count and shape, the
 * 1st port resonance readout and the port velocity limit. Box-type selection is the Box tab's.
 */

test.beforeEach(async ({ page }) => {
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
    test('Number of Vents shows one port by default and offers the registry\'s 1..4', async ({ page }) => {
      await openVentedTab(page);
      const count = page.locator('select#vent-count');
      await expect(count).toHaveValue('1');
      await expect(count.locator('option')).toHaveCount(4);
    });

    test('picking two vents makes the solved port length longer than with one', async ({ page }) => {
      await openVentedTab(page);
      const length = page.locator('#og-vent-length');
      await expect(length).not.toHaveValue(/^[—\s]*$/);
      const one = parseFloat(await length.inputValue());
      expect(one).toBeGreaterThan(0);

      await page.locator('select#vent-count').selectOption('2');
      await expect.poll(async () => parseFloat(await length.inputValue())).toBeGreaterThan(one);
    });
  });

  test.describe('vent shape and end correction', () => {
    test('the port end correction shows Two free ends by default, not blank', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const endSel = page.locator('.field', { hasText: 'End Correction' }).locator('select');
      await expect(endSel).toHaveValue(/0\.613/);
      await expect(endSel.locator('option:checked')).toContainText('Two free ends');
    });

    test('the vent shape offers slotted, and slotted inputs are reachable', async ({ page }) => {
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
  });

  test.describe('target tuning', () => {
    test('the vented box calls Fb the TARGET, and says what it drives', async ({ page }) => {
      const field = page.locator('#og-fb-target-field');
      await expect(field.locator('label')).toHaveText('Target Tuning Freq');
      await expect(field).toHaveAttribute('title', /port dimension/i);
    });

    test('a target the port cannot reach is reported, and the length shows as unbuildable', async ({ page }) => {
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
      // negative length, which is not a length, so the readout is left unavailable, redlined (the
      // `.impossible` class), and the DQ flag is genuinely set in the model.
      await expect(page.locator('#og-vent-length')).toHaveValue('');
      await expect(page.locator('#og-vent-length')).toHaveClass(/impossible/);
      // The mark sits on the field the solve FAILED to produce — the vent's own length — not on
      // the target that was asked for.
      const dq = await focusedVentLengthDq(page);
      expect(dq.unreachable).toBe(true);   // the DQ aggregation is on, not just the visual
      expect(dq.dqCount).toBeGreaterThan(0);
    });

    // Bug (John, live on his phone, 2026-10-01): clearing an entered Target Tuning Freq left BOTH
    // it and Vent length stuck on the read-only "nothing entered" branch — the template only ever
    // rendered an input for the 'E' state, so once a clear drove both to 'N' there was no element
    // left to type into. "Unrecoverable" (his word) without reloading the project from disk.
    //
    // Fixed two ways: the template now allows typing into the 'N' state (a driver with no T/S specs
    // still falls back to this — there is nothing to compute an alignment from). But where the
    // driver DOES resolve, John's own follow-up ("clear ... should probably default to ... an
    // alignment") is the better recovery: `clearVentField` now calls `Box.resetVentedAlignment()`,
    // so the pair comes back ALIVE with a real design (QB3) instead of merely blank-but-typeable.
    test('clearing Target Tuning Freq re-derives a QB3 design, not a dead blank', async ({ page }) => {
      const pageOps = new PageOps(page);
      await pageOps.setNum('#og-fb-target', '40');
      await expect(page.locator('#og-fb-target')).toHaveValue('40.00');

      await fillAndCommit(page.locator('#og-fb-target'), '');
      // Still the live entered input (not the readonly `#og-fb-target-field > input` branch with no
      // id) — AND non-empty: the default alignment re-derived a real tuning, not a dead blank.
      await expect(page.locator('#og-fb-target')).toBeVisible();
      const fb = Number(await page.locator('#og-fb-target').inputValue());
      expect(fb).toBeGreaterThan(0);
      expect(fb, 'a different design, not the stale 40 surviving the clear').not.toBeCloseTo(40, 1);

      // Vent length is the pair's now-calculated side — a real length, not the '—'/impossible mark.
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      await expect(page.locator('#og-vent-length')).not.toHaveValue('');
      await expect(page.locator('#og-vent-length')).not.toHaveClass(/impossible/);
    });

    // John, 2026-10-06: "vent length should be editable". Typing a length while the target tuning
    // is entered makes the length the entered side and the tuning the calculated one.
    test('vent length is editable while the target tuning is entered, and moves the tuning', async ({ page }) => {
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
    test('target tuning and vent length each recalculate the other, the port size fixed', async ({ page }) => {
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
    test('the Vents pane carries the SAME editable target tuning as the Box tab', async ({ page }) => {
      const pageOps = new PageOps(page);
      await pageOps.setNum('#og-fb-target', '42');

      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const ventField = page.locator('#og-vent-fb-target-field');
      await expect(ventField.locator('label')).toHaveText('Target Tuning Freq');
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
    test('a 30L box with a 5cm bore tuned to Fb=37.9Hz solves a 10.6cm port, and the target is one value on two tabs', async ({ page }) => {
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

    test('the Vented "1st port resonance" shows the vent pipe resonance c/(2·ventL), not the box tuning', async ({ page }) => {
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

    test('the port velocity limit is a per-project setting, 17 m/s by default', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Vented' }).click();
      const field = page.locator('#og-vent-velocity-limit');
      await expect(field).toHaveValue(/^17(\.0+)?$/);
      await fillAndBlur(field, '25');
      await expect.poll(() => focusedPortVelocityLimit(page)).toBe(25);
    });
  });

  test.describe('layout', () => {
    test('the vented enclosure tab has no box-type selector', async ({page}) => {
      await page.locator('.project-nav li', {hasText: 'Vented'}).click();
      await expect(page.locator('#vent-count')).toBeVisible();          // we are on the vents pane
      await expect(page.locator('#og-box-type-enclosure')).toHaveCount(0);
    });
  });
});
