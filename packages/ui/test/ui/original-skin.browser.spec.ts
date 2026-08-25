/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The shell — WinISD 0.7.0.950's window, wired to the store/engine. These tests assert
 * the WinISD-fidelity regions: toolbar icons, chart-select dropdown, all 7 tabs, the
 * Placement/Advanced/Listening-place sections, box types, and the box-losses modal.
 * The auto console/network guardrail (fixtures) asserts none of it raises errors.
 */
import { test, expect } from '../fixtures.js';
import type { Locator, Page } from '@playwright/test';

// Decimal places shown in a numeric-input string ("6.10" → 2, "55" → 0, "" → 0).
function decimalsOf(s: string): number {
  const m = s.trim().match(/^-?\d*\.(\d+)$/);
  return m ? m[1].length : 0;
}

// Class-level spinner invariant: a spinner step (Arrow Up/Down) must never GAIN decimal
// places over what the field shows at rest. Each field has a fixed display precision; a
// step that turns "6.00" into "8.94924452476786" is the bug. Asserted over every
// input[type=number] so no field (or second spinner mechanism) can regress unnoticed.
// Returns 1 if the field was actually spun-and-checked, 0 if skipped (hidden / non-numeric).
async function assertSpinnerHoldsDp(input: Locator, label: string): Promise<number> {
  if (!(await input.isVisible()) || !(await input.isEditable())) return 0;
  await input.scrollIntoViewIfNeeded();
  const fieldName = await input.evaluate((el) => el.closest('.field')?.querySelector('label')?.textContent?.trim() || el.getAttribute('aria-label') || '?');
  label = `${label} [${fieldName}]`;
  const before = (await input.inputValue()).trim();
  if (!/^-?\d+(\.\d+)?$/.test(before)) return 0; // skip empty / non-numeric fields
  const dpBefore = decimalsOf(before);
  await input.focus();
  for (let i = 0; i < 6; i++) await input.press('ArrowUp'); // compounding up-steps
  const up = (await input.inputValue()).trim();
  for (let i = 0; i < 12; i++) await input.press('ArrowDown'); // back down through the base
  const down = (await input.inputValue()).trim();
  expect(decimalsOf(up), `${label}: gained decimals spinning UP  "${before}" → "${up}"`).toBeLessThanOrEqual(dpBefore);
  expect(decimalsOf(down), `${label}: gained decimals spinning DOWN "${before}" → "${down}"`).toBeLessThanOrEqual(dpBefore);
  return 1;
}

// Sweep every visible numeric spinner on the currently-active project tab; returns the count checked.
async function sweepActiveTab(page: Page, context: string): Promise<number> {
  const inputs = await page.locator('.original-root .tab-section.active input[type="number"]').all();
  let n = 0;
  for (let i = 0; i < inputs.length; i++) n += await assertSpinnerHoldsDp(inputs[i], `${context} #${i}`);
  return n;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.original-root').waitFor({ state: 'visible' });
});

test('choosing Original swaps to the ported WinISD shell (titlebar, projects, graph)', async ({ page }) => {
  await expect(page.locator('.original-root')).toContainText('WinISD Original Mode');
  await expect(page.locator('.original-root')).toContainText('Projects');
  await expect(page.locator('.original-root')).toContainText('Signal Generator');
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
});

test('the titlebar displays the build datetime', async ({ page }) => {
  const tbCenter = page.locator('.titlebar .tb-center');
  await expect(tbCenter).toBeVisible();
  const text = await tbCenter.innerText();
  expect(text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
});


test('the toolbar carries WinISD\'s icon buttons + chart-select', async ({ page }) => {
  // Toolbar: 8 icon controls (.tb-btn) — Open, New, Save, Revert, Save-As/Export, Manage Drivers,
  // Options, Info — plus the .chart-select control. (Save As merged into Save-As/Export.)
  await expect(page.locator('.toolbar .tb-btn')).toHaveCount(8);
  await expect(page.locator('.toolbar .chart-select .chart-name')).toBeVisible();
});

test('the chart-select dropdown switches the shared GraphPanel', async ({ page }) => {
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
  await page.locator('.chart-select').click();
  await page.locator('.chart-select .menu-item', { hasText: /^Cone excursion$/ }).click();
  await expect(page.locator('.chart-select .chart-name')).toHaveText('Cone excursion');
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
});

test('all seven project tabs render their ported content', async ({ page }) => {
  const nav = page.locator('.project-nav li');
  await expect(nav).toHaveCount(7);

  await nav.filter({ hasText: 'Driver' }).click();
  await expect(page.locator('.content-panel')).toContainText('Placement');
  await expect(page.locator('.content-panel')).toContainText('Advanced options');
  await expect(page.locator('.content-panel')).toContainText('Num. of drivers');

  await nav.filter({ hasText: 'Signal' }).click();
  await expect(page.locator('.content-panel')).toContainText('Listening place');
  await expect(page.locator('.content-panel')).toContainText('Signal source');

  await nav.filter({ hasText: 'Advanced' }).click();
  await expect(page.locator('.content-panel')).toContainText('Sound velocity');

  await nav.filter({ hasText: 'Project' }).click();
  await expect(page.locator('.content-panel')).toContainText('Description');
});

test('the Box tab exposes all six box types and drives the shared store for supported ones', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const boxSel = page.locator('select#og-box-type');
  await expect(boxSel.locator('option')).toHaveCount(6);

  // Scope pending assertions to the active tab — hidden v-show tabs keep their text in
  // the DOM, so assert on the currently-visible Box section only.
  const boxTab = page.locator('.tab-section.active');
  await boxSel.selectOption('vented');
  await expect(page.locator('#og-box-diagram-vented')).toBeVisible();
  await expect(boxTab).not.toContainText(/response model pending/i);

  await boxSel.selectOption('abc');
  await expect(page.locator('#og-box-diagram-abc')).toBeVisible();
  await expect(boxTab).toContainText(/response model pending/i);
});

test('the Closed (sealed) box hides the dynamic enclosure tab — Volume lives only on the Box tab', async ({ page }) => {
  const nav = page.locator('.project-nav li');
  await expect(nav).toHaveCount(7); // vented default shows the dynamic enclosure/Vents tab

  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('sealed');

  // For a closed box the enclosure tab only duplicated the Box tab's Volume — it is dropped.
  await expect(nav).toHaveCount(6);
  await expect(nav.filter({ hasText: 'Closed' })).toHaveCount(0);

  // Volume is still editable on the Box tab.
  await expect(page.locator('.tab-section.active')).toContainText('Volume');
});

