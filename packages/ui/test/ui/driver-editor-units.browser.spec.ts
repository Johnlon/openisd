import {driverEditorField, expect, forEachEditorTab, openAMobileProject, openAProject, openDriverEditor, seedDriverInEditor, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {UNIT_GROUPS} from '@openisd/design/fields';
import {measureFieldContent, measureFieldBorders} from '../fixtures/fieldVisualContract.js';
import {measureFieldControlContainment} from '../fixtures/fieldControlContainment.js';

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
  'Ω', 'Tm', 'W', 'dB', '%', 'H·√Hz', 'K/W', 'J/K', 'N/(A·kg)', 'N/√W',
]);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
});

test('every unit with alternates is a working toggle, and every other unit is a plain label', async ({ page }) => {
  await openDriverEditor(page);
  await seedDriverInEditor(page);
  const convertible = unitTable();

  const problems: string[] = [];
  await forEachEditorTab(page, async (tab, labels) => {
    const untagged = await page.locator('.de-body .ui-field:visible').evaluateAll(rows => rows.map(row => {
      const unit = row.querySelector('.ui-field-unit');
      const text = unit?.textContent?.trim() ?? '';
      return text !== '' && !unit?.classList.contains('unit-label')
        ? `${row.querySelector('label')?.textContent?.trim() ?? '(unlabelled)'}/${text}` : null;
    }).filter((x): x is string => x !== null));
    problems.push(...untagged.map(field => `${tab}/${field}: unit slot is not owned by UnitToggle`));
    for (const label of labels) {
      const fld = driverEditorField(page, label);
      const unitEl = fld.locator('.unit-label').first();
      if (!(await unitEl.count())) continue;                       // no unit — nothing to rotate
      const shownUnit = (await unitEl.innerText()).trim();
      if (shownUnit === '') continue;                              // a unitless field keeps an empty unit slot
      const spec = convertible[shownUnit];
      const role = await unitEl.getAttribute('role');
      const decoration = await unitEl.evaluate(el => {
        const style = getComputedStyle(el);
        return `${style.textDecorationLine}/${style.textDecorationStyle}`;
      });

      if (!spec) {
        if (!SINGLE_UNIT.has(shownUnit)) problems.push(`${tab}/${label}: unit "${shownUnit}" is in no unit group and is not declared single-unit`);
        else if (role === 'button') problems.push(`${tab}/${label}: "${shownUnit}" is declared single-unit but is clickable`);
        if (role === 'button' || decoration !== 'none/solid') problems.push(`${tab}/${label}: fixed unit "${shownUnit}" has toggle affordance styling`);
        continue;
      }

      if (role !== 'button') {
        problems.push(`${tab}/${label}: "${shownUnit}" has alternates but is not a toggle`);
        continue;
      }
      if (decoration !== 'underline/solid') problems.push(`${tab}/${label}: toggle unit "${shownUnit}" has ${decoration}, expected underline/solid`);

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

test('mobile Driver Editor: every numeric field uses the shared bold unit affordance', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByRole('button', {name: 'Edit', exact: true}).click();
  await expect(page.locator('.de-body')).toBeVisible();

  const faults: string[] = [];
  await forEachEditorTab(page, async (tab, labels) => {
    const untagged = await page.locator('.de-body .ui-field:visible').evaluateAll(rows => rows.map(row => {
      const unit = row.querySelector('.ui-field-unit');
      const text = unit?.textContent?.trim() ?? '';
      return text !== '' && !unit?.classList.contains('unit-label')
        ? `${row.querySelector('label')?.textContent?.trim() ?? '(unlabelled)'}/${text}` : null;
    }).filter((x): x is string => x !== null));
    faults.push(...untagged.map(field => `${tab}/${field}: unit slot is not owned by UnitToggle`));
    for (const label of labels) {
      const unit = driverEditorField(page, label).locator('.unit-label').first();
      if (!(await unit.count())) continue;
      if (!(await unit.innerText()).trim()) continue; // unitless values keep an empty, transparent slot
      const look = await unit.evaluate(el => {
        const css = getComputedStyle(el);
        return {
          weight: css.fontWeight,
          toggle: el.classList.contains('unit-toggle'),
          role: el.getAttribute('role'),
          background: css.backgroundColor,
          underline: css.textDecorationLine,
          underlineStyle: css.textDecorationStyle,
          underlineColor: css.textDecorationColor,
          underlineThickness: css.textDecorationThickness,
          underlineOffset: css.textUnderlineOffset,
          borderBottom: css.borderBottomStyle,
        };
      });
      if (look.weight !== '600') faults.push(`${tab}/${label}: unit weight is ${look.weight}, expected bold 600`);
      if (look.toggle) {
        if (look.role !== 'button' || look.background !== 'rgb(239, 239, 239)'
          || look.underline !== 'underline' || look.underlineStyle !== 'solid'
          || look.underlineColor !== 'rgb(24, 104, 209)' || look.underlineThickness !== '1px'
          || look.underlineOffset !== '5px' || look.borderBottom !== 'solid') {
          faults.push(`${tab}/${label}: toggle unit affordance is ${JSON.stringify(look)}`);
        }
      } else if (look.role !== null || look.background !== 'rgba(0, 0, 0, 0)' || look.underline !== 'none') {
        faults.push(`${tab}/${label}: fixed unit affordance is ${JSON.stringify(look)}`);
      }
    }
  });
  expect(faults, 'mobile Driver Editor unit-affordance faults').toEqual([]);
});

test('rotating a unit changes the display only — the stored value round-trips', async ({ page }) => {
  await openDriverEditor(page);
  await page.getByRole('button', { name: 'Dimensions', exact: true }).click();
  const fld = driverEditorField(page, 'Basket Diameter (Basket)');
  const input = fld.locator('input').first();
  const unit = fld.locator('.unit-label').first();

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
  { tab: 'Parameters', label: 'Re', unit: 'Ω' },
  { tab: 'Parameters', label: 'BL', unit: 'Tm' },
  { tab: 'Parameters', label: 'Le', unit: 'mH' },
  { tab: 'Parameters', label: 'KLe', unit: 'H·√Hz' },
  { tab: 'Parameters', label: 'Pe', unit: 'W' },
  { tab: 'Parameters', label: 'η₀', unit: '%' },
  { tab: 'Parameters', label: 'Znom', unit: 'Ω' },
  { tab: 'Advanced', label: 'R(t)', unit: 'K/W' },
  { tab: 'Advanced', label: 'C(t)', unit: 'J/K' },
  { tab: 'Advanced', label: 'Rme', unit: 'Ns/m' },
  { tab: 'Advanced', label: 'gamma', unit: 'N/(A·kg)' },
  { tab: 'Advanced', label: 'Mpow', unit: 'N/√W' },
  { tab: 'Advanced', label: 'Mcost', unit: 'kg/s' },
  { tab: 'Advanced', label: 'Gloss', unit: '%' },
];

for (const tab of ['Parameters', 'Advanced']) {
  test(`${tab}: each field carries WinISD's own unit`, async ({ page }) => {
    await openEditorOn(page, tab);
    const want = WINISD_UNITS.filter(u => u.tab === tab);
    const got = await page.evaluate((labels) => {
      const out: Record<string, string | null> = {};
      for (const wanted of labels) {
        const fld = [...document.querySelectorAll<HTMLElement>('.de-body .de-fld')]
          .find(f => (f.querySelector('label')?.textContent || '').trim() === wanted);
        out[wanted] = fld ? ((fld.querySelector('.unit-label')?.textContent || '').trim() || null) : null;
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
  { tab: 'Advanced', label: 'Rme', defaultUnit: 'Ns/m', otherUnit: 'kg/s' },
  { tab: 'Advanced', label: 'Mcost', defaultUnit: 'kg/s', otherUnit: 'Ns/m' },
];

for (const { tab, label, defaultUnit, otherUnit } of RESISTANCE_FIELDS) {
  test(`${label}: the resistance unit toggle rotates the label and never the value`, async ({ page }) => {
    await openEditorOn(page, tab);
    const fld = page.locator('.de-body .de-fld', { has: page.locator('label', { hasText: label }) }).first();
    const unit = fld.locator('.unit-label').first();
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

for (const tab of ['Parameters', 'Advanced', 'Dimensions']) {
test(tab + ': seeded unit rotations preserve readable values and fitted controls', async ({page}) => {
  await openDriverEditor(page);
  await seedDriverInEditor(page);
  await page.getByRole('button', {name: tab, exact: true}).click();
  const modal = page.locator('.de-modal');
  const units = modal.locator('.unit-label[role="button"]');
  const positions = () => modal.locator('.de-body input').evaluateAll(inputs => inputs.map(input => input.getBoundingClientRect().left));
  expect(await units.count(), 'Dimensions has multiple convertible units').toBeGreaterThan(3);
  const before = await positions();
  expect((await modal.evaluate(measureFieldContent)).issues).toEqual([]);
  for (const unit of await units.all()) {
    const initial = (await unit.innerText()).trim();
    const rotations = Object.values(UNIT_GROUPS).find(group => group.some(def => def.label === initial))?.length ?? 0;
    expect(rotations, `${initial} belongs to a convertible unit group`).toBeGreaterThan(1);
    for (let step = 0; step < rotations; step++) {
      await unit.click();
      expect(await positions(), 'unit rotation does not move the number column').toEqual(before);
      const report = await modal.evaluate(measureFieldContent);
      expect(report.rows).toBeGreaterThan(3);
      expect(report.controls).toBe(report.rows);
      expect(report.issues, `${initial} rotation ${step + 1}`).toEqual([]);
    }
    await expect(unit, 'the complete unit cycle returns to its starting label').toHaveText(initial);
  }
});
}


test('joined editor units end with their input and spinners stay outside every input', async ({page}) => {
  await openDriverEditor(page);
  await seedDriverInEditor(page);
  const issues: string[] = [];
  await forEachEditorTab(page, async tab => {
    const failures = await page.locator('.de-body .ui-field:visible').evaluateAll(rows => rows.flatMap(row => {
      const input = row.querySelector('input');
      if (input === null) return [];
      const box = input.getBoundingClientRect();
      const unit = row.querySelector('.unit-label');
      const name = row.getAttribute('data-field-key') ?? row.querySelector('label')?.textContent;
      const problems: string[] = [];
      if (unit?.textContent?.trim() && Math.abs(unit.getBoundingClientRect().right - box.right) > 0.5) {
        problems.push(`${name}: unit ends at ${unit.getBoundingClientRect().right}, input at ${box.right}`);
      }
      for (const spinner of row.querySelectorAll('.num-stepper-btn')) {
        if (spinner.getBoundingClientRect().left < box.right - 0.5) problems.push(`${name}: spinner overlaps input`);
      }
      return problems;
    }));
    issues.push(...failures.map(problem => `${tab}/${problem}`));
  });
  expect(issues).toEqual([]);
});


for (const width of [780, 1024, 1280]) {
  test(`every editor tab keeps complete controls visible at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await openDriverEditor(page);
    await seedDriverInEditor(page);
    await forEachEditorTab(page, async tab => {
      const modal = page.locator('.de-modal');
      expect((await modal.evaluate(measureFieldControlContainment)).issues, tab).toEqual([]);
      expect((await modal.evaluate(measureFieldContent)).issues, tab).toEqual([]);
      expect((await modal.evaluate(measureFieldBorders)).issues, tab).toEqual([]);
    });
  });
}

test('desktop fixed-unit glyphs leave space inside the right input border', async ({page}) => {
  await openDriverEditor(page);
  await seedDriverInEditor(page);
  const issues: string[] = [];
  await forEachEditorTab(page, async tab => {
    const failures = await page.locator('.de-body .unit-label:not(.unit-toggle):visible').evaluateAll(units => units.filter(unit => unit.textContent?.trim()).flatMap(unit => {
      const input = unit.closest('.ui-field')?.querySelector('input');
      if (!input) return [];
      const range = document.createRange(); range.selectNodeContents(unit);
      const clearance = input.getBoundingClientRect().right - parseFloat(getComputedStyle(input).borderRightWidth) - range.getBoundingClientRect().right;
      return clearance < 2.5 ? [`${unit.textContent}: only ${clearance}px right clearance`] : [];
    }));
    issues.push(...failures.map(failure => `${tab}/${failure}`));
  });
  expect(issues).toEqual([]);
});
