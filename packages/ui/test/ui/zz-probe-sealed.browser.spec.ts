import { test, expect, openAProject } from '../fixtures.js';
import type { Locator, Page } from '@playwright/test';

function numInputByLabel(page: Page, labelText: string, scope: Locator = page.locator('body')) {
  return scope.locator('label').filter({ hasText: labelText }).locator('..').locator('input[type="number"]');
}

async function setField(page: Page, label: string, value: number, scope?: Locator) {
  const input = numInputByLabel(page, label, scope ?? page.locator('body'));
  await input.first().fill(String(value));
  await input.first().press('Tab');
}

test('probe sealed feed for Tang Band W5-1138SMF from the library', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);

  // Pick the W5-1138SMF from the bundled driver library (tang-band/w5-1138smf/openisd.yml).
  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Select Driver' }).click();
  const picker = page.locator('.wb-modal');
  await picker.locator('input.filter').fill('W5-1138SMF');
  await picker.locator('.ditem', { hasText: 'W5-1138SMF' }).first().click();
  await picker.locator('button.use-btn').click();
  await expect(page.locator('.wb-modal')).toHaveCount(0);
  await expect(page.locator('.driver-id-row input').nth(1)).toHaveValue('W5-1138SMF');

  // Sealed box 6L + WinISD-lossy losses.
  await page.locator('li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('sealed');
  const vbInput = numInputByLabel(page, 'Volume').first();
  await vbInput.fill('6');
  await vbInput.press('Tab');
  await page.locator('button.link-btn', { hasText: 'Advanced' }).first().click();
  await setField(page, 'Leakage Ql', 10);
  await setField(page, 'Absorption Qa', 100);
  await page.locator('button.ok-btn', { hasText: 'OK' }).click();

  // Series source resistance Rg = 0.1 Ω on the Signal tab.
  await page.locator('li', { hasText: 'Signal' }).click();
  await setField(page, 'Series resistance', 0.1);

  await page.locator('li', { hasText: 'Box' }).click();

  const fscBox = await page.locator('#og-box-resonance').inputValue();
  const qtcBox = await page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input').inputValue();
  const fscSection = await page.locator('#og-sealed-enclosure-resonance').inputValue();
  const state = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    const p = s.focusedProject();
    if (!p) return { err: 'no focused project' };
    const sec = p.driver.section;
    const cell = (fn: () => number | null) => { try { const c = fn(); return c ?? null; } catch (e) { return 'ERR:' + (e as Error).message; } };
    const spec = p.driver.spec[sec];
    return {
      section: sec,
      driverOk: true,
      specs: {
        Fs_hz: cell(() => spec.Fs_hz.get().value),
        Qts: cell(() => spec.Qts.get().value),
        Qes: cell(() => spec.Qes.get().value),
        Qms: cell(() => spec.Qms.get().value),
        Vas_m3: cell(() => spec.Vas_m3.get().value),
        Sd_m2: cell(() => spec.Sd_m2.get().value),
        Cms_m_per_N: cell(() => spec.Cms_m_per_N.get().value),
        Re_ohm: cell(() => spec.Re_ohm.get().value),
      },
      box: {
        type: p.box.boxType.get(),
        vb_m3: cell(() => p.box.sealed.volume_m3.get()),
        Ql: cell(() => p.box.sealed.losses.Ql.get()),
        Qa: cell(() => p.box.sealed.losses.Qa.get()),
        resonance_hz: cell(() => p.box.sealed.resonance_hz.get().value),
        q_tc: cell(() => p.box.sealed.q_tc.get().value),
      },
      signal: { Rs_ohm: cell(() => p.Rs_ohm.get()) },
    };
  });

  console.log('PROBE_FSC_BOX=' + fscBox);
  console.log('PROBE_QTC_BOX=' + qtcBox);
  console.log('PROBE_FSC_SECTION=' + fscSection);
  console.log('PROBE_STATE=' + JSON.stringify(state, null, 1));

  expect(state.driverOk).toBe(true);
});