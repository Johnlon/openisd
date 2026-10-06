/**
 * The mobile Box tab. The FIELD WIRING itself (what a box-type change or a volume edit means)
 * is proven once, in `packages/ui/test/hooks/boxFields.test.ts`'s `createSelectedBox`/
 * `createBoxVolume` suites — the same functions this tab calls. These specs prove the UI is
 * correctly WIRED to that shared logic, not that the logic itself is correct.
 *
 * The sample fixture (`SAMPLE_PROJECT_OWPR`) opens as a VENTED box with no T/S params entered —
 * its own default, unrelated to this tab. Tests that care which box type is active select it
 * explicitly rather than assuming sealed.
 *
 * The alignment sheet and the box-losses sheet opened from this tab are `mobile-alignment-popup`
 * and `mobile-box-losses-popup`.
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {renameFocusedProject, setFocusedBoxType} from '../fixtures/focusedProjectSeam.js';
import {forceMobileSkin, mobileFieldRow, openMobileMenu} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

function volumeInput(page: Page) {
  return mobileFieldRow(page, 'Volume').locator('input').first();
}

test.describe('MobileBoxTab', () => {
  // John, 2026-10-06: "does it line up on the screen". A UIField row (Volume) and an older row
  // (Target tuning) put the box, ▲▼ and unit at the same x.
  test('the Volume row lines up with the Target tuning row below it', async ({ page }) => {
    const edges = async (label: string) => {
      const row = page.locator('.mob-ui-field, .mob-field-row').filter({ hasText: label }).first();
      const box = async (sel: string) => (await row.locator(sel).first().boundingBox()) ?? { x: NaN, width: NaN };
      const input = await box('input'), up = await box('button:has-text("▲")'), unit = await box('.ui-field-unit, .mob-unit');
      return [input.x, input.x + input.width, up.x, unit.x].map(Math.round);
    };
    expect(await edges('Volume')).toEqual(await edges('Target tuning'));
  });
  // bugs/BUG_20261005_no-common-ui-field-component.md: "just show errors" + "yes press alignment".
  test('emptying the box volume leaves it blank with a ⚠ that names the Alignment button', async ({ page }) => {
    const row = mobileFieldRow(page, 'Volume').first();
    await row.locator('input').fill('');
    await row.locator('input').blur();
    await expect(row.locator('input')).toHaveValue('');
    await row.locator('.ui-field-dq-btn').click();
    await expect(row.locator('.ui-field-note')).toContainText('Box volume is blank');
    await expect(row.locator('.ui-field-note')).toContainText('Alignment');
  });

  test('shows the box-type select, the enclosure diagram, and a volume field', async ({ page }) => {
    await expect(page.locator('#mob-box-type')).toBeVisible();
    await expect(page.locator('.mob-diagram')).toBeVisible();
    await expect(page.locator('.ui-field-label', { hasText: 'Volume' }).first()).toBeVisible();
  });

  test('editing the volume writes the value through to the field', async ({ page }) => {
    const input = mobileFieldRow(page, 'Volume').locator('input').first();
    await input.fill('40');
    await input.blur();
    await expect(input).toHaveValue(/40/);
  });

  test('the Qtc row shows only for a sealed box', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('sealed');
    await expect(page.locator('.mob-field-label', { hasText: 'Qtc' })).toBeVisible();
    await expect(page.locator('.mob-field-label', { hasText: 'Fsc' })).toBeVisible();

    await page.locator('#mob-box-type').selectOption('vented');
    await expect(page.locator('.mob-field-label', { hasText: 'Qtc' })).toHaveCount(0);
    // Bug (John, 2026-09-29): there is no tab literally named "Enclosure" — the hint must name the
    // tab bar's own dynamic label ("Vented" here) instead of a hardcoded string.
    await expect(page.locator('.mob-hint', { hasText: '"Vented" tab' })).toBeVisible();
  });

  // Same flex-shrink clipping bug as the Advanced tab's scroll test (see mobile-advanced-tab).
  test('scrolls to its last button (Box losses) instead of clipping it', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 700 });
    const lastControl = page.locator('.mob-btn', { hasText: 'Box losses' });
    await lastControl.scrollIntoViewIfNeeded();
    await expect(lastControl).toBeVisible();
  });

  // John, 2026-10-02: 6th-order and ABC boxes showed one chamber with volume 0 on mobile.
  for (const boxType of ['bandpass4', 'bandpass6', 'abc']) {
    test(`${boxType}: the Box tab has a Front chamber volume that steps`, async ({ page }) => {
      await page.locator('#mob-box-type').selectOption(boxType);
      const panel = page.locator('.mob-panel', { has: page.locator('.mob-panel-head', { hasText: 'Front chamber' }) });
      const input = panel.locator('input');
      await expect(input).toHaveCount(1);
      const before = Number(await input.inputValue());
      await panel.locator('.num-stepper-btn').first().click();
      expect(Number(await input.inputValue())).toBeGreaterThan(before);
    });
  }

  // The box-type switch defaults matrix John asked for (2026-09-29): for each of sealed / vented /
  // box-passive-radiator, switching to each OTHER simulatable type must "work immediately" — no
  // blank/zero volume, no missing vent/PR geometry — instead of the blank-field cascade
  // BUG_20260929_box-type-switch-leaves-volume-zero describes. The domain rule is
  // `OpenISDBox.applyStartingValues`, run by `boxType.set()`; these prove the seam from the select
  // to it. bandpass4/6/abc are a follow-up (dual-chamber geometry).
  //
  // Seeded from COMPLETE_DRIVER_PROJECT_OWPR (real Fs/Qes/Vas; the default sample has no T/S
  // params, so the guard would never fire), its box type then set through the domain.
  test.describe('switching box type', () => {
    async function startAs(page: Page, boxType: 'sealed' | 'vented' | 'box-passive-radiator'): Promise<void> {
      await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await setFocusedBoxType(page, boxType);
    }

    // Each helper starts by returning to the Box tab: they are chained within one test.
    async function expectSealedReady(page: Page): Promise<void> {
      await page.locator('.mob-tab', { hasText: 'Box' }).click();
      await page.locator('#mob-box-type').selectOption('sealed');
      await expect(volumeInput(page)).not.toHaveValue('0.00');
      await expect(volumeInput(page)).not.toHaveValue('');
    }

    async function expectVentedReady(page: Page): Promise<void> {
      await page.locator('.mob-tab', { hasText: 'Box' }).click();
      await page.locator('#mob-box-type').selectOption('vented');
      await expect(volumeInput(page)).not.toHaveValue('0.00');
      await page.locator('.mob-tab', { hasText: 'Vented' }).click();
      const targetTuning = mobileFieldRow(page, 'Target Tuning Freq').locator('input');
      await expect(targetTuning).not.toHaveValue('');
      await expect(targetTuning).not.toHaveValue('0.00');
      await expect(mobileFieldRow(page, 'Vent diameter').locator('input')).not.toHaveValue('0.00');
    }

    async function expectPassiveRadiatorReady(page: Page): Promise<void> {
      await page.locator('.mob-tab', { hasText: 'Box' }).click();
      await page.locator('#mob-box-type').selectOption('box-passive-radiator');
      await expect(volumeInput(page)).not.toHaveValue('0.00');
      await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();
      // The PR name is an editable box since 1b15a8f9, so it is a value, not page text.
      await expect(page.locator('#mob-pr-name')).toHaveValue('ReplaceMe');
      await expect(mobileFieldRow(page, 'Sd').locator('input')).not.toHaveValue('0.00');
    }

    // eslint-disable-next-line playwright/expect-expect -- assertions live in the shared expect*Ready() helpers above
    test('from sealed, switching to vented then passive radiator both work immediately', async ({ page }) => {
      await startAs(page, 'sealed');
      await expectVentedReady(page);
      await expectPassiveRadiatorReady(page);
    });

    // eslint-disable-next-line playwright/expect-expect -- assertions live in the shared expect*Ready() helpers above
    test('from vented, switching to sealed then passive radiator both work immediately', async ({ page }) => {
      await startAs(page, 'vented');
      await expectSealedReady(page);
      await expectPassiveRadiatorReady(page);
    });

    // eslint-disable-next-line playwright/expect-expect -- assertions live in the shared expect*Ready() helpers above
    test('from passive radiator, switching to sealed then vented both work immediately', async ({ page }) => {
      await startAs(page, 'box-passive-radiator');
      await expectSealedReady(page);
      await expectVentedReady(page);
    });
  });

  // Switching between open projects (menu → open projects) must show the box type of the project
  // switched TO: the tab bar's enclosure tab and the Box tab's box type follow it. John,
  // 2026-10-04: "when I switch project to passive in the mobile app the tabs don't reorganize to a
  // pr type box or repaint for my box, shows last opened box".
  test.describe('switching project', () => {
    /** Names and types the project the beforeEach opened, then opens a second one (complete
     *  driver, so a box-type change has T/S params to compute from) and names and types that. */
    async function openTwoProjects(
      page: Page,
      first: { name: string; boxType: 'sealed' | 'vented' },
      second: { name: string; boxType: 'vented' | 'box-passive-radiator' },
    ): Promise<void> {
      await setFocusedBoxType(page, first.boxType);
      await renameFocusedProject(page, first.name);
      await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await setFocusedBoxType(page, second.boxType);
      await renameFocusedProject(page, second.name);
    }

    async function switchTo(page: Page, name: string): Promise<void> {
      await openMobileMenu(page);
      await page.locator('.mob-open-project-name', { hasText: name }).click();
    }

    test('between a vented and a passive radiator project repaints the tabs and the Box tab', async ({ page }) => {
      await openTwoProjects(page, { name: 'Vented one', boxType: 'vented' }, { name: 'Radiator one', boxType: 'box-passive-radiator' });
      const tabs = page.locator('.mob-tab');
      await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(1);

      await switchTo(page, 'Vented one');
      await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(0);
      await expect(tabs.filter({ hasText: 'Vented' })).toHaveCount(1);
      await tabs.filter({ hasText: 'Box' }).click();
      await expect(page.locator('#mob-box-type')).toHaveValue('vented');

      await switchTo(page, 'Radiator one');
      await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(1);
      await expect(page.locator('#mob-box-type')).toHaveValue('box-passive-radiator');
    });

    test('while the Box tab is showing repaints it and the tab bar', async ({ page }) => {
      await openTwoProjects(page, { name: 'Vented two', boxType: 'vented' }, { name: 'Radiator two', boxType: 'box-passive-radiator' });
      const tabs = page.locator('.mob-tab');
      await tabs.filter({ hasText: 'Box' }).click();
      await expect(page.locator('#mob-box-type')).toHaveValue('box-passive-radiator');

      await switchTo(page, 'Vented two');
      await expect(page.locator('#mob-box-type')).toHaveValue('vented');
      await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(0);

      await switchTo(page, 'Radiator two');
      await expect(page.locator('#mob-box-type')).toHaveValue('box-passive-radiator');
      await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(1);
    });

    test('while the Passive Radiator tab is showing leaves a tab that fits the new box', async ({ page }) => {
      await openTwoProjects(page, { name: 'Vented three', boxType: 'vented' }, { name: 'Radiator three', boxType: 'box-passive-radiator' });
      const tabs = page.locator('.mob-tab');
      await tabs.filter({ hasText: 'Passive Radiator' }).click();
      await expect(page.getByText('Select passive radiator')).toBeVisible();

      await switchTo(page, 'Vented three');
      await expect(page.getByText('Select passive radiator')).toHaveCount(0);
      await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(0);
    });

    test('from a vented project to a sealed one on the Box tab repaints it', async ({ page }) => {
      await openTwoProjects(page, { name: 'w5 sealed', boxType: 'sealed' }, { name: 'w5 vented', boxType: 'vented' });
      const tabs = page.locator('.mob-tab');
      await tabs.filter({ hasText: 'Box' }).click();
      await expect(page.locator('#mob-box-type')).toHaveValue('vented');

      await switchTo(page, 'w5 sealed');
      await expect(page.locator('#mob-box-type')).toHaveValue('sealed');
      await expect(tabs.filter({ hasText: 'Vented' })).toHaveCount(0);

      await switchTo(page, 'w5 vented');
      await expect(page.locator('#mob-box-type')).toHaveValue('vented');
      await expect(tabs.filter({ hasText: 'Vented' })).toHaveCount(1);
    });
  });
});