test('an externally loaded box type re-syncs the Box tab (no desync while pending)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const boxTab = page.locator('.tab-section.active');
  await page.locator('select#og-box-type').selectOption('abc');
  await expect(boxTab).toContainText(/response model pending/i);

  await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const store = await import(/* @vite-ignore */ modPath);
    store.state.box = 'sealed';
  });

  await expect(boxTab).not.toContainText(/response model pending/i);
  await expect(page.locator('#og-box-diagram-sealed')).toBeVisible();
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
});

test('the box-losses modal opens from the Box tab and closes', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('.link-btn', { hasText: 'Advanced' }).click();
  await expect(page.locator('.overlay.open')).toContainText('Box losses');
  await expect(page.locator('.overlay.open')).toContainText('Leakage Ql');
  await page.locator('.overlay.open .ok-btn').click();
  await expect(page.locator('.overlay.open')).toHaveCount(0);
});

test('the Color button cycles the current design trace colour (and wraps)', async ({ page }) => {
  const swatch = page.locator('.color-btn');
  const bg = () => swatch.evaluate(el => getComputedStyle(el).backgroundColor);
  const before = await bg();
  await swatch.click();
  expect(await bg()).not.toBe(before);
  // The palette has 7 colours, so 7 clicks total returns to the start.
  for (let i = 0; i < 6; i++) await swatch.click();
  expect(await bg()).toBe(before);
});

test('the 6th-order-bandpass Frc field persists a typed value instead of discarding it (BUG_20260823)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('bandpass6');
  const frc = page.locator('.field', { hasText: 'Tuning freq (Frc)' }).locator('input');
  await frc.click();
  await frc.fill('222222');
  await frc.blur();
  await expect(frc).toHaveValue(/^222222(\.0+)?$/); // 2-dp display formatting, not the bug
  const stored = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.requireFocusedProject().frcHz();
  });
  expect(stored).toBe(222222); // model actually holds it, not just the local input's own state
});

test('the bandpass Box tab shows calculated Frc + Tuning-freq readouts (real values)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('bandpass4');
  const panel = page.locator('.content-panel');
  // Assert the readouts show real computed Hz values (not just the labels) — this fails
  // if the underlying computeds regress to a literal or null.
  await expect(panel.locator('.field').filter({ hasText: 'Frc' }).locator('input.calculated')).toHaveValue(/^\d+\.\d{2}$/);
  await expect(panel.locator('.field').filter({ hasText: 'Tuning freq (Ffc)' }).locator('input')).toHaveValue(/^\d+(\.\d+)?$/);
});

test('the Vented "1st port resonance" shows the vent pipe resonance c/(2·ventL), not the box tuning', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('vented');
  await page.locator('.project-nav li').nth(2).click(); // dynamic Vents tab
  const field = page.locator('.field', { hasText: '1st port resonance' }).locator('input');
  const v = Number(await field.inputValue());
  // WinISD's "1st port resonance" = c/(2·physical vent length). A ~10 cm vent → ~1.7 kHz — far
  // above the box Helmholtz tuning (~tens of Hz), the wrong value this assertion pins against.
  expect(v).toBeGreaterThan(500);
});

test('the Vented pane labels the tuning readout "1st port resonance"', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('vented');
  await page.locator('.project-nav li').nth(2).click(); // the dynamic enclosure/Vents tab
  await expect(page.locator('.content-panel')).toContainText('1st port resonance');
});

test('the projects checkbox hides that project\'s trace without removing the project', async ({ page }) => {
  await page.locator('.link-btn', { hasText: 'Copy' }).click(); // ＋ Copy — pin a snapshot
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(2); // current design + 1 comparison
  console.log('--- ROW TEXTS ---', await rows.allTextContents());

  const cbx = rows.nth(1).locator('input[type=checkbox]');
  await expect(cbx).toBeChecked();
  await cbx.uncheck();
  await expect(rows).toHaveCount(2); // NOT deleted — still there
  await expect(rows.nth(1)).toHaveClass(/trace-hidden/);

  // The flag lives on the row and nowhere else — a design never holds another design.
  // The drawn effect of hiding is asserted against the canvas in original-projects.browser.spec.ts.

  await cbx.check();
  await expect(rows.nth(1)).not.toHaveClass(/trace-hidden/);
});

test('a project is closed by selecting its row then Close (WinISD right-click Delete stand-in)', async ({ page }) => {
  await page.locator('.link-btn', { hasText: 'Copy' }).click();
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(2);
  await rows.nth(1).click();                                  // select the overlay row
  await page.locator('.quad-projects-wrap .close-btn').click();
  // A copy is unsaved, so closing it asks rather than discarding the work silently.
  await page.locator('.close-actions button:has-text("Close without saving")').click();
  await expect(rows).toHaveCount(1); // back to just the current design
});

test('the Filters tab quick-adds real filter types and drives the store', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Filters' }).click();
  const panel = page.locator('.content-panel');
  // Only the six engine-supported types (highpass, lowpass, linkwitz, peaking, lowshelf, highshelf).
  await expect(panel.locator('.filters-quickadd .action-btn')).toHaveCount(6);

  await panel.locator('.action-btn', { hasText: '+ HP' }).click();
  await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(1);
  await expect(panel.locator('.filter-type-badge')).toContainText('HP');
  const n = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.requireFocusedProject().filters().length;
  });
  expect(n).toBe(1);

  await panel.locator('.filter-del').click();
  await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(0);
});

test('the Tune what-if panel previews live and Cancel reverts — no Keep/commit path exists', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  await expect(tune).toBeVisible();
  // A what-if is exploration-only — it can never become real driver data, so there is no
  // "Keep"/commit control at all. cancel (✕ / Cancel) is the only way the panel closes.
  await expect(tune.locator('button', { hasText: 'Keep' })).toHaveCount(0);
  await expect(tune.locator('button', { hasText: 'Cancel' })).toBeVisible();

  const readFs = () => page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.driverRaw.value.Fs;
  });
  const before = await readFs();

  const fsInput = tune.locator('.tune-fld', { hasText: 'Fs' }).locator('input');
  await fsInput.fill(String(before + 6));
  await fsInput.dispatchEvent('input');
  expect(await readFs()).toBeCloseTo(before + 6, 1); // live preview updated the shared store

  await tune.locator('button', { hasText: 'Cancel' }).click();
  await expect(tune).toBeHidden();
  expect(await readFs()).toBeCloseTo(before, 1); // Cancel reverted the what-if
});

