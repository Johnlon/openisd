/**
 * Driver editor LAYOUT — facts only a rendered browser can state.
 *
 * Every assertion here is a measurement, not a class name. A label that overflows its box still
 * has the right text and the right classes; the markup looks perfect and the panel is unusable.
 * The faults these pin were all shipped past a green suite:
 * `bugs/BUG_20260817_driver_editor_labels_overflow_a_fixed_62px_column.md`.
 */
import { test, expect } from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
});

async function openEditor(page: import('@playwright/test').Page, tab: string) {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

/**
 * Given one section's row widths in visual order, the rows that are full width DESPITE a
 * shorter row already appearing above them.
 *
 * Only a TRAILING run of rows may be short — the remainder, plus any field deliberately forced
 * onto its own row (Connection, under Voicecoils). A full-width row after a short one means the
 * grid resumed packing once it had already spilled over, which is the shape a stray field in
 * the wrong column produces.
 */
function fullRowsAfterAShortOne(section: number[]): number[] {
  const full = section[0]!;
  let sawShort = false;
  const wrong: number[] = [];
  for (const n of section) {
    if (n !== full) sawShort = true;
    else if (sawShort) wrong.push(n);
  }
  return wrong;
}

/** Per-field geometry, read from the live layout. */
async function fields(page: import('@playwright/test').Page, scope: string) {
  return page.evaluate((sel) => {
    const out: Array<{
      label: string; clipped: number; overlap: number; highlightLeftOfText: number;
    }> = [];
    for (const fld of document.querySelectorAll<HTMLElement>(`${sel} .de-fld`)) {
      const label = fld.querySelector('label');
      const input = fld.querySelector('input, select');
      if (!label || !input) continue;

      const lb = label.getBoundingClientRect();
      const ib = input.getBoundingClientRect();
      const fb = fld.getBoundingClientRect();

      // Where the label's TEXT actually starts, which is not where its box starts when the box
      // is wider than the text and the text is right-aligned.
      const range = document.createRange();
      range.selectNodeContents(label);
      const tb = range.getBoundingClientRect();

      out.push({
        label: (label.textContent || '').trim(),
        // >0 means the text is wider than the box that holds it: clipped or overflowing.
        clipped: label.scrollWidth - label.clientWidth,
        // >0 means the label box runs into the input.
        overlap: Math.round(lb.right - ib.left),
        // How far the highlighted field box extends to the LEFT of the label's own text.
        highlightLeftOfText: Math.round(tb.left - fb.left),
      });
    }
    return out;
  }, scope);
}

for (const tab of ['Parameters', 'Advanced parameters', 'Dimensions']) {
  test(`${tab}: no label is clipped or overflowing its box`, async ({ page }) => {
    await openEditor(page, tab);
    const bad = (await fields(page, '.de-body')).filter(f => f.clipped > 1);
    expect(bad.map(f => `${f.label} overflows by ${f.clipped}px`),
      'a label wider than its box paints over whatever follows it').toEqual([]);
  });

  test(`${tab}: no label overlaps its input`, async ({ page }) => {
    await openEditor(page, tab);
    const bad = (await fields(page, '.de-body')).filter(f => f.overlap > 0);
    expect(bad.map(f => `${f.label} overlaps its input by ${f.overlap}px`)).toEqual([]);
  });

  test(`${tab}: the field highlight starts at the label, not far left of it`, async ({ page }) => {
    await openEditor(page, tab);
    // `.de-fld` carries the provenance highlight. A fixed-width right-aligned label leaves dead
    // space to the left of a short name, and the highlight covers it — a box that looks like it
    // belongs to nothing. A small padding allowance is fine; 20px of empty box is not.
    const bad = (await fields(page, '.de-body')).filter(f => f.highlightLeftOfText > 12);
    expect(bad.map(f => `${f.label}: highlight starts ${f.highlightLeftOfText}px left of the text`))
      .toEqual([]);
  });

  test(`${tab}: the editor does not scroll horizontally`, async ({ page }) => {
    await openEditor(page, tab);
    const over = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.de-modal');
      if (!el) return { where: 'no .de-modal', by: 0 };
      const body = document.querySelector<HTMLElement>('.de-body');
      return {
        where: '.de-modal',
        by: Math.max(
          el.scrollWidth - el.clientWidth,
          body ? body.scrollWidth - body.clientWidth : 0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      };
    });
    expect(over.by, `content runs ${over.by}px past the editor's width, forcing a sideways scroll`)
      .toBeLessThanOrEqual(1);
  });
}

/**
 * Parameters and Advanced are COLUMNS, not a bag of boxes.
 *
 * Every `.de-cols` section lays its fields out in a grid, and a grid whose cells do not share
 * column edges is a list with extra steps: the eye has nothing to track down, and the panel
 * reads as scattered even though every individual field is correct. WinISD's own editor lines
 * its labels, inputs and units up down each column, and this is the assertion that keeps it so.
 */
