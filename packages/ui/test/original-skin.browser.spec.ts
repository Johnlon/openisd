/**
 * Original (WinISD) skin — the wholesale port of the `mock/` prototype, wired to the
 * shared store/engine. Selecting it swaps the whole shell; the reused chart + panels
 * drive the same store, so no shell forks logic. These tests assert the skin seam plus
 * the mock-fidelity regions (toolbar icons, chart-select dropdown, all 7 tabs, the
 * Placement/Advanced/Listening-place sections, box types, and the box-losses modal).
 * The auto console/network guardrail (fixtures) asserts the skin swap raises no errors.
 */
import { test, expect } from './fixtures.js';
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
  await page.locator('.skin-picker select').selectOption('original');
  await expect(page.locator('.original-root')).toBeVisible();
});

test('choosing Original swaps to the ported WinISD shell (titlebar, projects, graph)', async ({ page }) => {
  await expect(page.locator('.original-root')).toContainText('WinISD Original Mode');
  await expect(page.locator('.original-root')).toContainText('Projects');
  await expect(page.locator('.original-root')).toContainText('Signal Generator');
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
});

test('the toolbar ports the mock icon buttons + chart-select', async ({ page }) => {
  // Mock toolbar: 8 icon controls (.tb-btn) + the .chart-select control.
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
    const modPath = '/src/store.ts';
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
  // The mock palette has 7 colours, so 7 clicks total returns to the start.
  for (let i = 0; i < 6; i++) await swatch.click();
  expect(await bg()).toBe(before);
});

test('the bandpass Box tab shows calculated Frc + Tuning-freq readouts (real values)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('bandpass4');
  const panel = page.locator('.content-panel');
  // Assert the readouts show real computed Hz values (not just the labels) — this fails
  // if the underlying computeds regress to a literal or null.
  await expect(panel.locator('.field').filter({ hasText: 'Frc' }).locator('input.calculated')).toHaveValue(/^\d+\.\d{2}$/);
  await expect(panel.locator('.field').filter({ hasText: 'Tuning freq' }).locator('input.calculated')).toHaveValue(/^\d+\.\d{2}$/);
});

test('the Vented pane labels the tuning readout "1st port resonance"', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('vented');
  await page.locator('.project-nav li').nth(2).click(); // the dynamic enclosure/Vents tab
  await expect(page.locator('.content-panel')).toContainText('1st port resonance');
});

test('the projects checkbox toggles a compare overlay trace visibility (not delete)', async ({ page }) => {
  await page.locator('.link-btn', { hasText: 'Compare' }).click(); // ＋ Compare — pin a snapshot
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(2); // current design + 1 comparison

  const cbx = rows.nth(1).locator('input[type=checkbox]');
  await expect(cbx).toBeChecked();
  await cbx.uncheck();
  await expect(rows).toHaveCount(2); // NOT deleted — still there
  await expect(rows.nth(1)).toHaveClass(/trace-hidden/);
  const flag = await page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.state.compare[0].visible;
  });
  expect(flag).toBe(false);

  await cbx.check();
  await expect(rows.nth(1)).not.toHaveClass(/trace-hidden/);
});

test('a compare overlay can be removed with its ✕ button', async ({ page }) => {
  await page.locator('.link-btn', { hasText: 'Compare' }).click();
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(2);
  await rows.nth(1).locator('.row-remove').click();
  await expect(rows).toHaveCount(1); // back to just the current design
});

test('the Filters tab quick-adds real filter types and drives the store', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Filters' }).click();
  const panel = page.locator('.content-panel');
  // Only the four engine-supported types (the mock's other 4 buttons have no engine model).
  await expect(panel.locator('.filters-quickadd .action-btn')).toHaveCount(4);

  await panel.locator('.action-btn', { hasText: '+ HP' }).click();
  await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(1);
  await expect(panel.locator('.filter-type-badge')).toContainText('HP');
  const n = await page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.state.P.filters.length;
  });
  expect(n).toBe(1);

  await panel.locator('.filter-del').click();
  await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(0);
});

test('the Tune what-if panel previews live and Cancel reverts (Keep/Cancel per state model)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  await expect(tune).toBeVisible();
  await expect(tune.locator('button', { hasText: 'Keep' })).toBeVisible();
  await expect(tune.locator('button', { hasText: 'Cancel' })).toBeVisible();

  const readFs = () => page.evaluate(async () => {
    const modPath = '/src/store.ts';
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

test('a live Tune what-if is isolated from the modified state until Keep (STATE_MODEL: what-if ≠ modified)', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();

  const unsaved = page.locator('.unsaved-label');
  await expect(unsaved).toBeHidden(); // fresh load = ground = clean

  const readFs = () => page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.driverRaw.value.Fs;
  });
  const before = await readFs();

  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  const fsInput = tune.locator('.tune-fld', { hasText: 'Fs' }).locator('input');
  await fsInput.fill(String(before + 6));
  await fsInput.dispatchEvent('input');

  expect(await readFs()).toBeCloseTo(before + 6, 1); // effective driver previews the what-if live
  await expect(unsaved).toBeHidden();                // ...but the project is NOT dirtied yet

  await tune.locator('button', { hasText: 'Keep' }).click();
  await expect(tune).toBeHidden();
  await expect(unsaved).toBeVisible();               // Keep commits it → now modified
  expect(await readFs()).toBeCloseTo(before + 6, 1); // and the value stuck
});

