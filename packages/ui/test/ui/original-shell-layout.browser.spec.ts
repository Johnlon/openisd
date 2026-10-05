import {expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

/**
 * The Original shell's frame: the panes (projects list, tab pane, chart), the splitters between
 * them, the save rail, and how the frame behaves in a narrow or short window.
 *
 * Real WinISD is a Win32 window: child controls sit at fixed offsets and the client area CLIPS
 * when the window is too small — controls never reflow and never paint over each other. The
 * web port must match: a too-narrow content panel scrolls horizontally and must never overlap
 * its controls (human-reported 2026-07-23). The geometry checks are CSS-agnostic, so any layout
 * that reintroduces the class fails regardless of which property caused it.
 */

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
    const nodes = [...document.querySelectorAll(sel)];
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
  await openAProject(page);
});

test.describe('Original shell layout', () => {
  test.describe('frame', () => {
    test('choosing Original swaps to the ported WinISD shell (titlebar, projects, graph)', async ({ page }) => {
      await expect(page.locator('.original-root')).toContainText('Projects');
      await expect(page.locator('.original-root')).toContainText('Signal Generator');
      await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
    });

    test('all seven project tabs render their ported content', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await page.locator('#og-box-type').selectOption('vented');
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

    test('What-if? is below the right-edge legend, not in the Driver row', async ({ page }) => {
      const legend = page.locator('.value-legend');
      const whatIf = page.locator('.save-rail .what-if-btn');

      await expect(legend).toBeVisible();
      await expect(whatIf).toHaveCount(1);
      await expect(page.locator('.driver-id-row .what-if-btn')).toHaveCount(0);

      const legendBottom = await legend.evaluate(element => element.getBoundingClientRect().bottom);
      const whatIfTop = await whatIf.evaluate(element => element.getBoundingClientRect().top);
      expect(whatIfTop).toBeGreaterThanOrEqual(legendBottom);
    });

    test('Original save buttons sit in a right-edge rail beside the tabs (no vertical space consumed)', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      const { railLeft, tabsRight, railTop, tabsTop } = await page.evaluate((): { railLeft: number; tabsRight: number; railTop: number; tabsTop: number } => {
        const railEl = document.querySelector('.save-rail');
        const tabsEl = document.querySelector('.content-tabs');
        if (!railEl || !tabsEl) throw new Error('save-rail/content-tabs not found');
        const rail = railEl.getBoundingClientRect();
        const tabs = tabsEl.getBoundingClientRect();
        return { railLeft: rail.left, tabsRight: tabs.right, railTop: rail.top, tabsTop: tabs.top };
      });
      expect(railLeft).toBeGreaterThanOrEqual(tabsRight); // rail is beside the tab content, not above it
      expect(Math.abs(railTop - tabsTop)).toBeLessThanOrEqual(4); // both start at the top of the panel
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
  });

  test.describe('splitters', () => {
    test('the left panel collapses and expands via the splitter toggle', async ({ page }) => {
      await expect(page.locator('.quad-topleft')).toBeVisible();
      await page.locator('.split-v .split-toggle').click();
      await expect(page.locator('.quad-topleft')).toBeHidden();
      await page.locator('.split-v .split-toggle').click();
      await expect(page.locator('.quad-topleft')).toBeVisible();
    });

    test('the left panel resizes by dragging the vertical splitter', async ({ page }) => {
      const before = (await page.locator('.quad-topleft').boundingBox())!;
      const split = (await page.locator('.split-v').boundingBox())!;
      await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2);
      await page.mouse.down();
      await page.mouse.move(split.x + split.width / 2 + 80, split.y + split.height / 2, { steps: 4 });
      await page.mouse.up();
      const after = (await page.locator('.quad-topleft').boundingBox())!;
      expect(after.width).toBeGreaterThan(before.width + 50);
    });

    test('the bottom section collapses (chart grows) and expands via the splitter toggle', async ({ page }) => {
      const graphBefore = (await page.locator('.graph-area').boundingBox())!;
      await page.locator('.split-h .split-toggle').click();
      await expect(page.locator('.content-panel')).toBeHidden();
      const graphAfter = (await page.locator('.graph-area').boundingBox())!;
      expect(graphAfter.height).toBeGreaterThan(graphBefore.height + 100);
      await page.locator('.split-h .split-toggle').click();
      await expect(page.locator('.content-panel')).toBeVisible();
    });

    test('the bottom section resizes by dragging the horizontal splitter', async ({ page }) => {
      const before = (await page.locator('.content-panel').boundingBox())!;
      const split = (await page.locator('.split-h').boundingBox())!;
      await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2);
      await page.mouse.down();
      await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2 - 60, { steps: 4 });
      await page.mouse.up();
      const after = (await page.locator('.content-panel').boundingBox())!;
      expect(after.height).toBeGreaterThan(before.height + 40);
    });
  });

  test.describe('narrow window', () => {
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

    test('a too-narrow content pane scrolls horizontally instead of squeezing its columns', async ({ page }) => {
      await page.setViewportSize({ width: 780, height: 900 });
      await page.locator('.project-nav li', { hasText: /^Advanced$/ }).click();
      const pane = page.locator('.tab-section.active');
      await expect(pane).toBeVisible();
      const { scrollW, clientW } = await pane.evaluate(el => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }));
      expect(scrollW).toBeGreaterThan(clientW);   // content kept its width — the pane scrolls
    });
  });

  test.describe('box type changes', () => {
    test('the bottom panel keeps ONE height across box types (no wobble from the tab count)', async ({ page }) => {
      const select = page.locator('#og-box-type');
      await page.locator('.project-nav li', { hasText: /^Box$/ }).click();
      const boxes = await select.locator('option').evaluateAll(os => os.map(o => {
        if (!(o instanceof HTMLOptionElement)) throw new Error('locator("option") matched a non-<option> element');
        return o.value;
      }));
      expect(boxes.length).toBeGreaterThan(3);

      const heights: Record<string, number> = {};
      let maxClip = 0;
      for (const b of boxes) {
        await page.locator('.project-nav li', { hasText: /^Box$/ }).click();
        await select.selectOption(b);
        const m = await page.locator('.content-panel').evaluate(el => ({
          h: Math.round(el.getBoundingClientRect().height),
          // The left rail (tabs + projects list) shares the row; if the fixed height clips it
          // the tabs would be unreachable. scrollHeight-clientHeight must stay ~0.
          railClip: (() => {
            const rail = el.parentElement!.querySelector('.quad-bottomleft');
            return rail ? Math.round(rail.scrollHeight - rail.clientHeight) : 999;
          })(),
        }));
        heights[b] = m.h;
        maxClip = Math.max(maxClip, m.railClip);
      }
      const distinct = [...new Set(Object.values(heights))];
      // Sealed shows 6 nav tabs, every other box 7; an auto-sized row tracked that difference
      // and the chart above visibly re-flowed ("wobble"). A fixed natural default kills it.
      expect(distinct, `panel height per box type: ${JSON.stringify(heights)}`).toHaveLength(1);
      expect(maxClip, 'the 7-tab rail must not be clipped by the fixed height').toBeLessThanOrEqual(1);
      // Natural height, not stretched to fill: the tallest content is ~181px + panel chrome.
      // A regression that let the row grow toward 45vh (~405px at 900px tall) fails here.
      expect(distinct[0]).toBeLessThan(240);
    });
  });

  test.describe('short window', () => {
    async function checkScrollbars(page: Page) {
      return page.evaluate(() => {
        const el = document.querySelector('.tab-section.active');
        if (!el) return { hasVScroll: false, hasHScroll: false, error: 'Active tab-section not found' };
    
        // Check if vertical or horizontal scrollbar is present.
        // scrollHeight > clientHeight (with 1px buffer to avoid subpixel/scaling rounding issues)
        // scrollWidth > clientWidth (with 1px buffer)
        const hasVScroll = el.scrollHeight > el.clientHeight + 1;
        const hasHScroll = el.scrollWidth > el.clientWidth + 1;
    
        return {
          hasVScroll,
          hasHScroll,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        };
      });
    }

    async function checkNoChildOverflows(page: Page) {
      return page.evaluate(() => {
        const container = document.querySelector('.tab-section.active');
        if (!container) return { ok: false, error: 'Active tab-section not found' };
    
        const containerRect = container.getBoundingClientRect();
        const children = container.querySelectorAll('*');
        const overflows: string[] = [];
    
        for (const el of children) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
      
          // Check if child bottom or right boundaries extend past container limits.
          // Allow a subpixel rounding buffer of 1px.
          if (rect.bottom > containerRect.bottom + 1) {
            overflows.push(`${el.tagName}.${el.className.split(' ').join('.')} bottom(${rect.bottom.toFixed(1)}) > container(${containerRect.bottom.toFixed(1)})`);
          }
          if (rect.right > containerRect.right + 1) {
            overflows.push(`${el.tagName}.${el.className.split(' ').join('.')} right(${rect.right.toFixed(1)}) > container(${containerRect.right.toFixed(1)})`);
          }
        }
    
        return {
          ok: overflows.length === 0,
          overflows
        };
      });
    }

    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 400 });
    });

    test('bottom panels at a short window height never get scrollbars and contents do not overflow', async ({ page }) => {
      test.setTimeout(30000);
      const boxTypes = ['vented', 'sealed', 'bandpass4', 'bandpass6', 'abc'] as const;
  
      for (const boxType of boxTypes) {
        await setFocusedBoxType(page, boxType);
    
        // Iterate through all visible tabs for this box type
        const tabs = page.locator('.project-nav li');
        const count = await tabs.count();
    
        for (let i = 0; i < count; i++) {
          const tabName = await tabs.nth(i).innerText();
          await tabs.nth(i).click();
      
          const res = await checkScrollbars(page);
          expect(
            res.hasVScroll,
            `Tab "${tabName}" for box type "${boxType}" should not have a vertical scrollbar. Details: ${JSON.stringify(res)}`
          ).toBe(false);
          expect(
            res.hasHScroll,
            `Tab "${tabName}" for box type "${boxType}" should not have a horizontal scrollbar. Details: ${JSON.stringify(res)}`
          ).toBe(false);

          const overflowRes = await checkNoChildOverflows(page);
          expect(
            overflowRes.ok,
            `Tab "${tabName}" for box type "${boxType}" contains elements overflowing the container panel. Overflowing elements: ${JSON.stringify(overflowRes.overflows)}`
          ).toBe(true);
        }
      }
    });
  });
});