test('a Tune what-if can never dirty the project, however it closes (STATE_MODEL: what-if never commits)', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();

  const unsaved = page.locator('.unsaved-label');
  await expect(unsaved).toBeHidden(); // fresh load = ground = clean

  const readFs = () => page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.driverRaw.value.Fs;
  });
  const before = await readFs();

  await page.locator('.driver-id-row').getByRole('button', { name: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  const fsInput = tune.locator('.tune-fld', { hasText: 'Fs' }).locator('input');
  await fsInput.fill(String(before + 6));
  await fsInput.dispatchEvent('input');

  expect(await readFs()).toBeCloseTo(before + 6, 1); // effective driver previews the what-if live
  await expect(unsaved).toBeHidden();                // ...but the project is NOT dirtied

  // Closing via the titlebar ✕ (the only other close path besides Cancel) must discard the
  // what-if exactly like Cancel does — there is no path that keeps it.
  await tune.locator('.tune-titlebar .close-btn').click();
  await expect(tune).toBeHidden();
  await expect(unsaved).toBeHidden();                // still clean — nothing to commit, ever
  expect(await readFs()).toBeCloseTo(before, 1);      // reverted to the pre-what-if value
});

test('the Tune fields accept multi-character typing (no reformat-while-typing clobber)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Tune' }).click();
  const fsInput = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).locator('input');
  await fsInput.click();
  await fsInput.press('Control+a');
  await fsInput.pressSequentially('42'); // type char-by-char, like a real user
  await expect(fsInput).toHaveValue('42');
  const fs = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.driverRaw.value.Fs;
  });
  expect(fs).toBeCloseTo(42, 1);
});

test('v-expo-step fields keep clean decimals while spinning (grid-aligned step)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const hum = page.locator('.tab-section.active .field', { hasText: 'Relative humidity' }).locator('input');
  await hum.click();
  await hum.fill('50');
  for (let i = 0; i < 4; i++) await hum.press('ArrowUp'); // compounding steps
  const val = await hum.inputValue();
  expect(val).toMatch(/^\d+(\.\d{1,2})?$/); // clean grid value, never a long compounding float
});

test('NumInput spinner keeps fixed decimal places (no compounding float precision)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const vol = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  await vol.click();
  await vol.fill('6');
  for (let i = 0; i < 3; i++) await vol.press('ArrowUp'); // native spinner steps, compounding
  const val = await vol.inputValue();
  expect(val).toMatch(/^\d+(\.\d{1,2})?$/); // at most 2 dp — never a long compounding float
});

test('NumInput dp is screen-formatting only — the model keeps FULL precision (not truncated to dp)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const vol = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  await vol.click();
  await vol.fill('6.123456'); // more decimals than the field's 2 dp
  await vol.blur();
  await expect(vol).toHaveValue('6.12'); // DISPLAY is formatted to 2 dp
  const vb = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.requireFocusedProject().boxVolume_m3(); // stored in m³ (display L ÷ 1000)
  });
  expect(vb).toBeCloseTo(0.006123456, 9); // MODEL retains full precision — never the 2-dp "0.00612"
});

test('class-level: NO Original-skin spinner gains decimal places while spinning (all fields, all box types)', async ({ page }) => {
  test.setTimeout(120_000); // exhaustive sweep: 4 box types × every tab × 18 key-presses per field
  // Box tab across every box type — exposes the type-specific spinners (vents, PR, chambers)
  // as well as the shared Volume/Signal/Advanced fields. Covers NumInput and v-expo-step at once.
  let checked = 0;
  for (const boxType of ['sealed', 'vented', 'pr', 'bandpass4'] as const) {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('select#og-box-type').selectOption(boxType);
    // Sweep every project tab that exists for this box type (the tab set changes per type).
    const tabCount = await page.locator('.project-nav li').count();
    for (let t = 0; t < tabCount; t++) {
      const li = page.locator('.project-nav li').nth(t);
      const name = ((await li.textContent()) || `tab${t}`).trim();
      await li.click();
      checked += await sweepActiveTab(page, `${boxType}/${name}`);
    }
  }
  // The docked Tune panel (v-expo-step T/S fields) — the highest-risk fractional-value spinners.
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Tune' }).click();
  const tuneInputs = await page.locator('.tune-panel input[type="number"]').all();
  for (let i = 0; i < tuneInputs.length; i++) checked += await assertSpinnerHoldsDp(tuneInputs[i], `Tune #${i}`);

  // Guard against a selector that silently matches nothing (which would make the sweep a no-op
  // and pass vacuously). The Original skin has well over a dozen numeric spinners across types.
  expect(checked, 'class-level sweep visited too few spinners — selector likely drifted').toBeGreaterThan(12);
});

test('Original save buttons sit in a right-edge rail beside the tabs (no vertical space consumed)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const { railLeft, tabsRight, railTop, tabsTop } = await page.evaluate(() => {
    const rail = (document.querySelector('.save-rail') as HTMLElement).getBoundingClientRect();
    const tabs = (document.querySelector('.content-tabs') as HTMLElement).getBoundingClientRect();
    return { railLeft: rail.left, tabsRight: tabs.right, railTop: rail.top, tabsTop: tabs.top };
  });
  expect(railLeft).toBeGreaterThanOrEqual(tabsRight); // rail is beside the tab content, not above it
  expect(Math.abs(railTop - tabsTop)).toBeLessThanOrEqual(4); // both start at the top of the panel
});

test('field constraints: negative/out-of-range entry is rejected or clamped everywhere (schema-enforced)', async ({ page }) => {
  // 1. NumInput (registry-bound): typing a negative into Box Volume must flag it and NOT
  //    reach the model; blur reverts to the last valid value.
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  const before = await vb.inputValue();
  await vb.fill('-5');
  await expect(vb).toHaveClass(/inp-bad/); // rejected, red-flagged
  await vb.blur();
  await expect(vb).toHaveValue(before);    // model never took the negative
  // 2. Raw input + v-limits (registry-bound): humidity typed to -20 clamps to the 0 floor.
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const rh = page.locator('.tab-section.active .field', { hasText: 'Relative humidity' }).locator('input');
  await rh.fill('-20');
  await expect(rh).toHaveValue('0');
  await rh.fill('250');
  await expect(rh).toHaveValue('100');     // ceiling too, not just the floor
  // 3. Tune what-if panel (scaled registry bounds): Fs typed negative clamps to the 1 Hz floor.
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Tune' }).click();
  const fs = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).first().locator('input');
  await fs.fill('-40');
  await expect(fs).toHaveValue('1');
  await page.locator('.tune-panel .close-btn').click();
});

