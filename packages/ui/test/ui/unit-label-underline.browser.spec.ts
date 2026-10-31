/** Every unit uses the selected joined-unit reference on both skins. The rejected separate-unit prototype is retained only as history. */
import {expect, test} from '../fixtures.js';
import type {Locator} from '@playwright/test';
import {ALL_FIELDS, NumberField} from '@openisd/design/fields';
import {referenceUnitPaint, measureUnitPaint} from '../fixtures/referenceUnitPaint.js';
import {SCREENS} from '../visual/screens.js';

async function waitForLabelsWhereExpected(screenName: string, labels: Locator): Promise<void> {
  if (!/^(tab-box|tab-driver|tab-advanced|tab-enclosure|box-|wizard-.*-step4)/.test(screenName)) return;
  await expect.poll(() => labels.evaluateAll(els => els.filter(el => el.checkVisibility()).length)).toBeGreaterThan(0);
}

// Render the complete app surface: project tabs, all six box types, and every new-project step.
// This catches fields that never acquire the shared component, even when their visible label or
// toggle metadata is missing.
const project_screens = SCREENS.filter(s => s.name !== 'empty');

for (const screen of project_screens) {
  test(`unit labels match the selected reference ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const unwrappedNumeric = await page.locator('input[data-numinput]:visible, input[type=number]:visible').evaluateAll(inputs => inputs
      .filter(input => input.closest('.ui-field') === null)
      .map(input => `${input.getAttribute('aria-label') ?? input.getAttribute('name') ?? '(unlabelled)'}: outside .ui-field`));
    expect(unwrappedNumeric, `numeric controls outside the shared field component on ${screen.skin.name} ${screen.name}`).toEqual([]);
    const expected = Object.fromEntries(ALL_FIELDS.filter((field): field is NumberField => field instanceof NumberField).map(field => {
      const token = field.unitTokenFor({});
      return [field.value, {text: field.unitLabel(token), toggle: field.display.kind === 'switchable' && field.nextToken(token) !== token}];
    }));
    const semantics = await page.locator('.ui-field:visible').evaluateAll((rows, fields) => rows.flatMap(row => {
      const id = row.getAttribute('data-field') ?? '';
      const spec = fields[id];
      if (spec === undefined) return row.querySelector('[data-numinput],input[type="number"]') === null ? [] : [id + ': unknown numeric field'];
      const units = row.querySelectorAll('.ui-field-unit');
      if (units.length !== 1) return [id + ': missing or duplicate unit slot'];
      const unit = units[0];
      if (unit === undefined) throw new Error('Expected unit slot');
      const problems: string[] = [];
      if (!unit.classList.contains('unit-label')) problems.push(id + ': unit bypasses the shared unit component');
      if (unit.textContent !== spec.text) problems.push(id + ': unit text differs from the registered default');
      if (unit.classList.contains('unit-toggle') !== spec.toggle) problems.push(id + ': unit affordance differs from its intrinsic choices');
      if (unit.getAttribute('role') !== (spec.toggle ? 'button' : null)) problems.push(id + ': wrong unit role');
      if (unit.getAttribute('tabindex') !== (spec.toggle ? '0' : null)) problems.push(id + ': wrong unit Tab capability');
      return problems;
    }), expected);
    expect(semantics).toEqual([]);
    const labels = page.locator('[role="button"][title^="Click to change units"]');
    await waitForLabelsWhereExpected(screen.name, labels);
    const reference = await referenceUnitPaint(page,screen.skin.name,screen.name);
    await expect(page.locator('.unit-label:visible')).toHaveCount(reference.units.length);
    const visibleUnits=await page.locator('.unit-label:visible').all();
    for (const [index,unit] of visibleUnits.entries()) {
      const id = await unit.evaluate(element => element.closest('.ui-field')?.getAttribute('data-field') ?? '');
      expect(expected[id], 'unit must belong to a registered numeric field').toBeDefined();
      const spec = requireUnitOwner(expected[id]);
      expect(reference.units[index]?.field).toBe(id);
      expect(reference.units[index]?.symbol).toBe(spec.text);
      expect(reference.units[index]?.toggle).toBe(spec.toggle);
      const inWideChipGroup = await unit.evaluate(element => element.closest('.driver-advanced-fields, .adv-air-fields') !== null);
      const expectedPaint = approvedUnitPaint(reference.units[index]?.paint, id, screen.skin.name, inWideChipGroup);
      expect(await unit.evaluate(measureUnitPaint)).toEqual(expectedPaint);
    }

  });
}

const SIGNAL_GEN_FIELD = 'signal_GenHz_hz';

type UnitPaint = Awaited<ReturnType<typeof referenceUnitPaint>>['units'][number]['paint'];

/** T607 approved desktop deviations from the frozen reference: the signal-generator Hz cap is 11px (.signal-gen-field,
 *  OriginalShell.vue) and Driver advanced / Advanced air rows use a fixed 60px unit chip (joined-fields.css). */
function approvedUnitPaint(paint: UnitPaint | undefined, id: string, skin: string, inWideChipGroup: boolean): UnitPaint | undefined {
  if (paint === undefined || skin === 'mobile') return paint;
  const sized = id === SIGNAL_GEN_FIELD ? {...paint, fontSize: '11px', lineHeight: '15.95px'} : paint;
  return inWideChipGroup ? {...sized, width: 60} : sized;
}

function requireUnitOwner<T>(spec: T | undefined): T {
  if (spec === undefined) throw new Error('Expected numeric unit owner');
  return spec;
}

// Every visible numeric row checks that its unit stays outside the numeric box and
// warning/WinISD adornments stay in-row without covering the value or unit.
function fieldRowsSelector(skinName: string): string {
  return skinName === 'mobile' ? '.mob-classic .ui-field:visible' : '.original-root .ui-field:visible';
}
for (const screen of project_screens) {
  test(`unit and adornment geometry ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const selector = fieldRowsSelector(screen.skin.name);
    const reference = await referenceUnitPaint(page,screen.skin.name,screen.name);
    const misplaced = await page.locator(selector).evaluateAll((rows, expectedUnits) => rows.flatMap(row => {
      const label = row.querySelector('label')?.textContent?.trim() ?? '(unlabelled)';
      const numeric = row.querySelector('[data-numinput], input[type=number], .ui-field-value input,.ui-field-value select,.ui-field-value > .calculated');
      if (!numeric) return [];
      const unit = row.querySelector<HTMLElement>('.ui-field-unit');
      const hasUnit = unit !== null && unit.textContent?.trim() !== '';
      const control = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value select, .ui-field-value .mob-readonly, .ui-field-value .calculated');
      const rr = row.getBoundingClientRect();
      const inside = (r: DOMRect, outer: DOMRect) => r.left >= outer.left && r.top >= outer.top
        && r.right <= outer.right && r.bottom <= outer.bottom;
      const problems: string[] = [];
      if (hasUnit && !control) problems.push(`${label}: unit has no value control`);
      if (hasUnit && control && unit) {
        const ur = unit.getBoundingClientRect();
        const cr = control.getBoundingClientRect();
        // T607: desktop Driver advanced and Advanced air rows give the unit a fixed 60px chip
        // (joined-fields.css .driver-advanced-fields / .adv-air-fields); every other row keeps the approved width.
        const wideChip = row.closest('.driver-advanced-fields, .adv-air-fields') !== null;
        const approved=expectedUnits.find(entry=>entry.field===row.getAttribute('data-field')&&entry.symbol===unit.textContent);
        if(!approved)problems.push(`${label}: missing approved joined-unit reference`);
        else if(ur.left-cr.right!==-(wideChip?60:Number(approved.paint.width)))problems.push(`${label}: unit gap ${ur.left-cr.right}, expected ${-(wideChip?60:Number(approved.paint.width))}`);
        if (ur.top !== cr.top || ur.height !== cr.height) problems.push(`${label}: unit and value edges do not align`);
        if (!inside(ur, rr)) problems.push(`${label}: unit outside field row by ${Math.max(rr.left - ur.left, ur.right - rr.right, 0)}px`);
      }
      for (const cue of row.querySelectorAll<HTMLElement>('.ui-field-dq-btn, .winisd-deviation-cue')) {
        if (!cue.getClientRects().length) continue;
        const qr = cue.getBoundingClientRect();
        if (!inside(qr, rr)) problems.push(`${label}: ${cue.className} outside field row; cue ${qr.left}-${qr.right}, row ${rr.left}-${rr.right}`);
        if (control) {
          // Some readouts deliberately place ≠W inside the value box. Guard the digits/text area,
          // not the whole box: reserved right padding is where the adornment belongs.
          let textRect: DOMRect;
          if (control.matches('input, select, textarea')) {
            const cr = control.getBoundingClientRect(), css = getComputedStyle(control);
            const left = cr.left + parseFloat(css.paddingLeft || '0');
            const right = cr.right - parseFloat(css.paddingRight || '0');
            textRect = new DOMRect(left, cr.top, Math.max(0, right - left), cr.height);
          } else {
            const range = document.createRange();
            range.selectNodeContents(control);
            textRect = range.getBoundingClientRect();
          }
          if (qr.left < textRect.right - 0.5 && qr.right > textRect.left + 0.5 && qr.top < textRect.bottom - 0.5 && qr.bottom > textRect.top + 0.5) {
            problems.push(`${label}: ${cue.className} overlaps the displayed value`);
          }
        }
        if (hasUnit && unit) {
          const ur = unit.getBoundingClientRect();
          if (qr.left < ur.right - 0.5 && qr.right > ur.left + 0.5 && qr.top < ur.bottom - 0.5 && qr.bottom > ur.top + 0.5) {
            problems.push(`${label}: ${cue.className} overlaps the unit`);
          }
        }
      }
      const cues = [...row.querySelectorAll<HTMLElement>('.ui-field-dq-btn, .winisd-deviation-cue')].filter(cue => cue.getClientRects().length > 0);
      for (let i = 0; i < cues.length; i++) for (let j = i + 1; j < cues.length; j++) {
        const a = cues[i]!.getBoundingClientRect(), b = cues[j]!.getBoundingClientRect();
        if (a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5) {
          problems.push(`${label}: ${cues[i]!.className} overlaps ${cues[j]!.className}`);
        }
      }
      return problems;
    }), reference.units);
    expect(misplaced, `unit/control and warning/WinISD cue placement on ${screen.skin.name} ${screen.name}`).toEqual([]);
  });
}
