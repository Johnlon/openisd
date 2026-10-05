import {expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

/**
 * The Original shell's chart area: the chart menu (which charts exist for the open box, stacking,
 * "Charts high"), the cursor readout and level lines, maximise, the trace colour, and the empty
 * state before any project is open.
 */

// Count horizontal dark line clusters on the graph canvas (the level lines are drawn in
// the dark translucent cursor/band colours; the light grid and the yellow-green trace do
// not match the predicate). A "cluster" is a run of adjacent qualifying pixel rows.
async function levelLineClusters(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.graph-wrap canvas');
    if (!(c instanceof HTMLCanvasElement)) throw new Error('.graph-wrap canvas is not a <canvas>');
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const img = ctx.getImageData(0, 0, W, H).data;
    const x0 = Math.floor(W * 0.2), x1 = Math.floor(W * 0.93);
    const rows: number[] = [];
    for (let y = 22; y < H - 24; y++) {
      let n = 0;
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        if (img[i + 3] > 35 && img[i] < 140 && img[i + 1] < 140 && img[i + 2] < 140) n++;
      }
      // 10%, not a majority: where the response is flat the curve is drawn ON TOP of its own
      // level line for most of the plot width, leaving only the dashed pixels either side of
      // the band. At 20% that line went uncounted and a two-cursor selection read as one.
      if (n > (x1 - x0) * 0.1) rows.push(y);
    }
    let clusters = 0, prev = -10;
    for (const y of rows) { if (y > prev + 2) clusters++; prev = y; }
    return clusters;
  });
}