test('Signal tab: Series resistance shows WinISD 3-dp precision (0.100 ohm)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  const rs = page.locator('.field', { hasText: 'Series resistance' }).locator('input');
  await expect(rs).toHaveValue(/^\d+\.\d{3}$/); // WinISD shows series resistance to 3 dp
});

test('Signal tab: Driver input voltage is editable and drives System input power (W↔V, P=V²/Re)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  const re = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.engineDriver().Re;
  });
  const vInput = page.locator('.field', { hasText: 'Driver input voltage' }).locator('input');
  await vInput.fill('20');
  await vInput.dispatchEvent('input');
  await vInput.blur();
  const pin = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.requireFocusedProject().inputPower_W();
  });
  expect(pin).toBeCloseTo((20 * 20) / re, 1); // editing V back-calculates W = V²/Re
});

test('Original skin buttons have readable dark text on their light fill', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  const btn = page.locator('.edit-btn', { hasText: 'Select Driver' });
  const rgbSum = await btn.evaluate((el) => {
    const m = getComputedStyle(el).color.match(/\d+/g);
    return m ? Number(m[0]) + Number(m[1]) + Number(m[2]) : 999;
  });
  // Dark text (#1a1a1a → ~78) passes; the near-white --fg bug (#dfe6ee → ~691) fails.
  expect(rgbSum).toBeLessThan(300);
});

test('New Project collects the project name first and shows it in the titlebar', async ({ page }) => {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Project name'); // step 1 is the name, before box type
  await modal.locator('input').first().fill('My Sub Build');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption('sealed'); // step 2 = box type
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click(); // step 3 = volume → create

  const name = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.state.project.name;
  });
  expect(name).toBe('My Sub Build');
  await expect(page.locator('.titlebar')).toContainText('My Sub Build');
});

test('New Project starts fresh — it discards the previous design (filters, params)', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Dirty the current design: a filter and a non-default power.
  await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    s.requireFocusedProject().addFilter({ type: 'highpass', enabled: true, fc: 30, Q: 0.7, gain: 0 });
    s.requireFocusedProject().setInputPower_W(250);
  });

  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal.locator('.np-warn')).toBeVisible();   // data-loss guard warns about unsaved changes
  await modal.locator('button', { hasText: 'Next' }).click();  // step 1 name → skip
  await modal.locator('select').selectOption('sealed');        // step 2 box type
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click(); // step 3 volume → create

  const st = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return { filters: s.requireFocusedProject().filters().length, pin: s.requireFocusedProject().inputPower_W() };
  });
  expect(st.filters).toBe(0);  // fresh project — no inherited filters
  expect(st.pin).toBe(1);      // Pin back to the default, not the previous 250
});

test('the New Project wizard sets box type + volume then opens the driver picker', async ({ page }) => {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('New Project');

  await modal.locator('button', { hasText: 'Next' }).click();  // step 1 name → skip
  await modal.locator('select').selectOption('vented');        // step 2 box type
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('input').first().fill('42');             // step 3 volume
  await modal.locator('button', { hasText: 'Pick Driver' }).click();

  const st = await page.evaluate(async () => {
    const storeModPath = '/src/logic/appState.ts';
    const presModPath = '/src/logic/presentationState.ts';
    const s = await import(/* @vite-ignore */ storeModPath);
    const ps = await import(/* @vite-ignore */ presModPath);
    return { box: s.state.box, vb: s.requireFocusedProject().boxVolume_m3(), browse: ps.presentationState.browseOpen };
  });
  expect(st.box).toBe('vented');
  expect(st.vb).toBeCloseTo(0.042, 3); // 42 L → 0.042 m³
  expect(st.browse).toBe(true); // hands off to the driver picker
});

test('Original toolbar: Share link (Export menu) writes the design into the address bar', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {})); // if clipboard is blocked, shareLink falls back to prompt()
  await page.locator('#btnExportMenu').click();
  await page.locator('#btnShare').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
});

test('a pinned graph cursor survives the share link — opening it shows the same marker', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  // Pin the cursor: hover mid-chart then click (hover sets cursorF, click locks it as pinnedF).
  const chart = page.locator('.graph-wrap .gpanel canvas').first();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const hz = (await page.locator('.cursor-readout .ro-hz').textContent())!.trim();
  expect(hz).not.toContain('—'); // a real pinned frequency, e.g. "43.30 Hz"

  await page.locator('#btnExportMenu').click();
  await page.locator('#btnShare').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
  const url = await page.evaluate(() => location.href);

  // Open the link cold — no local state, only the URL carries the design. Shares write the
  // hash into the sender's own address bar, so goto(url) alone would be a same-URL no-op
  // navigation that keeps all in-memory state; bounce through about:blank to force a real load.
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.cursor-readout .ro-hz')).toHaveText(hz);
});

test('a dragged frequency band selection survives the share link', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  // Band-select by dragging across the plot area.
  const chart = page.locator('.graph-wrap .gpanel canvas').first();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  const readout = (await page.locator('.gread').textContent())!.trim();
  expect(readout).toMatch(/Hz.*–.*Hz/); // e.g. "31.6 Hz – 100 Hz  Δ …"

  await page.locator('#btnExportMenu').click();
  await page.locator('#btnShare').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
  const url = await page.evaluate(() => location.href);

  // Cold open (about:blank bounce — see the pinned-cursor test above for why).
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.gread')).toHaveText(readout);
});

test('the Save bar tracks whether the design differs from ground; Save adopts it, Reset reverts it (STATE_MODEL ground↔committed)', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.project-nav li', { hasText: 'Box' }).click();

  const unsaved = page.locator('.unsaved-label');
  const boxSel = page.locator('select#og-box-type');
  await expect(unsaved).toBeHidden(); // fresh load = ground = clean

  await boxSel.selectOption('sealed');            // change the design → modified
  await expect(unsaved).toBeVisible();

  await page.locator('.tb-btn[title^="Revert"]').click(); // revert to ground
  await expect(unsaved).toBeHidden();
  await expect(boxSel).toHaveValue('vented');     // back to the ground box type

  await boxSel.selectOption('sealed');            // change again
  await expect(unsaved).toBeVisible();
  
  // Programmatically mark saved (simulates successful save file pick & write)
  await page.evaluate(async () => {
    // @ts-expect-error - runtime browser-only import of store.ts
    const s = await import(/* @vite-ignore */ '/src/logic/appState.ts');
    s.markProjectSaved();
  });
  
  await expect(unsaved).toBeHidden();
  await expect(boxSel).toHaveValue('sealed');     // kept the change; now it's the ground
});

test('the chosen skin is remembered across a reload (local preference)', async ({ page }) => {
  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
});

