/**
 * WIRING contract: the Box tab's Fsc/Qtc readouts must track the live domain
 * (`box.sealed.resonance_hz`/`q_tc`) after EVERY input that affects them — volume,
 * chamber losses, and a driver swap.
 *
 * The assertion is PHYSICS-AGNOSTIC: it compares the rendered number to the live domain
 * cell at the field's display precision. It never hardcodes a frequency/Qtc value, so it
 * still passes when the engine numbers change — it exists to catch "the value is right,
 * but the screen never re-renders" (the stale-readout bug where the Fsc input stayed at
 * 54.81 through every edit while the live cell moved).
 *
 * Paired UI/logic split rule: readouts must live in the hook layer (composables own the
 * `computed`s; the component only renders), otherwise this wiring is untestable — and the
 * stale-readout bug is exactly what that untestable seam concealed.
 */
import { test, expect, openAProject } from '../fixtures.js';
import type { Page } from '@playwright/test';

interface LiveReadouts {
  fsc: number | null;
  qtc: number | null;
}

async function liveReadouts(page: Page): Promise<LiveReadouts> {
  return page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    const p = s.requireFocusedProject();
    const sealed = p.box.sealed;
    return {
      fsc: sealed.resonance_hz.get().value,
      qtc: sealed.q_tc.get().value,
    };
  });
}

function numInputByLabel(page: Page, labelText: string) {
  return page.locator('label').filter({ hasText: labelText }).locator('..').locator('input[type="number"]');
}

async function setField(page: Page, label: string, value: number) {
  const input = numInputByLabel(page, label).first();
  await input.fill(String(value));
  await input.press('Tab');
}

async function renderedValues(page: Page) {
  const fsc = parseFloat(await page.locator('#og-box-resonance').inputValue());
  const qtc = parseFloat(await page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input').inputValue());
  return { fsc, qtc };
}

async function expectReadoutTracks(page: Page, message: string) {
  const rendered = await renderedValues(page);
  const live = await liveReadouts(page);
  expect(Math.abs(rendered.fsc - (live.fsc ?? NaN)), `${message}: rendered Fsc ${rendered.fsc} vs live ${live.fsc}`).toBeLessThan(0.005);
  expect(Math.abs(rendered.qtc - (live.qtc ?? NaN)), `${message}: rendered Qtc ${rendered.qtc} vs live ${live.qtc}`).toBeLessThan(0.0005);
}

test('sealed Fsc/Qtc readouts re-render after volume, losses and driver swap', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);

  await page.locator('li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('sealed');

  // Sanity: on first paint the readout must already equal the live domain cell.
  await expectReadoutTracks(page, 'at open');

  // 1. Volume edit must move the readout.
  const vbInput = numInputByLabel(page, 'Volume').first();
  await vbInput.fill('6');
  await vbInput.press('Tab');
  await expectReadoutTracks(page, 'after volume = 6L');

  await vbInput.fill('40');
  await vbInput.press('Tab');
  await expectReadoutTracks(page, 'after volume = 40L');

  // 2. Chamber losses (Ql/Qa) must move the readout.
  await page.locator('button.link-btn', { hasText: 'Advanced' }).first().click();
  await setField(page, 'Leakage Ql', 10);
  await setField(page, 'Absorption Qa', 100);
  await page.locator('button.ok-btn', { hasText: 'OK' }).click();
  await expectReadoutTracks(page, 'after losses Ql=10 Qa=100');

  // 3. A driver swap must move the readout to the new driver's resonance.
  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Select Driver' }).click();
  const picker = page.locator('.wb-modal');
  await picker.locator('input.filter').fill('W5-1138SMF');
  await picker.locator('.ditem', { hasText: 'W5-1138SMF' }).first().click();
  await picker.locator('button.use-btn').click();
  await expect(page.locator('.wb-modal')).toHaveCount(0);
  await expect(page.locator('.driver-id-row input').nth(1)).toHaveValue('W5-1138SMF');

  await page.locator('li', { hasText: 'Box' }).click();
  await expectReadoutTracks(page, 'after driver swap to W5-1138SMF');
});