for (const tab of ['Parameters', 'Advanced parameters']) {
  test(`${tab}: fields in the same column share one edge`, async ({ page }) => {
    await openEditor(page, tab);
    const bad = await page.evaluate(() => {
      const problems: string[] = [];
      for (const cols of document.querySelectorAll<HTMLElement>('.de-body .de-cols')) {
        // Group the fields into visual rows by their top edge, then compare like with like:
        // the nth field of every row belongs to the nth column.
        const rows = new Map<number, Array<{ label: string; left: number }>>();
        for (const fld of cols.querySelectorAll<HTMLElement>('.de-fld')) {
          const input = fld.querySelector('input, select');
          if (!input) continue;
          const top = Math.round(fld.getBoundingClientRect().top);
          const key = [...rows.keys()].find(k => Math.abs(k - top) <= 4) ?? top;
          if (!rows.has(key)) rows.set(key, []);
          rows.get(key)!.push({
            label: (fld.querySelector('label')?.textContent || '').trim(),
            left: Math.round(input.getBoundingClientRect().left),
          });
        }
        const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
        if (ordered.length < 2) continue;
        const width = Math.max(...ordered.map(r => r.length));
        for (let col = 0; col < width; col++) {
          const cells = ordered.map(r => r[col]).filter(Boolean) as Array<{ label: string; left: number }>;
          const distinct = [...new Set(cells.map(c => c.left))];
          if (distinct.length > 1) {
            problems.push(`column ${col + 1}: ${cells.map(c => `${c.label}@${c.left}`).join(', ')}`);
          }
        }
      }
      return problems;
    });
    expect(bad, 'inputs in one column start at different x — the grid is not aligning them')
      .toEqual([]);
  });

  test(`${tab}: every row holds the same number of fields`, async ({ page }) => {
    await openEditor(page, tab);
    // A grid track that accepts an overflow field turns the last row into a different shape from
    // the rows above it, and the section stops reading as a table.
    const rows = await page.evaluate(() => {
      const out: number[][] = [];
      for (const cols of document.querySelectorAll<HTMLElement>('.de-body .de-cols')) {
        const byTop = new Map<number, number>();
        for (const fld of cols.querySelectorAll<HTMLElement>('.de-fld')) {
          const top = Math.round(fld.getBoundingClientRect().top);
          const key = [...byTop.keys()].find(k => Math.abs(k - top) <= 4) ?? top;
          byTop.set(key, (byTop.get(key) ?? 0) + 1);
        }
        out.push([...byTop.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]));
      }
      return out;
    });
    for (const section of rows) {
      expect(fullRowsAfterAShortOne(section), `section rows are ${section.join('/')} fields wide`)
        .toEqual([]);
    }
  });
}

test('Dimensions: the fields line up on ONE column edge', async ({ page }) => {
  await openEditor(page, 'Dimensions');
  // Sizing labels to content fixes the overflow, and would let every row sit at its own
  // indent unless the column is SHARED. Alignment is the reason a fixed width was used in the
  // first place, so it has to be asserted, not assumed.
  const lefts = await page.evaluate(() =>
    [...document.querySelectorAll('.de-dimlist .de-fld input')]
      .map(i => Math.round(i.getBoundingClientRect().left)));
  expect(lefts.length, 'the Dimensions tab must actually have fields').toBeGreaterThan(4);
  expect([...new Set(lefts)], 'every input in the column starts at the same x').toHaveLength(1);
});

/**
 * Cycling a unit must not move anything.
 *
 * The unit label sits in the same row as the label and the input, so a unit whose width depends
 * on its text ("mm" → "in" → "cm") resizes the row every time it is clicked, and — because the
 * grid tracks are `max-content` — drags every OTHER column with it. The panel jumps under the
 * pointer while the user is reading it.
 *
 * A unit column of fixed width is the fix, and this is what proves it: the geometry before and
 * after a cycle must be identical.
 */
test('Dimensions: cycling a unit does not move the columns', async ({ page }) => {
  await openEditor(page, 'Dimensions');

  const geometry = () => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.de-body .de-fld')].map(f => {
      const i = f.querySelector('input, select');
      return {
        label: (f.querySelector('label')?.textContent || '').trim(),
        inputLeft: i ? Math.round(i.getBoundingClientRect().left) : -1,
        fieldWidth: Math.round(f.getBoundingClientRect().width),
      };
    }));

  const before = await geometry();
  const unit = page.locator('.de-body .u, .de-body .unit-toggle').first();
  await expect(unit).toBeVisible();
  const wasText = (await unit.textContent())?.trim();

  await unit.click();
  await expect(unit).not.toHaveText(wasText ?? '', { timeout: 2000 });   // it really did cycle

  expect(await geometry(), `cycling the unit from "${wasText}" reflowed the panel`)
    .toEqual(before);
});

