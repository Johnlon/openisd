/**
 * Original (WinISD) skin — the wholesale port of the `mock/` prototype, wired to the
 * shared store/engine. Selecting it swaps the whole shell; the reused chart + panels
 * drive the same store, so no shell forks logic. These tests assert the skin seam plus
 * the mock-fidelity regions (toolbar icons, chart-select dropdown, all 7 tabs, the
 * Placement/Advanced/Listening-place sections, box types, and the box-losses modal).
 * The auto console/network guardrail (fixtures) asserts the skin swap raises no errors.
 */
import { test, expect } from './fixtures.js';

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

test('the chosen skin is remembered across a reload (local preference)', async ({ page }) => {
  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
});
