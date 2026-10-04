import {driverEditorField, expect, forEachEditorTab, openAProject, openDriverEditor, seedDriverInEditor, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {PROVENANCE_MAP} from '../../src/logic/provenance.js';
import {ALL_FIELDS} from '@openisd/design/fields';

/**
 * The Driver Editor's provenance: every field takes its E/C/N class, a field the provenance map
 * explains lights up when inspected, a calculated value can always be explained, and the
 * highlight box encloses the whole control. Nothing here names a field it expects to find: each
 * test enumerates what the editor actually renders, so a new field is covered the day it is added.
 *
 * E/C/N Provenance Class Audit across all Driver Editor Fields
 *
 * Verifies that every input field in the Driver Editor Modal correctly receives its E/C/N
 * provenance CSS class (value-e for Entered, value-c for Calculated, value-n for Not Entered).
 */

/** Every input on the open tab. */
const editorInputs = (page: Page) =>
  page.locator('.de-body input[type="text"], .de-body input[type="number"]');

/**
 * The inputs on the open tab that carry NO provenance class, one entry per offender so a
 * failure names all of them rather than stopping at the first.
 *
 * Only VISIBLE inputs are judged: a tab that is not on screen still has its inputs in the DOM,
 * and those are not what this test is about. `:visible` is Playwright's own predicate, the same
 * one `Locator.isVisible()` uses, so the selector decides membership and the test body has
 * nothing left to branch on.
 */
async function unclassified(page: Page): Promise<string[]> {
  return page.locator('.de-body input[type="text"]:visible, .de-body input[type="number"]:visible')
    .evaluateAll(els => els
      .filter(el => {
        const target = el.closest('.value-e, .value-c, .value-n') ?? el;
        return !(target.classList.contains('value-e')
          || target.classList.contains('value-c')
          || target.classList.contains('value-n'));
      })
      .map(el => el.outerHTML.slice(0, 120)));
}

interface Provenance { explained: string[] }

function provenanceTables(): Provenance {
  return { explained: Object.keys(PROVENANCE_MAP) };
}

/** The registry field a rendered `data-field-key` names, bridging the same `driver_` prefix
 *  `keyForLabel` does. */
function fieldForKey(key: string) {
  return ALL_FIELDS.find(f => f.value === key || f.value === `driver_${key}`);
}

/** The driver-spec key whose field renders the given editor label, or `undefined` when no
 *  field does — derived from the registry, never a hand-maintained map.
 *
 *  The registry names a driver field `driver_Fs_hz` while the driver record and
 *  `PROVENANCE_MAP` all call it `Fs_hz`; the prefix is the registry's own decoration, and
 *  dropping it is the follow-up recorded in
 *  bugs/archive/BUG_20260928_three_tables_disagree_on_field_validity.md. Until then this strips it. */
function keyForLabel(label: string): string | undefined {
  const field = ALL_FIELDS.find(f => f.label === label);
  if (!field) return undefined;
  const bare = field.value.replace(/^driver_/, '');
  return bare in PROVENANCE_MAP ? bare : field.value in PROVENANCE_MAP ? field.value : bare;
}


test.describe('Driver Editor E/C/N Provenance Class Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);

    // Open the Driver Editor the way a user does. Services are constructed by the composition
    // root and injected, so there is no module-level instance to import and call.
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    await page.locator('.edit-btn', { hasText: 'Edit' }).click();

    await page.locator('.de-body').waitFor({ state: 'visible' });
  });

  test('All input fields on Parameters tab render valid E/C/N provenance classes (value-e, value-c, or value-n)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    expect(await editorInputs(page).count(), 'Parameters tab must have fields').toBeGreaterThan(15);

    expect(await unclassified(page), 'Parameters inputs missing value-e / value-c / value-n').toEqual([]);
  });

  test('All input fields on Advanced tab render valid E/C/N provenance classes', async ({ page }) => {
    await page.getByRole('button', { name: 'Advanced parameters', exact: true }).click();

    expect(await editorInputs(page).count(), 'Advanced parameters tab must have fields').toBeGreaterThan(5);

    expect(await unclassified(page), 'Advanced parameters inputs missing value-e / value-c / value-n').toEqual([]);
  });

  test('All input fields on Dimensions tab render valid E/C/N provenance classes', async ({ page }) => {
    await page.getByRole('button', { name: 'Dimensions', exact: true }).click();

    expect(await editorInputs(page).count(), 'Dimensions tab must have fields').toBeGreaterThan(5);

    expect(await unclassified(page), 'Dimensions inputs missing value-e / value-c / value-n').toEqual([]);
  });

  test('Typing into a field transitions its class to value-e (Entered)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const input = page.locator('.de-fld:has-text("Pe") input').first();
    await input.fill('250');

    const hasEntered = await input.evaluate(el => el.closest('.value-e') !== null);
    expect(hasEntered).toBe(true);
  });

  test('Deriving a calculated field applies value-c (Calculated)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const qts = page.locator('.de-fld:has-text("Qts") input').first();
    const qes = page.locator('.de-fld:has-text("Qes") input').first();
    const qms = page.locator('.de-fld:has-text("Qms") input').first();

    await qts.fill('');
    await qes.fill('0.35');
    await qms.fill('3.50');

    const hasCalc = await qts.evaluate(el => el.closest('.value-c') !== null);
    expect(hasCalc).toBe(true);
  });

  test('Clearing an uncalculated field transitions its class to value-n (Not Entered)', async ({ page }) => {
    await page.getByRole('button', { name: 'Parameters', exact: true }).click();

    const input = page.locator('.de-fld:has-text("Pe") input').first();
    await input.fill('');

    const hasNotEntered = await input.evaluate(el => el.closest('.value-n') !== null);
    expect(hasNotEntered).toBe(true);
  });
});