/**
 * General tab: the Comment box is the panel's filler.
 *
 * Manufacturer/Brand/Model and Data-provided-by/Date-added are two fixed rows; everything
 * below them belongs to Comment. It is the only field on the tab with no natural size, so it
 * takes the leftover width AND the leftover height — anything else leaves a tall narrow slot
 * beside a block of dead space.
 *
 * Every assertion is a measurement of the rendered box: a `width: 100%` in the stylesheet says
 * nothing about what the box does once another rule of equal specificity outranks it.
 */
test.describe('General: the Comment box fills the bottom of the panel', () => {
  /** Geometry of the comment field, the panel that holds it, and the row above it. */
  async function commentGeometry(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.de-general');
      const field = document.querySelector<HTMLElement>('.de-comment');
      const area = document.querySelector<HTMLElement>('.de-comment textarea');
      const rows = [...document.querySelectorAll<HTMLElement>('.de-general .de-row2')];
      if (!panel || !field || !area || !rows.length) return null;
      const pb = panel.getBoundingClientRect();
      const style = getComputedStyle(panel);
      const content = {
        left: pb.left + parseFloat(style.paddingLeft),
        right: pb.right - parseFloat(style.paddingRight),
        bottom: pb.bottom - parseFloat(style.paddingBottom),
      };
      const ab = area.getBoundingClientRect();
      const fb = field.getBoundingClientRect();
      const fs = getComputedStyle(field);
      return {
        contentWidth: Math.round(content.right - content.left),
        // The field's own content box — the box the textarea is entitled to fill.
        fieldContentWidth: Math.round(fb.width - parseFloat(fs.paddingLeft) - parseFloat(fs.paddingRight)),
        fieldWidth: Math.round(fb.width),
        areaWidth: Math.round(ab.width),
        areaHeight: Math.round(ab.height),
        // Dead space between the bottom of the box and the bottom of the panel.
        gapBelow: Math.round(content.bottom - ab.bottom),
        // The last fixed row's bottom — everything under it is Comment's to take.
        spaceAvailable: Math.round(content.bottom - rows[rows.length - 1]!.getBoundingClientRect().bottom),
      };
    });
  }

  test('it spans the full width of the panel', async ({ page }) => {
    await openEditor(page, 'General');
    const g = await commentGeometry(page);
    expect(g, 'the General tab must render a comment field inside .de-general').not.toBeNull();
    expect(g!.contentWidth, 'sanity: the General panel has a real width').toBeGreaterThan(400);
    expect(g!.fieldWidth,
      `the comment field is ${g!.fieldWidth}px inside a ${g!.contentWidth}px panel — ` +
      'a narrow slot with dead space beside it').toBeGreaterThanOrEqual(g!.contentWidth - 1);
    expect(g!.areaWidth, 'the textarea does not fill the field that holds it')
      .toBeGreaterThanOrEqual(g!.fieldContentWidth - 1);
  });

  test('it reaches the bottom of the panel', async ({ page }) => {
    await openEditor(page, 'General');
    const g = await commentGeometry(page);
    expect(g).not.toBeNull();
    expect(g!.gapBelow,
      `${g!.gapBelow}px of empty panel below the comment box`).toBeLessThanOrEqual(8);
    // Everything under the last row belongs to Comment, less its own label and the spacing
    // around it. More than ~40px unaccounted for means the box stopped at a fixed height and
    // left the rest of the panel empty.
    expect(g!.spaceAvailable - g!.areaHeight,
      `the comment box is ${g!.areaHeight}px tall in the ${g!.spaceAvailable}px left under the ` +
      'last row — it is not taking the space it was given')
      .toBeLessThanOrEqual(40);
  });

  test('it is wider than it is tall', async ({ page }) => {
    await openEditor(page, 'General');
    const g = await commentGeometry(page);
    expect(g).not.toBeNull();
    // A free-text note is read in lines. The regression rendered it taller than wide, which is
    // the shape of a column, not of a comment.
    expect(g!.areaWidth, `comment box is ${g!.areaWidth}x${g!.areaHeight} — taller than it is wide`)
      .toBeGreaterThan(g!.areaHeight);
  });

  test('the General tab does not scroll', async ({ page }) => {
    await openEditor(page, 'General');
    const over = await page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.de-body');
      return body ? {
        x: body.scrollWidth - body.clientWidth,
        y: body.scrollHeight - body.clientHeight,
      } : { x: -1, y: -1 };
    });
    expect(over.x, `content runs ${over.x}px past the panel's width`).toBeLessThanOrEqual(1);
    expect(over.y, `content runs ${over.y}px past the panel's height — the filler overflows ` +
      'instead of taking what is left').toBeLessThanOrEqual(1);
  });
});