test('Driver pane: WinISD-parity added-mass field feeds the engine model (g→kg, resonance drops)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('sealed');
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  const peakHz = () => page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    const z = s.curvesData.value.zmag as number[], f = s.curvesData.value.fs as number[];
    // The impedance resonance peak lives in the bass region; above it, Le makes |Z| climb to
    // fmax, so restrict the search to < 300 Hz to find the resonance, not the inductive rise.
    let bi = 0, bz = -1;
    for (let i = 0; i < f.length; i++) if (f[i] < 300 && z[i] > bz) { bz = z[i]; bi = i; }
    return f[bi];
  });
  const before = await peakHz();
  const amc = page.locator('.field', { hasText: 'Added mass to cone' }).locator('input');
  await amc.fill('50');
  await amc.dispatchEvent('input');
  await amc.blur();
  const madd = await page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    return (await import(/* @vite-ignore */ modPath)).requireFocusedProject().driverAddedMass();
  });
  expect(madd).toBeCloseTo(0.05, 6);            // 50 g entered → 0.05 kg in the engine model
  expect(await peakHz()).toBeLessThan(before);  // heavier cone → lower resonance (sweep re-ran with it)
});

test('Driver Editor decimals come from the registry (Vas 2 dp, Sd 1 dp)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  const modal = page.locator('.overlay.on');
  await expect(modal).toContainText("Edit Project's Driver");
  await modal.locator('.de-tab', { hasText: 'Parameters' }).first().click(); // Vas/Sd live on the Parameters tab
  const vas = modal.locator('.de-fld', { hasText: 'Vas' }).locator('input').first();
  await vas.fill('20');
  await vas.blur();
  await expect(vas).toHaveValue('20.00'); // registry Vas = 2 dp (was a 3-dp literal)
  const sd = modal.locator('.de-fld', { hasText: 'Sd' }).locator('input').first();
  await sd.fill('130');
  await sd.blur();
  await expect(sd).toHaveValue('130.00'); // registry Sd = 2 dp (was a 4-dp literal)
});

test('R1: an open Driver Editor is reopened after a reload', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.overlay.on')).toContainText("Edit Project's Driver");

  await page.waitForFunction(() => (localStorage.getItem('openisd.state') || '').includes('originalEditorOpen'),
    undefined, { timeout: 5000 });
  await page.reload();
  await expect(page.locator('.overlay.on')).toContainText("Edit Project's Driver"); // reopened after refresh
});

test('R1: an open Tune with uncommitted what-if values is preserved across a reload', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Tune' }).click();
  const fsInput = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).locator('input');
  const before = Number(await fsInput.inputValue());
  await fsInput.fill(String(before + 7));
  await fsInput.dispatchEvent('input');

  await page.waitForFunction(() => (localStorage.getItem('openisd.state') || '').includes('originalTuneOpen'),
    undefined, { timeout: 5000 }); // the open Tune + overlay get persisted
  await page.reload();

  const fs2 = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).locator('input');
  await expect(page.locator('.tune-panel')).toBeVisible();          // Tune reopened
  await expect(fs2).toHaveValue((before + 7).toFixed(2));           // with the pending what-if value (Fs shows 2 dp)
  await expect(page.locator('.unsaved-label')).toBeHidden();        // still uncommitted → project not dirtied
});

test('R1 refresh fidelity: box type, active tab, and selected chart survive a reload', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('sealed');
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  await page.locator('.chart-select').click();
  await page.locator('.chart-select .menu-item', { hasText: /^Cone excursion$/ }).click();

  await page.waitForFunction(() => (localStorage.getItem('openisd.state') || '').includes('Cone excursion')); // persist flushed
  await page.reload();

  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.project-nav li.active')).toHaveText('Signal');        // active tab restored
  await expect(page.locator('.chart-select .chart-name')).toHaveText('Cone excursion'); // chart restored
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await expect(page.locator('select#og-box-type')).toHaveValue('sealed');           // box restored
});

// ---- Per-field display-unit conversion (fields/units.ts + <UnitToggle>) ------------
// The store ALWAYS holds SI; clicking a field's unit label must rescale only the shown
// value (and convert typed input back), never the stored model. This is the real
// conversion that replaced the old decorative cycleUnit (which rotated the label alone).
const readVb = (page: Page) =>
  page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    return (await import(/* @vite-ignore */ modPath)).requireFocusedProject().boxVolume_m3();
  });
const readVbToken = (page: Page) =>
  page.evaluate(async () => {
    const modPath = '/src/logic/presentationState.ts';
    return (await import(/* @vite-ignore */ modPath)).presentationState.ui.unitTokens?.Vb;
  });

test('clicking an entered field\'s unit label rescales the DISPLAY and keeps the model SI', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const field = page.locator('.tab-section.active .field', { hasText: 'Volume' }).first();
  const vol = field.locator('input').first();
  const label = field.locator('.unit-cyc');

  await vol.click();
  await vol.fill('6');            // 6 L
  await vol.blur();
  await expect(vol).toHaveValue('6.00');
  await expect(label).toHaveText('L');
  expect(await readVb(page)).toBeCloseTo(0.006, 9);   // stored in SI m³

  await label.click();           // L → cu ft
  await expect(label).toHaveText('cu ft');
  await expect(vol).toHaveValue('0.212');             // 0.006 m³ × 35.3147, 3 dp
  expect(await readVb(page)).toBeCloseTo(0.006, 9);   // MODEL unchanged by a unit switch
  expect(await readVbToken(page)).toBe('cuft');       // token persisted (survives refresh)

  await vol.click();
  await vol.fill('0.3');         // now typing in cu ft
  await vol.blur();
  expect(await readVb(page)).toBeCloseTo(0.3 / 35.3147, 6); // converted back to SI
});

test('a calculated readout also rescales when its unit is rotated (Hz → kHz)', async ({ page }) => {
  await page.locator('.project-nav li').nth(2).click();               // dynamic enclosure/Vents tab
  const field = page.locator('.tab-section.active .field', { hasText: '1st port resonance' });
  const val = field.locator('input');
  const label = field.locator('.unit-cyc');

  await expect(label).toHaveText('Hz');
  const hz = parseFloat(await val.inputValue());
  expect(hz).toBeGreaterThan(0);

  await label.click();           // Hz → kHz
  await expect(label).toHaveText('kHz');
  const khz = parseFloat(await val.inputValue());
  expect(khz).toBeCloseTo(hz / 1000, 5);                             // same SI value, finer unit
});