test.describe('Original chart view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('the chart-select dropdown switches the shared GraphPanel', async ({ page }) => {
    await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
    await page.locator('.chart-select').click();
    await page.locator('.chart-select .menu-item', { hasText: /^Cone excursion$/ }).click();
    await expect(page.locator('.chart-select .chart-name')).toHaveText('Cone excursion');
    await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
  });

  test('chart-menu checkboxes stack charts that share one cursor; ✕ removes one; a label shows it alone', async ({ page }) => {
    const panels = page.locator('.graph-wrap .gpanel');
    await expect(panels).toHaveCount(1);

    await page.locator('.chart-select').click();
    await page.locator('.chart-select .menu-item', { hasText: /^Cone excursion$/ }).locator('input[type=checkbox]').click();
    await page.locator('.chart-select .menu-item', { hasText: /^Impedance$/ }).locator('input[type=checkbox]').click();
    await expect(page.locator('.chart-select .dropdown-menu')).toBeVisible(); // ticking leaves the menu open
    await page.locator('.chart-select').click(); // close
    await expect(panels).toHaveCount(3);

    // Hovering one chart moves the cursor on every chart: each panel draws its own readout.
    const box = (await panels.nth(1).locator('canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    for (let i = 0; i < 3; i++) await expect(panels.nth(i).locator('.gread')).toContainText('Hz');

    // The open charts are the project's own: they survive a reload.
    await page.reload();
    await expect(panels).toHaveCount(3);

    await page.locator('.chart-cell').nth(0).locator('.chart-close').click();
    await expect(panels).toHaveCount(2);

    await page.locator('.chart-select').click();
    await page.locator('.chart-select .menu-item', { hasText: /^Group Delay$/ }).click();
    await expect(panels).toHaveCount(1);
    await expect(page.locator('.chart-select .chart-name')).toHaveText('Group Delay');
    await expect(page.locator('.chart-close')).toHaveCount(0);
  });

  test('"Charts high" stacks that many charts in the height; more open charts add columns', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.locator('.chart-select').click();
    for (const name of [/^Cone excursion$/, /^Impedance$/, /^Group Delay$/])
      await page.locator('.chart-select .menu-item', { hasText: name }).locator('input[type=checkbox]').click();
    await page.locator('.chart-select').click();
    const lefts = () => page.locator('.chart-cell').evaluateAll(cs => cs.map(c => Math.round(c.getBoundingClientRect().left)));
    const high = page.locator('.chart-high select');

    await high.selectOption('4');
    await expect.poll(async () => new Set(await lefts()).size).toBe(1);

    await high.selectOption('3');
    await expect.poll(async () => new Set(await lefts()).size).toBe(2);
  });

  test('the chart menu lists only the charts that apply to the current box', async ({ page }) => {
    const menuItems = () => page.locator('.chart-select .menu-item');

    // The sample project opens vented: its own port charts are in the menu, no PR chart.
    await page.locator('.chart-select').click();
    await expect(menuItems().filter({ hasText: 'Rear port - Air velocity' })).toBeVisible();
    await expect(menuItems().filter({ hasText: 'Rear port - Gain' })).toBeVisible();
    await expect(menuItems().filter({ hasText: 'Transfer function magnitude (PR)' })).toHaveCount(0);
    await expect(menuItems().filter({ hasText: 'Cone excursion (PR)' })).toHaveCount(0);
    await page.locator('.chart-select').click(); // close

    // Switch to sealed: the port charts drop out, still no PR chart.
    await setFocusedBoxType(page, 'sealed');
    await page.locator('.chart-select').click();
    await expect(menuItems().filter({ hasText: /port - Air velocity$/i })).toHaveCount(0);
    await expect(menuItems().filter({ hasText: 'Rear port - Gain' })).toHaveCount(0);
    await expect(menuItems().filter({ hasText: 'Transfer function magnitude (PR)' })).toHaveCount(0);
    await page.locator('.chart-select').click();

    // Switch to passive radiator: the three PR charts join, no port chart.
    await setFocusedBoxType(page, 'box-passive-radiator');
    await page.locator('.chart-select').click();
    await expect(menuItems().filter({ hasText: 'Transfer function magnitude (PR)' })).toBeVisible();
    await expect(menuItems().filter({ hasText: 'Transfer function phase (PR)' })).toBeVisible();
    await expect(menuItems().filter({ hasText: 'Cone excursion (PR)' })).toBeVisible();
    await expect(menuItems().filter({ hasText: /port - Air velocity$/i })).toHaveCount(0);
    await expect(menuItems().filter({ hasText: 'Rear port - Gain' })).toHaveCount(0);
    await expect(menuItems().filter({ hasText: 'Front port - Gain' })).toHaveCount(0);
    await page.locator('.chart-select').click();

    // Switch to 4th-order bandpass: front port charts join, no rear port, no PR.
    await setFocusedBoxType(page, 'bandpass4');
    await page.locator('.chart-select').click();
    await expect(menuItems().filter({ hasText: 'Front port - Air velocity' })).toBeVisible();
    await expect(menuItems().filter({ hasText: 'Front port - Gain' })).toBeVisible();
    await expect(menuItems().filter({ hasText: 'Rear port - Air velocity' })).toHaveCount(0);
    await expect(menuItems().filter({ hasText: 'Rear port - Gain' })).toHaveCount(0);
    await expect(menuItems().filter({ hasText: 'Transfer function magnitude (PR)' })).toHaveCount(0);
    await page.locator('.chart-select').click();

    // Switch to 6th-order bandpass: both ports, both gains (WinISD draws both; runs/bp6-w5-base2).
    await setFocusedBoxType(page, 'bandpass6');
    await page.locator('.chart-select').click();
    await expect(menuItems().filter({ hasText: 'Rear port - Gain' })).toBeVisible();
    await expect(menuItems().filter({ hasText: 'Front port - Gain' })).toBeVisible();
  });

  test('the Amplifier apparent load power (VA) chart reads out in VA at the cursor', async ({ page }) => {
    await page.locator('.chart-select').click();
    await page.locator('.chart-select .menu-item', { hasText: 'Amplifier apparent load power (VA)' }).click();
    await expect(page.locator('.chart-select .chart-name')).toHaveText('Amplifier apparent load power (VA)');
    await page.locator('.ro-hz-input').fill('1000');
    await page.locator('.ro-hz-input').press('Enter');
    await expect(page.locator('.ro-val')).toHaveText(/^\d+\.\d{3} VA$/);
  });

  test('the ◄ and ► nudge buttons step the cursor frequency down and up by 2 %', async ({ page }) => {
    const hz = page.locator('.ro-hz-input');
    await hz.fill('100');
    await hz.press('Enter');
    await expect(hz).toHaveValue('100.00');

    await page.locator('.nudge-btn', { hasText: '►' }).click();
    await expect(hz).toHaveValue('102.00');
    await page.locator('.nudge-btn', { hasText: '◄' }).click();
    await expect(hz).toHaveValue('100.00');
    await page.locator('.nudge-btn', { hasText: '◄' }).click();
    await expect(hz).toHaveValue('98.04');
  });

  test('a click on the chart locks the cursor: moving the pointer afterwards leaves it put', async ({ page }) => {
    const box = (await page.locator('.graph-wrap canvas').boundingBox())!;
    const y = box.y + box.height * 0.5;
    const hz = page.locator('.ro-hz-input');

    await page.mouse.click(box.x + box.width * 0.5, y);
    await expect(hz).not.toHaveValue('');
    const locked = await hz.inputValue();

    await page.mouse.move(box.x + box.width * 0.75, y, { steps: 4 });
    await expect(hz).toHaveValue(locked);
  });

  test('the chart drop-down is a fixed width, and the longest chart name fits in it on one line', async ({ page }) => {
    const select = page.locator('.chart-select');
    const name = page.locator('.chart-select .chart-name');
    const widths: number[] = [];
    for (const label of ['SPL', 'Transfer function magnitude (EQ/Filter)']) {
      await select.click();
      await page.locator('.chart-select .menu-item', { hasText: label }).first().click();
      widths.push((await select.boundingBox())!.width);
      expect(await name.evaluate(el => el.scrollWidth <= el.clientWidth && el.getClientRects()[0].height < 30)).toBe(true);
    }
    expect(widths[0]).toBe(widths[1]);
  });

  test('chart maximise fills the main area, keeps the toolbar, and restores', async ({ page }) => {
    // Two toolbar buttons share `.chart-max-btn` (⟲ reset-all-charts and this ⛶ maximise
    // toggle) — address the maximise one by its role-bearing title.
    const maxBtn = page.locator('.chart-max-btn[title*="Maximise the chart"], .chart-max-btn[title*="Restore the normal layout"]');
    await maxBtn.click();
    await expect(page.locator('.quad-topleft')).toBeHidden();
    await expect(page.locator('.content-panel')).toBeHidden();
    await expect(page.locator('.toolbar')).toBeVisible();       // chart type still switchable
    const graph = (await page.locator('.graph-area').boundingBox())!;
    const main = (await page.locator('.original-root .main').boundingBox())!;
    expect(graph.width).toBeGreaterThan(main.width * 0.95);
    await maxBtn.click();
    await expect(page.locator('.quad-topleft')).toBeVisible();
    await expect(page.locator('.content-panel')).toBeVisible();
  });

  test('hovering the chart draws ONE horizontal level line where the cursor crosses the curve', async ({ page }) => {
    const box = (await page.locator('.graph-wrap canvas').boundingBox())!;
    expect(await levelLineClusters(page)).toBe(0);
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
    await page.waitForFunction(() => true); // yield a frame for the redraw watch
    await expect.poll(() => levelLineClusters(page)).toBe(1);
  });

  test('a drag-select draws a horizontal level line for BOTH selection cursors', async ({ page }) => {
    const box = (await page.locator('.graph-wrap canvas').boundingBox())!;
    const y = box.y + box.height * 0.5;
    // Double-click the X-axis strip: resets the frequency window to 1 Hz – 20 kHz, so the
    // fractions below mean the same frequencies whatever window the view state was restored with.
    await page.mouse.dblclick(box.x + box.width * 0.5, box.y + box.height - 6);
    // Drag across the bass knee (≈22–120 Hz). Two constraints on where: it must START inside the
    // plot, because the strip left of it is the Y-axis pan/zoom control and a drag there is a
    // level gesture, not a band; and it must SPAN the knee, because in a flat region both level
    // lines land on the same pixels and read as one, which would not prove the second cursor's
    // line exists at all.
    await page.mouse.move(box.x + box.width * 0.34, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.50, y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => levelLineClusters(page)).toBe(2);
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

  test('the trace colour chosen with the Color button survives a reload (saved in the project)', async ({ page }) => {
    const colorBtn = page.locator('.chart-color-btn');
    const before = await colorBtn.evaluate(el => getComputedStyle(el).backgroundColor);
    await colorBtn.click();
    await expect.poll(() => colorBtn.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
    const chosen = await colorBtn.evaluate(el => getComputedStyle(el).backgroundColor);

    await page.reload();

    await expect.poll(() => page.locator('.chart-color-btn').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(chosen);
  });
});

test.describe('Original chart view with no project open', () => {
  test('the chart area with no project open offers icon links for New, Open, and Import', async ({ page }) => {
    await page.goto('/');

    const emptyState = page.locator('.graph-empty');
    await expect(emptyState).toContainText('Open or Create a project for charts');
    await expect(emptyState.getByRole('button', { name: 'New project' })).toBeVisible();
    await expect(emptyState.getByRole('button', { name: 'Open project' })).toBeVisible();
    await expect(emptyState.getByRole('button', { name: 'Import project' })).toBeVisible();

    await emptyState.getByRole('button', { name: 'Open project' }).click();
    await expect(page.locator('.open-project-dialog')).toBeVisible();
  });
});
