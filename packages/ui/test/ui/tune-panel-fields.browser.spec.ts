import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

async function readVb(page: Page): Promise<number> {
  return page.evaluate(async () => {
    function isAppStateModule(m: unknown): m is typeof import('../../src/logic/appState.js') {
      return typeof m === 'object' && m !== null
        && 'focusedProject' in m && typeof m.focusedProject === 'function';
    }
    const modPath = '/src/logic/appState.ts';
    const mod: unknown = await import(/* @vite-ignore */ modPath);
    if (!isAppStateModule(mod)) throw new Error('appState module did not load as expected');
    const project = mod.focusedProject();
    if (!project) throw new Error('expected a focused project');
    // The sample fixture is VENTED, the complete-driver one is sealed, so read whichever box
    // type the project actually is. Every field answers through `.value`; vented's can be null
    // where sealed's cannot, so only that one needs the check.
    if (project.box.boxType.value === 'vented') {
      const v = project.box.vented.volume_m3.value;
      if (v === null) throw new Error('vented volume is not available');
      return v;
    }
    return project.box.sealed.volume_m3.value;
  });
}

/** Open the Original skin's docked Tune panel on a clean slate. */
async function openTune(page: Page) {
  await page.goto('/');
  await openAProject(page, COMPLETE);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'What-if' }).click();
  const tune = page.locator('.tune-panel');
  await expect(tune).toBeVisible();
  return tune;
}

const tuneField = (page: Page, label: string) =>
  page.locator('.tune-panel .tune-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) });

// ── QO11.5 — an invalid entry is red while typing, before blur ────────────────────────────
test('QO11.5 NumInput: an out-of-range value typed character-by-character goes red before blur', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Box' }).click();

  const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  const before = await vb.inputValue();
  const goodVb = await readVb(page);
  await vb.click();
  await vb.press('Control+a');

  // ONE keystroke. `<input type="number">` reports value === '' for a lone '-', which is the
  // exact moment the field became un-numeric — it must say so, and it must NOT be mistaken for
  // the field having been emptied (which would clear the model out from under the charts).
  await vb.pressSequentially('-');
  await expect(vb).toHaveClass(/inp-bad/);
  await expect(vb).toBeFocused();
  expect(await readVb(page)).toBeCloseTo(goodVb, 9);

  // Typed, not filled: pressSequentially fires the keydowns that put NumInput on its raw-echo
  // path, which is the path `fill()` never exercises.
  await vb.pressSequentially('5');
  await expect(vb).toHaveValue('-5');                 // the keystrokes are echoed, caret intact
  await expect(vb).toHaveClass(/inp-bad/);            // red WHILE the caret is still in the field
  await expect(vb).toBeFocused();
  expect(await readVb(page)).toBeCloseTo(goodVb, 9);  // ...and the bad value never reached the model

  await vb.blur();
  await expect(vb).toHaveValue(before);               // blur reverts to the last good value
  await expect(vb).not.toHaveClass(/inp-bad/);
});

test('QO11.5 NumInput: a full-precision value survives typing and blur — dp is presentation only', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Box' }).click();

  const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  await vb.click();
  await vb.press('Control+a');
  // 6 significant decimals in a field whose display precision is far coarser: the model must
  // keep every one of them, before AND after blur.
  await vb.pressSequentially('12.345678');
  expect(await readVb(page)).toBeCloseTo(0.012345678, 12);
  await vb.blur();
  expect(await readVb(page)).toBeCloseTo(0.012345678, 12);
});