test('Added mass to cone: clicking the unit converts g → kg; the model stays SI (kg)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  const field = page.locator('.field', { hasText: 'Added mass to cone' });
  const amc = field.locator('input');
  const unit = field.locator('.unit');

  await amc.fill('100');
  await amc.dispatchEvent('input');
  await amc.blur();
  await expect(unit).toHaveText('g');
  const readMadd = () => page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    return (await import(/* @vite-ignore */ modPath)).requireFocusedProject().driverAddedMass();
  });
  expect(await readMadd()).toBeCloseTo(0.1, 6);   // 100 g entered → 0.1 kg in the model

  await unit.click();                              // g → kg
  await expect(unit).toHaveText('kg');
  expect(parseFloat(await amc.inputValue())).toBeCloseTo(0.1, 6); // now shown in kg
  expect(await readMadd()).toBeCloseTo(0.1, 6);    // MODEL unchanged by the display-unit switch
});

test('Advanced Temperature: K → °C converts via OFFSET; the model stays in kelvin', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const tempField = page.locator('.tab-section.active .field', { hasText: 'Temperature' });
  const temp = tempField.locator('input');
  const unit = tempField.locator('.unit-cyc');
  const sv = page.locator('.tab-section.active .field', { hasText: 'Sound velocity' }).locator('input');

  await expect(unit).toHaveText('K');
  await expect(temp).toHaveValue('293.15');
  const svBefore = await sv.inputValue();          // depends on temperature IN KELVIN

  await unit.click();                              // K → °C (affine: −273.15, not a factor)
  await expect(unit).toHaveText('°C');
  await expect(temp).toHaveValue('20.00');         // 293.15 K − 273.15 = 20.00 °C
  await expect(sv).toHaveValue(svBefore);          // unchanged ⇒ the model stayed in kelvin
});

test('Voice coil temp rise, resistance TC, and added mass all convert (no runaway precision)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();

  // Voice coil temp rise: K → °F is a DIFFERENCE conversion (×1.8, no offset — distinct from
  // the Advanced tab's ABSOLUTE temperature, which needs the −273.15 offset).
  const riseField = page.locator('.field', { hasText: 'Voice coil temp rise' });
  const rise = riseField.locator('input');
  const riseUnit = riseField.locator('.unit');
  await rise.fill('40');
  await rise.dispatchEvent('input');
  await rise.blur();
  await expect(riseUnit).toHaveText('K');
  await riseUnit.click();                       // K → °F
  await expect(riseUnit).toHaveText('°F');
  expect(parseFloat(await rise.inputValue())).toBeCloseTo(72, 3); // 40 K rise = 72 °F rise

  // Voice coil resistance TC: 1000/K → %/K → 1/K.
  const tcField = page.locator('.field', { hasText: 'Voice coil resistance TC' });
  const tc = tcField.locator('input');
  const tcUnit = tcField.locator('.unit');
  await expect(tcUnit).toHaveText('1000/K');
  await expect(tc).toHaveValue('3.9000');
  await tcUnit.click();                         // 1000/K → %/K
  await expect(tcUnit).toHaveText('%/K');
  expect(parseFloat(await tc.inputValue())).toBeCloseTo(0.39, 3);

  // Added mass to cone: converting to kg must NOT pile up meaningless zeros (was 0.00000000).
  const maddField = page.locator('.field', { hasText: 'Added mass to cone' });
  const madd = maddField.locator('input');
  const maddUnit = maddField.locator('.unit');
  await madd.fill('100');
  await madd.dispatchEvent('input');
  await madd.blur();
  await maddUnit.click();                       // g → kg
  await expect(maddUnit).toHaveText('kg');
  await expect(madd).not.toHaveValue('0.00000000');
  const shown = await madd.inputValue();
  expect(shown.replace(/^0\./, '').length).toBeLessThanOrEqual(4); // capped decimal places
  expect(parseFloat(shown)).toBeCloseTo(0.1, 3);
});

test('Original skin: Options dialog → "Reset to Metric" reverts a toggled unit (kg → g) app-wide without touching the model', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  const field = page.locator('.field').filter({ has: page.locator('label', { hasText: /^Added mass to cone$/ }) });
  const amc = field.locator('input');
  const unit = field.locator('.unit');

  // beforeEach clears localStorage, so the app starts on its metric ground state.
  await expect(unit).toHaveText('g');

  await amc.fill('75');
  await amc.dispatchEvent('input');
  await amc.blur();
  await unit.click();                             // g → kg
  await expect(unit).toHaveText('kg');


  const readMadd = () => page.evaluate(() => {
    return (window as any).__store_instances[0].P.driverAddedMass;
  });
  const siBefore = await readMadd();
  expect(siBefore).toBeCloseTo(0.075, 6);

  await page.locator('.tb-btn[title="Options"]').click();
  await expect(page.locator('.opt-modal')).toBeVisible();
  await page.getByRole('button', { name: 'Reset to Metric (l, mm, …)' }).click();
  await page.locator('.opt-modal .opt-ok').click();

  await expect(unit).toHaveText('g');             // reverted to the field's default unit
  expect(await readMadd()).toBeCloseTo(siBefore, 9); // the stored SI value is untouched
});

test('Original skin: Options → General → Environment default seeds a fresh mount\'s Advanced-pane Temperature (not a hardcoded literal)', async ({ page }) => {
  await page.locator('.tb-btn[title="Options"]').click();
  await expect(page.locator('.opt-modal')).toBeVisible();
  const envTemp = page.locator('.opt-modal .opt-fld', { hasText: 'Temperature' }).locator('input[type="number"]');
  await envTemp.fill('300');
  await envTemp.dispatchEvent('input');
  await envTemp.blur();
  await page.locator('.opt-modal .opt-ok').click();

  await page.reload();
  await page.waitForFunction(() => window.selfTestDone === true, { timeout: 5000 }).catch(() => {});
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const advTemp = page.locator('.tab-section.active .field', { hasText: 'Temperature' }).locator('input');
  await expect(advTemp).toHaveValue('300.00');
});

test('Original skin: Options dialog is centered on screen, not pinned to the top (own overlay, not the shell\'s)', async ({ page }) => {
  await page.locator('.tb-btn[title="Options"]').click();
  const overlay = page.locator('.opt-overlay');
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  const modalBox = await page.locator('.opt-modal').boundingBox();
  const viewport = page.viewportSize()!;
  const modalMidY = modalBox!.y + modalBox!.height / 2;
  // Centered vertically within a reasonable tolerance — not stuck near the top of the viewport
  // (guards: Original's own unscoped `.overlay { align-items:flex-start }` would leak onto
  // this modal's root element via Vue's parent-scope-on-child-root behaviour).
  expect(Math.abs(modalMidY - viewport.height / 2)).toBeLessThan(viewport.height * 0.15);
  expect(box).toBeTruthy();
});

