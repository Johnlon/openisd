import {driverEditorField, expect, forEachEditorTab, openAProject, openDriverEditor, seedDriverInEditor, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';
import {UNIT_GROUPS} from '@openisd/design/fields';

/**
 * The Driver Editor's per-field display units: every field whose quantity has more than one unit
 * carries a real toggle that rotates the label and converts the shown value (the stored value is
 * SI and never changes); a field with exactly one unit is a plain label; and each field's default
 * unit is WinISD's own spelling. Nothing here names a field it expects to find: each test
 * enumerates what the editor renders.
 */

/** Open the editor on one of its tabs. */
async function openEditorOn(page: Page, tab: string): Promise<void> {
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.driver-id-row').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

function unitTable() {
  const byLabel: Record<string, { group: string; token: string; next: string; ratio: number }> = {};
  for (const [group, units] of Object.entries(UNIT_GROUPS)) {
    if (units.length < 2) continue;
    units.forEach((def, i) => {
      const next = units[(i + 1) % units.length];
      byLabel[def.label] ??= { group, token: def.token, next: next.label, ratio: next.factor / def.factor };
    });
  }
  return byLabel;
}

/** Quantities the app shows in ONE unit, so their label is text and not a toggle. Each is a
 *  quantity with no second unit in `fields/units.ts` — a field landing here that DOES have a
 *  group is a missing toggle, and the test says so rather than passing quietly. */
const SINGLE_UNIT = new Set([
  'ohm', 'Tm', 'W', 'dB', '%', 'H·√Hz', 'K/W', 'J/K', 'N/(A·kg)', 'N/√W',
]);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
});

test('every unit with alternates is a working toggle, and every other unit is a plain label', async ({ page }) => {
  test.setTimeout(30000);
  await openDriverEditor(page);
  await seedDriverInEditor(page);
  const convertible = unitTable();

  const problems: string[] = [];
  await forEachEditorTab(page, async (tab, labels) => {
    for (const label of labels) {
      const fld = driverEditorField(page, label);
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
  await openDriverEditor(page);
  await page.getByRole('button', { name: 'Dimensions', exact: true }).click();
  const fld = driverEditorField(page, 'Basket Diameter (Basket)');
  const input = fld.locator('input').first();
  const unit = fld.locator('.u').first();

  await fillAndBlur(input, '165');            // 165 mm
  await unit.click();                 // mm → in
  await expect(unit).toHaveText('in');
  expect(parseFloat(await input.inputValue())).toBeCloseTo(165 * 39.3701 / 1000, 2);

  await unit.click();                 // in → cm
  await unit.click();                 // cm → mm
  await expect(unit).toHaveText('mm');
  expect(parseFloat(await input.inputValue()), 'the value survives a full rotation').toBeCloseTo(165, 2);
});

/**
 * The unit beside each field DEFAULTS to WinISD's own spelling.
 *
 * Read off the two reference captures of the real application:
 * docs/images/winisd/edit-driver-page2-parameters.png and edit-driver-page3-advanced-parameters.png.
 * Rms/Rme read "Ns/m" while Mcost reads "kg/s" — the same physical dimension spelled two ways.
 * Ledger QO51: all three now carry a click-to-rotate `resistance` unit group (Ns/m <-> kg/s,
 * factor 1) for consistency with every other toggleable field, so this table pins the DEFAULT
 * a fresh load shows, not a fixed label — the toggle test below covers the rotation.
 */
const WINISD_UNITS: Array<{ tab: string; label: string; unit: string }> = [
  { tab: 'Parameters', label: 'Cms', unit: 'mm/N' },
  { tab: 'Parameters', label: 'Rms', unit: 'Ns/m' },
  { tab: 'Parameters', label: 'Re', unit: 'ohm' },
  { tab: 'Parameters', label: 'BL', unit: 'Tm' },
  { tab: 'Parameters', label: 'Le', unit: 'mH' },
  { tab: 'Parameters', label: 'KLe', unit: 'H·√Hz' },
  { tab: 'Parameters', label: 'Pe', unit: 'W' },
  { tab: 'Parameters', label: 'η₀', unit: '%' },
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
    await openEditorOn(page, tab);
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

/**
 * Ledger QO51: Rms/Rme/Mcost's Ns/m <-> kg/s toggle is a relabel, never a rescale — the group's
 * conversion factor is 1 for both spellings, so the number on screen must survive a full
 * rotation byte-for-byte while the label alone rotates.
 */
const RESISTANCE_FIELDS: Array<{ tab: string; label: string; defaultUnit: string; otherUnit: string }> = [
  { tab: 'Parameters', label: 'Rms', defaultUnit: 'Ns/m', otherUnit: 'kg/s' },
  { tab: 'Advanced parameters', label: 'Rme', defaultUnit: 'Ns/m', otherUnit: 'kg/s' },
  { tab: 'Advanced parameters', label: 'Mcost', defaultUnit: 'kg/s', otherUnit: 'Ns/m' },
];

for (const { tab, label, defaultUnit, otherUnit } of RESISTANCE_FIELDS) {
  test(`${label}: the resistance unit toggle rotates the label and never the value`, async ({ page }) => {
    await openEditorOn(page, tab);
    const fld = page.locator('.de-body .de-fld', { has: page.locator('label', { hasText: label }) }).first();
    const unit = fld.locator('.u').first();
    const input = fld.locator('input').first();

    await expect(unit).toHaveText(defaultUnit);
    await fillAndBlur(input, '12.5');
    const before = await input.inputValue();

    await unit.click();
    await expect(unit).toHaveText(otherUnit);
    await expect(input, `${label} changed value after the label rotated ${defaultUnit} -> ${otherUnit}`).toHaveValue(before);

    await unit.click();
    await expect(unit).toHaveText(defaultUnit);
    await expect(input, `${label} did not round-trip back to ${before} after a full rotation`).toHaveValue(before);
  });
}

test('every unit label occupies the same width, whatever it says', async ({ page }) => {
  await openEditorOn(page, 'Dimensions');
  const widths = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.de-body .u, .de-body .unit-toggle')]
      .map(u => ({ text: (u.textContent || '').trim(), w: Math.round(u.getBoundingClientRect().width) })));
  expect(widths.length, 'the tab must actually render unit labels').toBeGreaterThan(3);
  const distinct = [...new Set(widths.map(w => w.w))];
  expect(distinct, `unit widths differ (${widths.map(w => `${w.text}=${w.w}px`).join(', ')}) — ` +
    'a unit sized by its text moves every column when it is cycled').toHaveLength(1);
});
