/**
 * Original (WinISD) skin — narrow-window rendering.
 *
 * Real WinISD is a Win32 window: child controls sit at fixed offsets and the client area
 * CLIPS when the window is too small — controls never reflow and never paint over each
 * other. The web port must match that: when the content panel is too narrow, its panes
 * scroll horizontally; they must NEVER overlap.
 *
 * The bug this locks out: a pane column that shrinks below its content's intrinsic width
 * while the content keeps its own width, so the next column's controls paint on top of the
 * previous column's overflow (human-reported 2026-07-23, Advanced + Driver panes).
 *
 * Assertion is geometric, not CSS-specific — any future layout that reintroduces the class
 * fails here regardless of which property caused it.
 */
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

/** Widths a browser window realistically reaches; all must clip/scroll, never overlap. */
const WIDTHS = [1280, 1024, 900, 780];

type Overlap = { a: string; b: string; w: number; h: number };

/**
 * Pairwise intersection of every laid-out control in the ACTIVE pane. Controls are leaf
 * boxes (`.field` wraps one label+input+unit; checkbox rows and hints are their own boxes),
 * so no pair is ever an ancestor of the other and any intersection is a real collision.
 */
async function overlappingControls(page: Page): Promise<Overlap[]> {
  return page.evaluate(() => {
    const sel = '.tab-section.active .field, .tab-section.active .checkbox-col label, .tab-section.active .hint';
    const nodes = [...document.querySelectorAll(sel)] as HTMLElement[];
    const boxes = nodes
      .map(n => ({ r: n.getBoundingClientRect(), t: (n.textContent || '').trim().slice(0, 40) }))
      .filter(b => b.r.width > 0 && b.r.height > 0);
    const hits: Overlap[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // >1px on both axes: ignore sub-pixel rounding of adjacent boxes.
        if (w > 1 && h > 1) hits.push({ a: boxes[i].t, b: boxes[j].t, w, h });
      }
    }
    return hits;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await expect(page.locator('.original-root')).toBeVisible();
});

for (const width of WIDTHS) {
  test(`no pane overlaps its own controls at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const tabs = page.locator('.project-nav li');
    const panes = await tabs.allInnerTexts();
    expect(panes.length).toBeGreaterThan(4);        // guard: a silent nav change must not empty the sweep
    for (let i = 0; i < panes.length; i++) {
      await tabs.nth(i).click();
      await expect(page.locator('.tab-section.active')).toBeVisible();
      const hits = await overlappingControls(page);
      expect(hits, `${panes[i]} pane at ${width}px: ${JSON.stringify(hits)}`).toEqual([]);
    }
  });
}

test('the box cut-through diagram sits at the same x for every box type', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: /^Box$/ }).click();
  const select = page.locator('#og-box-type');
  const types = await select.locator('option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value));
  expect(types.length).toBeGreaterThan(3);

  const lefts: Record<string, number> = {};
  for (const t of types) {
    await select.selectOption(t);
    const diagram = (await page.locator('.box-diagram-col').boundingBox())!;
    const row = (await page.locator('.box-tab-row').boundingBox())!;
    lefts[t] = Math.round(diagram.x - row.x);       // offset within the pane, viewport-independent
  }
  const distinct = [...new Set(Object.values(lefts))];
  expect(distinct, `diagram x per box type: ${JSON.stringify(lefts)}`).toHaveLength(1);
});

test('a too-narrow content pane scrolls horizontally instead of squeezing its columns', async ({ page }) => {
  await page.setViewportSize({ width: 780, height: 900 });
  await page.locator('.project-nav li', { hasText: /^Advanced$/ }).click();
  const pane = page.locator('.tab-section.active');
  await expect(pane).toBeVisible();
  const { scrollW, clientW } = await pane.evaluate(el => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }));
  expect(scrollW).toBeGreaterThan(clientW);   // content kept its width — the pane scrolls
});
