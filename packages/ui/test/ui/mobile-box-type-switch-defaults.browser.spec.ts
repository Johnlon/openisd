/**
 * The box-type-switch defaults matrix John asked for (2026-09-29): for each box type the New
 * Project wizard can start a project as, accepting every wizard default, switching to each OTHER
 * simulatable box type must "work immediately" — no blank/zero volume, no missing vent/PR
 * geometry — instead of the blank-field cascade `BUG_20260929_box-type-switch-leaves-volume-
 * zero.md` describes (Can't plot Group delay / max SPL, "needs tuning_goal_hz, area_m2").
 *
 * Scoped to sealed / vented / box-passive-radiator — the three types
 * `OpenISDBox.applyStartingValues` (packages/design) covers so far. bandpass4/6/abc are its own
 * follow-up (dual-chamber geometry, and 6/abc aren't simulatable at all — "Response model
 * pending" is the correct, not-broken state for those regardless of volume).
 *
 * "Tang Band W5-1138SMF" ("the W5 driver") is the test suite's own 6-driver catalogue's real-T/S-
 * param reference device (mobile-new-project.browser.spec.ts's own TEST_DRIVER) — required here
 * since the defaults this proves need real Qts/Vas/Fs/Sd/Xmax to compute from.
 */
import {expect, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

const TEST_DRIVER = 'Tang Band W5-1138SMF';

/** Drives the wizard to a finished project, accepting every default except the box type itself
 *  (step 3) — mirrors mobile-new-project.browser.spec.ts's own interaction pattern. `.ok-btn` is
 *  shared by every step's "Next >" and step 5's "Create". */
async function createProjectViaWizard(page: Page, boxType: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await page.getByText('New project').click();
  await page.getByText(TEST_DRIVER).click();
  await page.locator('.mob-np-footer .ok-btn').click(); // step 1 -> 2: Next chooses the driver being read
  await page.locator('.mob-np-footer .ok-btn').click(); // step 2 -> 3
  await page.locator('#np-box-type').selectOption(boxType);
  // Box types with no step 4 (bandpass4/6/abc) run a 4-step wizard, not 5 — so "Next" is
  // clicked until the button itself becomes "Create" rather than a fixed number of times.
  const okBtn = page.locator('.mob-np-footer .ok-btn');
  if (boxType === 'box-passive-radiator') {
    await okBtn.click(); // step 3 -> 4: the radiator; Next waits until one is chosen
    await page.locator('#np-pr-select').click();
    await page.locator('button', { hasText: 'Define new PR' }).click();
  }
  while ((await okBtn.first().textContent())?.includes('Next')) {
    await okBtn.first().click();
  }
  // canCreate requires a non-empty name (projName starts ''); the only field on the name step not
  // left at its own default.
  await page.locator('input[type=text]').first().fill(`Test ${boxType}`);
  await okBtn.click(); // -> Create
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
}

function volumeInput(page: Page) {
  return page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
}

/** Every helper below navigates away from the Box tab to check its Enclosure pane, so each one
 *  returns to the Box tab FIRST — defensive against whichever tab the previous helper left the
 *  page on (they're chained within one test). */
async function goToBoxTab(page: Page): Promise<void> {
  await page.locator('.mob-tab', { hasText: 'Box' }).click();
}

async function expectSealedReady(page: Page): Promise<void> {
  await goToBoxTab(page);
  await page.locator('#mob-box-type').selectOption('sealed');
  await expect(volumeInput(page)).not.toHaveValue('0.00');
  await expect(volumeInput(page)).not.toHaveValue('');
}

async function expectVentedReady(page: Page): Promise<void> {
  await goToBoxTab(page);
  await page.locator('#mob-box-type').selectOption('vented');
  await expect(volumeInput(page)).not.toHaveValue('0.00');
  await page.locator('.mob-tab', { hasText: 'Vented' }).click();
  const targetTuningInput = page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: 'Target Tuning Freq' }) }).locator('input');
  await expect(targetTuningInput).not.toHaveValue('');
  await expect(targetTuningInput).not.toHaveValue('0.00');
  const diameterInput = page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: 'Vent diameter' }) }).locator('input');
  await expect(diameterInput).not.toHaveValue('0.00');
}

async function expectPassiveRadiatorReady(page: Page): Promise<void> {
  await goToBoxTab(page);
  await page.locator('#mob-box-type').selectOption('box-passive-radiator');
  await expect(volumeInput(page)).not.toHaveValue('0.00');
  await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();
  await expect(page.getByText('ReplaceMe')).toBeVisible();
  const sdInput = page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: 'Sd' }) }).locator('input');
  await expect(sdInput).not.toHaveValue('0.00');
}

// eslint-disable-next-line playwright/expect-expect -- assertions live in the shared expect*Ready() helpers above
test('starting sealed (wizard default), switching to vented then passive radiator both work immediately', async ({ page }) => {
  await createProjectViaWizard(page, 'sealed');
  await expectVentedReady(page);
  await expectPassiveRadiatorReady(page);
});

// eslint-disable-next-line playwright/expect-expect -- assertions live in the shared expect*Ready() helpers above
test('starting vented (wizard default), switching to sealed then passive radiator both work immediately', async ({ page }) => {
  await createProjectViaWizard(page, 'vented');
  await expectSealedReady(page);
  await expectPassiveRadiatorReady(page);
});

// eslint-disable-next-line playwright/expect-expect -- assertions live in the shared expect*Ready() helpers above
test('starting passive radiator (wizard default), switching to sealed then vented both work immediately', async ({ page }) => {
  await createProjectViaWizard(page, 'box-passive-radiator');
  await expectSealedReady(page);
  await expectVentedReady(page);
});