test('the Tune fields accept multi-character typing (no reformat-while-typing clobber)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
  const fsInput = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).locator('input');
  await fsInput.click();
  await fsInput.press('Control+a');
  await fsInput.pressSequentially('42'); // type char-by-char, like a real user
  await expect(fsInput).toHaveValue('42');
  const fs = await page.evaluate(async () => {
    const modPath = '/src/store.ts';
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
  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
  const tuneInputs = await page.locator('.tune-panel input[type="number"]').all();
  for (let i = 0; i < tuneInputs.length; i++) checked += await assertSpinnerHoldsDp(tuneInputs[i], `Tune #${i}`);

  // Guard against a selector that silently matches nothing (which would make the sweep a no-op
  // and pass vacuously). The Original skin has well over a dozen numeric spinners across types.
  expect(checked, 'class-level sweep visited too few spinners — selector likely drifted').toBeGreaterThan(12);
});

test('Original save bar is no taller than its buttons (compact legend)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const { legendH, btnH } = await page.evaluate(() => {
    const legend = document.querySelector('.parstate-legend') as HTMLElement;
    const btns = [...document.querySelectorAll('.parstate-legend .save-btn')] as HTMLElement[];
    const btnH = Math.max(...btns.map((b) => b.getBoundingClientRect().height));
    return { legendH: legend.getBoundingClientRect().height, btnH };
  });
  expect(legendH).toBeLessThanOrEqual(btnH + 4); // bar hugs the button height, no extra vertical bulk
});

test('Signal tab: Series resistance shows WinISD 3-dp precision (0.100 ohm)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  const rs = page.locator('.field', { hasText: 'Series resistance' }).locator('input');
  await expect(rs).toHaveValue(/^\d+\.\d{3}$/); // WinISD shows series resistance to 3 dp
});

test('Signal tab: Driver input voltage is editable and drives System input power (W↔V, P=V²/Re)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  const re = await page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.driver.value.Re;
  });
  const vInput = page.locator('.field', { hasText: 'Driver input voltage' }).locator('input');
  await vInput.fill('20');
  await vInput.dispatchEvent('input');
  await vInput.blur();
  const pin = await page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.state.P.Pin;
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
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return s.state.project.name;
  });
  expect(name).toBe('My Sub Build');
  await expect(page.locator('.titlebar')).toContainText('My Sub Build');
});

test('New Project starts fresh — it discards the previous design (filters, compare, params)', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.skin-picker select').selectOption('original');

  // Dirty the current design: a filter, a pinned compare trace, a non-default power.
  await page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    s.state.P.filters.push({ type: 'highpass', fc: 30, Q: 0.7, gain: 0 });
    s.state.P.Pin = 250;
    s.pinCompare();
  });

  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal.locator('.np-warn')).toBeVisible();   // data-loss guard warns about unsaved changes
  await modal.locator('button', { hasText: 'Next' }).click();  // step 1 name → skip
  await modal.locator('select').selectOption('sealed');        // step 2 box type
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click(); // step 3 volume → create

  const st = await page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return { filters: s.state.P.filters.length, compare: s.state.compare.length, pin: s.state.P.Pin };
  });
  expect(st.filters).toBe(0);  // fresh project — no inherited filters
  expect(st.compare).toBe(0);  // no inherited compare traces
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
    const modPath = '/src/store.ts';
    const s = await import(/* @vite-ignore */ modPath);
    return { box: s.state.box, vb: s.state.P.Vb, browse: s.state.browseOpen };
  });
  expect(st.box).toBe('vented');
  expect(st.vb).toBeCloseTo(0.042, 3); // 42 L → 0.042 m³
  expect(st.browse).toBe(true); // hands off to the driver picker
});

test('Original toolbar: Copy share link writes the design into the address bar', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {})); // if clipboard is blocked, shareLink falls back to prompt()
  await page.locator('.tb-btn[title="Save As"]').click();
  await page.locator('.menu-item', { hasText: 'Copy share link' }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
});

test('the Save bar tracks modified state; Save adopts it, Reset reverts it (STATE_MODEL ground↔modified)', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.project-nav li', { hasText: 'Box' }).click();

  const unsaved = page.locator('.unsaved-label');
  const boxSel = page.locator('select#og-box-type');
  await expect(unsaved).toBeHidden(); // fresh load = ground = clean

  await boxSel.selectOption('sealed');            // change the design → modified
  await expect(unsaved).toBeVisible();

  await page.locator('.save-btn', { hasText: 'Reset state' }).click(); // revert to ground
  await expect(unsaved).toBeHidden();
  await expect(boxSel).toHaveValue('vented');     // back to the ground box type

  await boxSel.selectOption('sealed');            // change again
  await expect(unsaved).toBeVisible();
  await page.locator('.save-btn', { hasText: 'Save Changes' }).click(); // adopt as ground
  await expect(unsaved).toBeHidden();
  await expect(boxSel).toHaveValue('sealed');     // kept the change; now it's the ground
});

test('the chosen skin is remembered across a reload (local preference)', async ({ page }) => {
  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
});

test('R1: an open Driver Editor is reopened after a reload', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await expect(page.locator('.overlay.on')).toContainText('Driver editor');

  await page.waitForFunction(() => (localStorage.getItem('openisd.state') || '').includes('originalEditorOpen'),
    undefined, { timeout: 5000 });
  await page.reload();
  await expect(page.locator('.overlay.on')).toContainText('Driver editor'); // reopened after refresh
});

test('R1: an open Tune with uncommitted what-if values is preserved across a reload', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
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
  await page.locator('.skin-picker select').selectOption('original');

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