test('Original skin: Options modal input boxes are 50% wider and do not show spinners', async ({ page }) => {
  await page.locator('.tb-btn[title="Options"]').click();
  const modal = page.locator('.opt-modal');
  await expect(modal).toBeVisible();

  // General tab: Environment input boxes should be 150px wide
  const envInput = page.locator('.opt-env-grid .opt-num').first();
  const envInputWidth = await envInput.evaluate(el => window.getComputedStyle(el).width);
  expect(envInputWidth).toBe('150px');

  // Verify no spinners (appearance: none / textfield)
  const appearance = await envInput.evaluate(el => window.getComputedStyle(el).webkitAppearance);
  expect(appearance).toBe('none');

  // Plot Window tab: Limit input boxes should be 90px wide
  await page.locator('.opt-tab', { hasText: 'Plot Window' }).click();
  const limitInput = page.locator('.opt-limits .opt-num').first();
  const limitInputWidth = await limitInput.evaluate(el => window.getComputedStyle(el).width);
  expect(limitInputWidth).toBe('90px');
});

test('Original skin: Options dialog edits are draft-only and discard on Cancel, apply on OK, and reset on Defaults', async ({ page }) => {
  // Helper to get environment temp from store in browser
  const getStoreTemp = async () => {
    return await page.evaluate(async () => {
      const modPath = '/src/logic/presentationState.ts';
      const ps = await import(/* @vite-ignore */ modPath);
      return ps.presentationState.ui.envDefaults.tempK;
    });
  };

  // Initially it is default 293.15
  expect(await getStoreTemp()).toBe(293.15);

  // 1. Open options, change Temperature, and click Cancel
  await page.locator('.tb-btn[title="Options"]').click();
  const tempInput = page.locator('.opt-fld', { hasText: 'Temperature' }).locator('input');
  await tempInput.click();
  await tempInput.press('Control+a');
  await tempInput.press('Delete');
  await tempInput.pressSequentially('300.00');
  await tempInput.blur();
  await page.locator('.opt-footer button', { hasText: 'Cancel' }).click();

  // Verification: should still be 293.15 (not applied!)
  expect(await getStoreTemp()).toBe(293.15);

  // 2. Open options, change Temperature, and click OK
  await page.locator('.tb-btn[title="Options"]').click();
  const tempInput2 = page.locator('.opt-fld', { hasText: 'Temperature' }).locator('input');
  await tempInput2.click();
  await tempInput2.press('Control+a');
  await tempInput2.press('Delete');
  await tempInput2.pressSequentially('300.00');
  await tempInput2.blur();
  await page.locator('.opt-footer button', { hasText: 'OK' }).click();

  // Verification: should now be 300 (applied!)
  expect(await getStoreTemp()).toBe(300);

  // 3. Open options, click Defaults, click OK
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-footer button', { hasText: 'Defaults' }).click();
  await page.locator('.opt-footer button', { hasText: 'OK' }).click();

  // Verification: should be back to 293.15 (applied default!)
  expect(await getStoreTemp()).toBe(293.15);
});

test('Original skin: Environment fieldset has its own reset button that resets envDefaults without touching other draft fields', async ({ page }) => {
  // Helper to read the relevant store fields from the browser
  const getStore = async () => {
    return await page.evaluate(async () => {
      const modPath = '/src/logic/presentationState.ts';
      const ps = await import(/* @vite-ignore */ modPath);
      return { tempK: ps.presentationState.ui.envDefaults.tempK, username: ps.presentationState.ui.username };
    });
  };

  // 1. Open options, set a username and change Temperature away from defaults, apply with OK
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-input').fill('111111');
  const tempInput = page.locator('.opt-fld', { hasText: 'Temperature' }).locator('input');
  await tempInput.click();
  await tempInput.press('Control+a');
  await tempInput.press('Delete');
  await tempInput.pressSequentially('300.00');
  await tempInput.blur();
  await page.locator('.opt-footer button', { hasText: 'OK' }).click();

  expect(await getStore()).toEqual({ tempK: 300, username: '111111' });

  // 2. Reopen options, click the Environment fieldset's own reset button, then OK
  await page.locator('.tb-btn[title="Options"]').click();
  await page.locator('.opt-group', { hasText: 'Environment' }).locator('.opt-reset-btn').click();
  await page.locator('.opt-footer button', { hasText: 'OK' }).click();

  // Verification: envDefaults back to the physical default, username left untouched
  expect(await getStore()).toEqual({ tempK: 293.15, username: '111111' });
});