/**
 * Dimensions: a labelled list, not a form with air in it.
 *
 * WinISD's own Dimensions page (docs/winisd_screenshots/edit_driver_pg4_dimensions.png) puts eight rows in
 * one tight column — the gap between one input and the next is a few pixels, so the eight read
 * as a single list. Padding each row out turns the same eight fields into a page the user has
 * to scan.
 */
test('Dimensions: the rows are not spaced out', async ({ page }) => {
  await openEditor(page, 'Dimensions');
  const gaps = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll<HTMLElement>('.de-dimlist .de-fld input')]
      .map(i => i.getBoundingClientRect())
      .sort((a, b) => a.top - b.top);
    const out: number[] = [];
    for (let i = 1; i < boxes.length; i++) out.push(Math.round(boxes[i]!.top - boxes[i - 1]!.bottom));
    return out;
  });
  expect(gaps.length, 'the Dimensions tab must render a column of fields').toBeGreaterThan(4);
  const worst = Math.max(...gaps);
  expect(worst, `rows are ${gaps.join('/')}px apart — the list is padded out with dead space`)
    .toBeLessThanOrEqual(8);
});

/**
 * The unit beside each field is WinISD's own spelling.
 *
 * Read off the two reference captures of the real application:
 * docs/winisd_screenshots/edit_driver_pg2_parameters.png and edit_driver_pg3_advanced_parameters.png.
 * Rms/Rme read "Ns/m" while Mcost reads "kg/s" — the same physical dimension spelled two ways,
 * which is WinISD's choice and therefore ours: a user comparing the two panels side by side
 * must see the same text in both.
 */
const WINISD_UNITS: Array<{ tab: string; label: string; unit: string }> = [
  { tab: 'Parameters', label: 'Cms', unit: 'mm/N' },
  { tab: 'Parameters', label: 'Rms', unit: 'Ns/m' },
  { tab: 'Parameters', label: 'Re', unit: 'ohm' },
  { tab: 'Parameters', label: 'BL', unit: 'Tm' },
  { tab: 'Parameters', label: 'Le', unit: 'mH' },
  { tab: 'Parameters', label: 'KLe', unit: 'H·√Hz' },
  { tab: 'Parameters', label: 'Pe', unit: 'W' },
  { tab: 'Parameters', label: 'no', unit: '%' },
  { tab: 'Parameters', label: 'Znom', unit: 'ohm' },
  { tab: 'Advanced parameters', label: 'R(t)', unit: 'K/W' },
  { tab: 'Advanced parameters', label: 'C(t)', unit: 'J/K' },
  { tab: 'Advanced parameters', label: 'Rme', unit: 'Ns/m' },
  { tab: 'Advanced parameters', label: 'gamma', unit: 'N/(A·kg)' },
  { tab: 'Advanced parameters', label: 'Mpow', unit: 'N/√W' },
  { tab: 'Advanced parameters', label: 'Mcost', unit: 'kg/s' },
  { tab: 'Advanced parameters', label: 'Gloss', unit: '%' },
];

for (const tab of ['Parameters', 'Advanced parameters']) {
  test(`${tab}: each field carries WinISD's own unit`, async ({ page }) => {
    await openEditor(page, tab);
    const want = WINISD_UNITS.filter(u => u.tab === tab);
    const got = await page.evaluate((labels) => {
      const out: Record<string, string | null> = {};
      for (const wanted of labels) {
        const fld = [...document.querySelectorAll<HTMLElement>('.de-body .de-fld')]
          .find(f => (f.querySelector('label')?.textContent || '').trim() === wanted);
        out[wanted] = fld ? ((fld.querySelector('.u')?.textContent || '').trim() || null) : null;
      }
      return out;
    }, want.map(u => u.label));
    expect(got).toEqual(Object.fromEntries(want.map(u => [u.label, u.unit])));
  });
}

test('every unit label occupies the same width, whatever it says', async ({ page }) => {
  await openEditor(page, 'Dimensions');
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.de-body .u, .de-body .unit-toggle')]
      .map(u => ({ text: (u.textContent || '').trim(), w: Math.round(u.getBoundingClientRect().width) })));
  expect(widths.length, 'the tab must actually render unit labels').toBeGreaterThan(3);
  const distinct = [...new Set(widths.map(w => w.w))];
  expect(distinct, `unit widths differ (${widths.map(w => `${w.text}=${w.w}px`).join(', ')}) — ` +
    'a unit sized by its text moves every column when it is cycled').toHaveLength(1);
});
