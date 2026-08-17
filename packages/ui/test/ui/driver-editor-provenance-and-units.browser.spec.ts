import { test, expect } from '../fixtures.js';
import type { Page } from '@playwright/test';

/**
 * Driver editor — provenance highlighting and per-field display units, over EVERY field on
 * EVERY tab. Nothing here names a field it expects to find: each test enumerates what the
 * editor actually renders and asserts a property of all of it, so a new field is covered the
 * day it is added and a deleted one cannot leave a stale assertion behind.
 *
 *  1. A field the provenance map can explain lights up when inspected, and its inputs light
 *     up in the path colour.
 *  2. A field the solver CALCULATED can be explained at all — a calculated value with no
 *     recorded formula is a hole in the inspector.
 *  3. The highlight box encloses the whole control: label, input AND unit.
 *  4. A field whose quantity has more than one unit carries a real toggle that rotates the
 *     label and converts the value; a field whose quantity has exactly one unit does not.
 */

/** Every value the seed enters, in the unit the field displays. One solvable driver, so the
 *  solver marks a realistic set of fields CALCULATED for tests 1 and 2. */
const SEED: [string, string][] = [
  ['Fs', '35'], ['Qts', '0.38'], ['Qes', '0.42'], ['Re', '6.4'],
  ['Vas', '32'], ['Sd', '220'], ['Xmax', '6.5'], ['Pe', '150'],
  ['Hc', '18'], ['Hg', '8'],
];

async function openEditor(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await page.locator('.de-body').waitFor({ state: 'visible' });
}

/** Enter a solvable driver with "Auto calculate unknowns" on, so the derived fields carry the
 *  CALCULATED mark the provenance tests are about. */
async function seedDriver(page: Page) {
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  for (const [label, value] of SEED) {
    const input = fieldByLabel(page, label).locator('input').first();
    await input.fill(value);
    await input.blur();
  }
}

function fieldByLabel(page: Page, label: string) {
  return page.locator('.de-body .de-fld', { has: page.locator(`label:text-is("${label}")`) }).first();
}

/** Walk every tab, and hand the visitor that tab's own field labels WHILE it is on screen.
 *  Collecting the labels up front and iterating afterwards would run every assertion against
 *  whichever tab happened to be open last. */
async function forEachTab(page: Page, visit: (tab: string, labels: string[]) => Promise<void>) {
  const tabs = (await page.locator('.de-tab').allInnerTexts()).map(s => s.trim());
  for (const tab of tabs) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const labels = (await page.locator('.de-body .de-fld label').allInnerTexts()).map(s => s.trim());
    await visit(tab, labels);
  }
}

/** The editor's own label→key table and the set of keys the provenance map can explain, read
 *  from the modules so this test cannot drift from them. */
const provenanceTables = (page: Page) =>
  page.evaluate(async () => {
    const modPath = '/src/logic/provenance.ts';
    const m = await import(/* @vite-ignore */ modPath);
    return { map: m.LABEL_TO_FIELD_KEY as Record<string, string>, explained: Object.keys(m.PROVENANCE_MAP) };
  });

/** unit LABEL → its group and token, plus the label one click rotates to. Derived from the
 *  unit registry itself, so adding a unit to a group immediately widens what test 4 demands. */
const unitTable = (page: Page) =>
  page.evaluate(async () => {
    const modPath = '/src/logic/fields/units.ts';
    const u = await import(/* @vite-ignore */ modPath);
    const groups = u.UNIT_GROUPS as Record<string, { token: string; label: string; factor: number }[]>;
    const byLabel: Record<string, { group: string; token: string; next: string; ratio: number }> = {};
    for (const [group, units] of Object.entries(groups)) {
      if (units.length < 2) continue;
      units.forEach((def, i) => {
        const next = units[(i + 1) % units.length];
        byLabel[def.label] ??= { group, token: def.token, next: next.label, ratio: next.factor / def.factor };
      });
    }
    return byLabel;
  });