test.describe('Driver Editor provenance map and field boxes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  /** The General tab is identity/attribution metadata (Manufacturer, Brand, Model, Comment, …)
   *  — never a Thiele/Small quantity, so it can never gain a provenance formula and was never
   *  meant to be in LABEL_TO_FIELD_KEY. Same for Connection (VCCon): a wiring-mode select, not
   *  a derivable value. Excluded by what they STRUCTURALLY are, not by name-matching a guess at
   *  which fields might drift — every field this system can ever explain stays covered. */

  test('every rendered simulation field is bound to a registry id whose label it renders', async ({ page }) => {
    await openDriverEditor(page);

    const drift: string[] = [];
    const untagged: string[] = [];
    await forEachEditorTab(page, async (tab) => {
      if (tab === 'General') return;
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('.de-body .de-fld')].map(f => ({
          label: f.querySelector('label')?.textContent?.trim() ?? '',
          groundTruth: f.getAttribute('data-field-key'),
        })));
      for (const { label, groundTruth } of rows) {
        if (!label || groundTruth === 'VCCon') continue;
        if (groundTruth == null) { untagged.push(`${tab}/${label}`); continue; }
        const spec = fieldForKey(groundTruth);
        if (!spec) { drift.push(`${tab}/${label}: data-field-key "${groundTruth}" is not a registry field`); continue; }
        if (spec.label !== label) drift.push(`${tab}/${label}: registry label "${spec.label}" != rendered "${label}"`);
      }
    });
    expect(untagged, 'fields with no ground-truth data-field-key to check against').toEqual([]);
    expect(drift, 'rendered labels that disagree with the field registry label').toEqual([]);
  });

  test('every field the provenance map explains takes the inspected highlight', async ({ page }) => {
    await openDriverEditor(page);
    const { explained } = provenanceTables();
    await page.locator('.de-provenance-chk', { hasText: 'Inspect Provenance' }).locator('input').check();

    const dark: string[] = [];
    await forEachEditorTab(page, async (tab, labels) => {
      for (const label of labels) {
        const key = keyForLabel(label) ?? label;
        if (!explained.includes(key)) continue;
        const fld = driverEditorField(page, label);
        await fld.locator('label').click();
        if (!((await fld.getAttribute('style')) ?? '').includes('outline')) dark.push(`${tab}/${label} (${key})`);
      }
    });
    expect(dark, 'fields with a provenance formula that never light up').toEqual([]);
  });

  test('inspecting a field also colours the inputs its formula names', async ({ page }) => {
    await openDriverEditor(page);
    await seedDriverInEditor(page);
    await page.locator('.de-provenance-chk', { hasText: 'Inspect Provenance' }).locator('input').check();

    // Qts = (Qes × Qms) / (Qes + Qms) — one path, two inputs, all three on this tab.
    await driverEditorField(page, 'Qts').locator('label').click();
    await expect(driverEditorField(page, 'Qts')).toHaveAttribute('style', /outline/);
    for (const input of ['Qes', 'Qms']) {
      await expect(driverEditorField(page, input), `${input} feeds Qts`).toHaveAttribute('style', /border-color/);
    }
  });

  /** Fields that carry the CALCULATED mark with no formula behind them.
   *  `c` and `roo` are the engine's air constants — nothing about the driver derives them. */
  const NO_FORMULA = new Set(['c_m_per_s', 'roo_kg_per_m3']);

  test('every field the solver calculated has a provenance formula', async ({ page }) => {
    await openDriverEditor(page);
    await seedDriverInEditor(page);
    const { explained } = provenanceTables();

    const unexplained: string[] = [];
    await forEachEditorTab(page, async (tab, labels) => {
      for (const label of labels) {
        const fld = driverEditorField(page, label);
        const calculated = await fld.evaluate(f =>
          f.classList.contains('value-c') || !!f.querySelector('input.value-c'));
        if (!calculated) continue;
        const key = keyForLabel(label) ?? label;
        if (!explained.includes(key) && !NO_FORMULA.has(key)) unexplained.push(`${tab}/${label} (${key})`);
      }
    });
    expect(unexplained, 'calculated values the inspector cannot explain').toEqual([]);
  });

  test('every field box encloses its own label, input and unit', async ({ page }) => {
    await openDriverEditor(page);
    const escapes: string[] = [];
    await forEachEditorTab(page, async (tab) => {
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
});