test('Original skin: Open the two samples and switch between them, ensuring the active selection highlight moves correctly', async ({ page }) => {
  // 1. Open first sample: "Generic 6.5\" Woofer"
  await page.locator('.tb-btn.has-menu[title="Open project"]').click();
  await page.locator('.sample-item', { hasText: 'Generic 6.5" Woofer' }).click();

  // 2. Open second sample: "Generic 1\" Tweeter"
  await page.locator('.tb-btn.has-menu[title="Open project"]').click();
  await page.locator('.sample-item', { hasText: 'Generic 1" Tweeter' }).click();

  // 3. Verify that we have three projects in the flat sidebar list
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(3);

  // 4. Verify that "Generic 1\" Tweeter" (the most recently opened project) is active/selected
  const tweeterRow = rows.filter({ hasText: 'Generic 1" Tweeter' });
  await expect(tweeterRow).toHaveClass(/selected/);

  // 5. Click on the "Generic 6.5\" Woofer" row to switch to it. Opening a sample opens a
  // project in its own right — it does not fork whatever was already open into a copy.
  const wooferRow = rows.filter({ hasText: /^Generic 6.5" Woofer$/ });
  await wooferRow.click();

  // 6. Assert that "Copy of Generic 6.5\" Woofer" becomes the active/selected project
  await expect(wooferRow).toHaveClass(/selected/);
  await expect(tweeterRow).not.toHaveClass(/selected/);

  // 7. Verify the header in titlebar matches the selected project name
  await expect(page.locator('.titlebar')).toContainText('Generic 6.5" Woofer');
});

test('Original skin: Project Modified styling (yellow highlight/is-unsaved class) is preserved when switching back and forth', async ({ page }) => {
  // 1. Open a sample
  await page.locator('.tb-btn.has-menu[title="Open project"]').click();
  await page.locator('.sample-item', { hasText: 'Generic 6.5" Woofer' }).click();

  // 2. Open another sample. Each sample is its own project — the first stays as itself.
  await page.locator('.tb-btn.has-menu[title="Open project"]').click();
  await page.locator('.sample-item', { hasText: 'Generic 1" Tweeter' }).click();

  const rows = page.locator('.projects-list .project-row');
  const wooferRow = rows.filter({ hasText: /^Generic 6.5" Woofer$/ });

  // 3. Make some modification to the active project (Generic 1" Tweeter) by changing its name in Project tab
  await page.locator('.project-nav li', { hasText: 'Project' }).click();
  const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
  await nameInput.fill('Modified Tweeter');
  await nameInput.blur();

  // 4. Assert that "Modified Tweeter" has the `is-unsaved` class (yellow highlight)
  const tweeterRow = rows.filter({ hasText: /^Modified Tweeter$/ });
  await expect(tweeterRow).toHaveClass(/is-unsaved/);

  // 5. Swap to "Copy of Generic 6.5\" Woofer"
  await wooferRow.click();
  await expect(wooferRow).toHaveClass(/selected/);

  // 6. Swap back to "Modified Tweeter"
  await tweeterRow.click();
  await expect(tweeterRow).toHaveClass(/selected/);

  // 7. Assert that "Modified Tweeter" STILL has the `is-unsaved` class (unsaved state was preserved perfectly!)
  await expect(tweeterRow).toHaveClass(/is-unsaved/);
});

test('Original skin: Revert/reset button resets modifications correctly', async ({ page }) => {
  // 1. Click Revert button when not modified (should be disabled)
  const revertBtn = page.locator('.tb-btn[title^="Revert"]');
  await expect(revertBtn).toHaveClass(/disabled/);

  // 2. Modify project name
  await page.locator('.project-nav li', { hasText: 'Project' }).click();
  const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
  const originalName = await nameInput.inputValue();
  await nameInput.fill('Temp Modified Name');
  await nameInput.blur();

  // 3. Revert button should be enabled, click it!
  await expect(revertBtn).not.toHaveClass(/disabled/);
  await revertBtn.click();

  // 4. Name should revert back to original
  await expect(nameInput).toHaveValue(originalName);
  await expect(revertBtn).toHaveClass(/disabled/);
});

// ---- Multi-project registry wiring (PROMPT_RELEASE_HARDENING plan) ------------------------
// These three exercise the plan's own verification list: opening a second project routes
// edits to the correct one and the chart/tab UI reflects whichever is focused; closing the
// last open project shows the explicit empty state (chart AND tab section both gone); and
// switching focus between two open projects never disturbs an open what-if on either one
// (regression guard for BUG_20260825_whatif_destroyed_by_autosave_watcher.md, extended to the
// multi-project case the single-project R1 reload test above does not cover).

test('opening a second project: edits land on the correct one, and the Project tab reflects whichever is focused', async ({ page }) => {
  // Name the original project so the two open tabs are distinguishable from the start.
  await page.locator('.project-nav li', { hasText: 'Project' }).click();
  const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
  await nameInput.fill('Original');
  await nameInput.blur();

  // "+ Copy" opens a second, genuinely independent project and focuses it.
  await page.locator('.link-btn', { hasText: 'Copy' }).click();
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(2);

  // The copy is focused — rename IT. This must not touch the original's own name.
  await nameInput.fill('Edited Copy');
  await nameInput.blur();
  await expect(rows.filter({ hasText: 'Edited Copy' })).toHaveCount(1);
  const originalRow = rows.filter({ hasText: /^Original$/ });
  await expect(originalRow).toHaveCount(1);

  // Switch focus to the original — the Project tab's own Name field now shows ITS name, not
  // the edit just made to the copy (this is the read-side of BUG_20260825_project_meta_edits_
  // never_reach_the_domain_object_or_save.md: switching focus via the registry alone, with no
  // load call, must not leave stale meta on screen).
  await originalRow.click();
  await expect(nameInput).toHaveValue('Original');

  // Switching back, the copy's edit is still there — it was never lost or bled into the
  // original.
  await rows.filter({ hasText: 'Edited Copy' }).click();
  await expect(nameInput).toHaveValue('Edited Copy');
});

test('closing the last open project shows the explicit empty state, with a working recovery action', async ({ page }) => {
  // The default single open project is unmodified at fresh load (onMounted's own
  // markProjectSaved()), so Close needs no confirmation.
  await page.locator('.quad-projects-wrap .close-btn').click();

  await expect(page.locator('.no-project-open')).toBeVisible();
  await expect(page.locator('.no-project-open')).toContainText('No project is open');
  // Both the chart views and the tab section are gone — not silently rendered with
  // empty/default data.
  await expect(page.locator('.quad-projects-wrap')).toHaveCount(0);
  await expect(page.locator('.project-nav')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);

  // The empty state's own recovery action reopens a working shell.
  await page.locator('.no-project-open button', { hasText: 'Start a new project' }).click();
  await expect(page.locator('.quad-projects-wrap')).toBeVisible();
  await expect(page.locator('.projects-list .project-row')).toHaveCount(1);
});

test('switching focus between two open projects preserves an open what-if on the originally focused one', async ({ page }) => {
  // Name the project so it is recognisable as the one to switch back to.
  await page.locator('.project-nav li', { hasText: 'Project' }).click();
  const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
  await nameInput.fill('Has The Whatif');
  await nameInput.blur();

  // Open a Tune what-if on it and change Fs without closing it. `.blur()`, not just
  // `dispatchEvent('input')`: the field only reformats to its display precision once it
  // stops being the raw, mid-typing echo (`OgTune.vue`'s own "no reformat while typing"
  // rule) — checking the value immediately after typing (no blur) would assert against
  // that raw, unformatted string instead of the field's real, settled value.
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  const fsInput = tune.locator('.tune-fld', { hasText: 'Fs' }).locator('input');
  await fsInput.fill('61');
  await fsInput.blur();
  await expect(fsInput).not.toHaveValue('');
  const settled = await fsInput.inputValue();

  // "+ Copy" opens a second, independent project and focuses it — this must not touch the
  // first project's what-if.
  await page.locator('.link-btn', { hasText: 'Copy' }).click();
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(2);

  // Switch back to the first project — its Tune panel still shows the what-if value, not
  // reverted or destroyed by autosave running while the second project was focused
  // (BUG_20260825_whatif_destroyed_by_autosave_watcher.md, multi-project case).
  await rows.filter({ hasText: /^Has The Whatif$/ }).click();
  await expect(tune).toBeVisible();
  await expect(fsInput).toHaveValue(settled);

  await tune.locator('button', { hasText: 'Cancel' }).click();
  await expect(tune).toBeHidden();
});