// ── 0. The label→key map cannot silently drift from what the editor actually renders ────
//
// Tests 1-2 below only exercise a field that HAS a provenance formula, so a label edit that
// orphans LABEL_TO_FIELD_KEY for any field WITHOUT one passes every other test in this file —
// exactly how "Magnet Depth" lost its "(MagDepth)" suffix unnoticed. `data-field-key` on each
// `.de-fld` (DriverEditorModal.vue) is the ground truth — the key the field is ACTUALLY bound
// to (cellClass/cellVal/setNum's argument, or the metadata field for General) — independent of
// the label map. This test needs no field list of its own: it reads every `.de-fld` the editor
// renders, on every tab, and requires the map to agree with the ground truth for all of them.

/** The General tab is identity/attribution metadata (Manufacturer, Brand, Model, Comment, …)
 *  — never a Thiele/Small quantity, so it can never gain a provenance formula and was never
 *  meant to be in LABEL_TO_FIELD_KEY. Same for Connection (VCCon): a wiring-mode select, not
 *  a derivable value. Excluded by what they STRUCTURALLY are, not by name-matching a guess at
 *  which fields might drift — every field this system can ever explain stays covered. */
test('LABEL_TO_FIELD_KEY resolves every simulation field to the key it is actually bound to', async ({ page }) => {
  await openEditor(page);
  const { map } = await provenanceTables(page);

  const drift: string[] = [];
  const untagged: string[] = [];
  await forEachTab(page, async (tab) => {
    if (tab === 'General') return;
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('.de-body .de-fld')].map(f => ({
        label: f.querySelector('label')?.textContent?.trim() ?? '',
        groundTruth: f.getAttribute('data-field-key'),
      })));
    for (const { label, groundTruth } of rows) {
      if (!label || groundTruth === 'VCCon') continue;
      if (groundTruth == null) { untagged.push(`${tab}/${label}`); continue; }
      const resolved = map[label] ?? label;
      if (resolved !== groundTruth) drift.push(`${tab}/${label}: map says "${resolved}", actually bound to "${groundTruth}"`);
    }
  });
  expect(untagged, 'fields with no ground-truth data-field-key to check against').toEqual([]);
  expect(drift, 'LABEL_TO_FIELD_KEY entries that disagree with what the field is bound to').toEqual([]);
});

// ── 1. Provenance highlight reaches every explainable field ─────────────────────────────

test('every field the provenance map explains takes the inspected highlight', async ({ page }) => {
  await openEditor(page);
  const { map, explained } = await provenanceTables(page);
  await page.locator('.de-provenance-chk', { hasText: 'Inspect Provenance' }).locator('input').check();

  const dark: string[] = [];
  await forEachTab(page, async (tab, labels) => {
    for (const label of labels) {
      const key = map[label] ?? label;
      if (!explained.includes(key)) continue;
      const fld = fieldByLabel(page, label);
      await fld.locator('label').click();
      if (!((await fld.getAttribute('style')) ?? '').includes('outline')) dark.push(`${tab}/${label} (${key})`);
    }
  });
  expect(dark, 'fields with a provenance formula that never light up').toEqual([]);
});

test('inspecting a field also colours the inputs its formula names', async ({ page }) => {
  await openEditor(page);
  await seedDriver(page);
  await page.locator('.de-provenance-chk', { hasText: 'Inspect Provenance' }).locator('input').check();

  // Qts = (Qes × Qms) / (Qes + Qms) — one path, two inputs, all three on this tab.
  await fieldByLabel(page, 'Qts').locator('label').click();
  await expect(fieldByLabel(page, 'Qts')).toHaveAttribute('style', /outline/);
  for (const input of ['Qes', 'Qms']) {
    await expect(fieldByLabel(page, input), `${input} feeds Qts`).toHaveAttribute('style', /border-color/);
  }
});

// ── 2. A calculated value can always be explained ───────────────────────────────────────

/** Fields that carry the CALCULATED mark with no formula behind them.
 *  `c` and `roo` are the engine's air constants — nothing about the driver derives them.
 *  `Z` (Znom) is unresolved: the editor calls it "label only, not used in simulation" and still
 *  marks it calculated. Ledger QO52 decides which of the two is wrong; it is named here so the
 *  gap stays visible rather than being tolerated by a blanket skip. */
const NO_FORMULA = new Set(['c', 'roo', 'Z']);

test('every field the solver calculated has a provenance formula', async ({ page }) => {
  await openEditor(page);
  await seedDriver(page);
  const { map, explained } = await provenanceTables(page);

  const unexplained: string[] = [];
  await forEachTab(page, async (tab, labels) => {
    for (const label of labels) {
      const fld = fieldByLabel(page, label);
      const calculated = await fld.evaluate(f =>
        f.classList.contains('st-c') || !!f.querySelector('input.st-c'));
      if (!calculated) continue;
      const key = map[label] ?? label;
      if (!explained.includes(key) && !NO_FORMULA.has(key)) unexplained.push(`${tab}/${label} (${key})`);
    }
  });
  expect(unexplained, 'calculated values the inspector cannot explain').toEqual([]);
});

// ── 3. The highlight box encloses the whole control ─────────────────────────────────────

test('every field box encloses its own label, input and unit', async ({ page }) => {
  await openEditor(page);
  const escapes: string[] = [];
  await forEachTab(page, async (tab) => {
    const rows = await page.evaluate(() => {
      const out: { label: string; part: string; over: number }[] = [];
      for (const f of document.querySelectorAll('.de-body .de-fld')) {
        const box = f.getBoundingClientRect();
        const label = f.querySelector('label')?.textContent?.trim() ?? '?';
        for (const [part, el] of [['label', f.querySelector('label')],
                                  ['input', f.querySelector('input, select, textarea')],
                                  ['unit', f.querySelector('.u')]] as const) {
          if (!el) continue;
          const r = el.getBoundingClientRect();
          // 1 px of sub-pixel rounding is not an escape; more than that is outside the box.
          const over = Math.max(box.left - r.left, r.right - box.right, box.top - r.top, r.bottom - box.bottom);
          if (over > 1) out.push({ label, part, over: Math.round(over) });
        }
      }
      return out;
    });
    escapes.push(...rows.map(r => `${tab}/${r.label} ${r.part} outside by ${r.over}px`));
  });
  expect(escapes, 'parts of a field painted outside the field box').toEqual([]);
});

// ── 4. Unit toggling, over every unit the editor shows ──────────────────────────────────

/** Quantities the app shows in ONE unit, so their label is text and not a toggle. Each is a
 *  quantity with no second unit in `fields/units.ts` — a field landing here that DOES have a
 *  group is a missing toggle, and the test says so rather than passing quietly. */
const SINGLE_UNIT = new Set([
  'ohm', 'Tm', 'W', 'dB', '%', 'Ns/m', 'H·√Hz', 'K/W', 'J/K', 'N/(A·kg)', 'N/√W', 'kg/s',
]);

test('every unit with alternates is a working toggle, and every other unit is a plain label', async ({ page }) => {
  await openEditor(page);
  await seedDriver(page);
  const convertible = await unitTable(page);

  const problems: string[] = [];
  await forEachTab(page, async (tab, labels) => {
    for (const label of labels) {
      const fld = fieldByLabel(page, label);
      const unitEl = fld.locator('.u').first();
      if (!(await unitEl.count())) continue;                       // no unit — nothing to rotate
      const shownUnit = (await unitEl.innerText()).trim();
      const spec = convertible[shownUnit];

      if (!spec) {
        if (!SINGLE_UNIT.has(shownUnit)) problems.push(`${tab}/${label}: unit "${shownUnit}" is in no unit group and is not declared single-unit`);
        else if ((await unitEl.getAttribute('role')) === 'button') problems.push(`${tab}/${label}: "${shownUnit}" is declared single-unit but is clickable`);
        continue;
      }

      if ((await unitEl.getAttribute('role')) !== 'button') {
        problems.push(`${tab}/${label}: "${shownUnit}" has alternates but is not a toggle`);
        continue;
      }

      const input = fld.locator('input').first();
      if (!(await input.inputValue())) { await input.fill('1'); await input.blur(); }
      const before = await input.inputValue();
      await unitEl.click();
      const after = (await unitEl.innerText()).trim();
      if (after !== spec.next) { problems.push(`${tab}/${label}: ${shownUnit} → ${after}, expected ${spec.next}`); continue; }

      // Both readings are rounded to their own unit's decimals, and a FINER target unit
      // magnifies the source's rounding by the conversion ratio — Cms 0.4661 mm/N is really
      // anything in ±0.00005, i.e. ±0.05 µm/N. Allow both roundings, nothing more.
      const dpBefore = (before.split('.')[1] ?? '').length;
      const shownText = await input.inputValue();
      const dpAfter = (shownText.split('.')[1] ?? '').length;
      const expected = parseFloat(before) * spec.ratio;
      const tolerance = 0.5 * 10 ** -dpAfter + 0.5 * 10 ** -dpBefore * Math.abs(spec.ratio);
      const shown = parseFloat(shownText);
      if (Math.abs(shown - expected) > tolerance) {
        problems.push(`${tab}/${label}: ${before} ${shownUnit} shown as ${shown} ${after}, expected ${expected}`);
      }
    }
  });
  expect(problems, 'unit-toggle faults').toEqual([]);
});

test('rotating a unit changes the display only — the stored value round-trips', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Dimensions', exact: true }).click();
  const fld = fieldByLabel(page, 'Basket Diameter (Basket)');
  const input = fld.locator('input').first();
  const unit = fld.locator('.u').first();

  await input.fill('165');            // 165 mm
  await input.blur();
  await unit.click();                 // mm → in
  await expect(unit).toHaveText('in');
  expect(parseFloat(await input.inputValue())).toBeCloseTo(165 * 39.3701 / 1000, 2);

  await unit.click();                 // in → cm
  await unit.click();                 // cm → mm
  await expect(unit).toHaveText('mm');
  expect(parseFloat(await input.inputValue()), 'the value survives a full rotation').toBeCloseTo(165, 2);
});

// ── 5. The equation-inspector popup never covers the dialog it explains ─────────────────

/** bugs/BUG_20260817_equation_inspector_popup_overlaps_the_editor.md — the popup used to sit
 *  at a fixed viewport corner regardless of where the editor rendered, so on a viewport too
 *  narrow to clear it on either side the popup landed on top of the very panel it explains. */
test('the equation-inspector popup never overlaps the editor, even on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 }); // 770px modal, ~215px free per side
  await openEditor(page);
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();
  await fieldByLabel(page, 'Fs').locator('label').click();

  const card = page.locator('.eq-inspector-card');
  await expect(card).toBeVisible();
  const modalBox = await page.locator('.de-modal').boundingBox();
  const cardBox = await card.boundingBox();
  const overlapsX = cardBox!.x < modalBox!.x + modalBox!.width && cardBox!.x + cardBox!.width > modalBox!.x;
  const overlapsY = cardBox!.y < modalBox!.y + modalBox!.height && cardBox!.y + cardBox!.height > modalBox!.y;
  expect(overlapsX && overlapsY, `popup ${JSON.stringify(cardBox)} overlaps modal ${JSON.stringify(modalBox)}`)
    .toBe(false);
});

test('the equation-inspector popup is visible on screen at a normal window height', async ({ page }) => {
  // bugs/BUG_20260817_equation_inspector_popup_overlaps_the_editor.md — the "below the modal"
  // fallback picked a vertical band without checking the popup's own height fit in it, so at an
  // ordinary (not maximized) window height the popup rendered past the bottom of the viewport —
  // present in the DOM, entirely invisible.
  await openEditor(page);
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();
  await fieldByLabel(page, 'Fs').locator('label').click();
  const vh = await page.evaluate(() => window.innerHeight);
  const box = await page.locator('.eq-inspector-card').boundingBox();
  expect(box!.y, 'popup top is above the viewport').toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `popup bottom (${box!.y + box!.height}) exceeds the window height (${vh})`)
    .toBeLessThanOrEqual(vh + 1);
});

test('the equation-inspector popup no longer shows a "Live:" substitution line', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Inspect Provenance' }).check();
  await fieldByLabel(page, 'Fs').locator('label').click();
  await expect(page.locator('.eq-inspector-card')).toBeVisible();
  await expect(page.locator('.eq-inspector-card').getByText('Live:')).toHaveCount(0);
});
