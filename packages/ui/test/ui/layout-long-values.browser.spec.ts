/* eslint-disable playwright/no-conditional-in-test -- one test per view; the known-fault list marks a view test.fail */
/**
 * The longest value every number box can show fits its box on the phone (John, 10 Nov 2026, board: the scan's
 * long-value check "types each field's longest possible string in each of its units (top limit + this formatting)").
 * For every number field and every unit it can be shown in, the field's own formatter writes the bottom and top
 * limit; the wider of the two is measured in the phone box's font against the text area of that field's own box, on every phone view the manifest opens.
 */
import {openAMobileProject, test, expect} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {MOBILE_SURFACES, MobileRoute} from '../fixtures/mobileSurfaceManifest.js';
import {openMobileSurface} from '../fixtures/mobileSurfaceNavigation.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {NumberField, PHONE_MAX_SIGNIFICANT} from '@openisd/design/fields';
import {UNIT_GROUPS} from '@openisd/design/fields';

interface Longest {readonly id: string; readonly field: string; readonly unit: string; readonly text: string}

/** A limit this large is no limit (the field takes any number): there is no longest value to fit. */
const UNBOUNDED = 1e15;

function longestStrings(): Longest[] {
  return NumberField.ALL.flatMap(field => {
    const tokens = field.display.kind === 'switchable' ? UNIT_GROUPS[field.display.group].map(unit => unit.token) : [undefined];
    return tokens.map((token): Longest => {
      const texts = [field.limits.min, field.limits.max].filter(limit => Math.abs(limit) < UNBOUNDED).map(limit => field.format(limit, null, token, PHONE_MAX_SIGNIFICANT));
      const text = texts.reduce((a, b) => (b.length > a.length ? b : a), '');
      return {id: field.value, field: field.label, unit: token ?? field.display.kind, text};
    });
  });
}

const PAGES = MOBILE_SURFACES.filter(surface => surface.route !== MobileRoute.Manual && surface.root !== '').map(surface => surface.id);

/** Views whose Vb box cannot show its top limit in cm3 (100000 L is 100000000 cm3, 76 px; the box holds 68 px beside the 126 px label column). Needs John: lower the limit, or a narrower label column. test.fail: red when fixed, then delete the id. */
const KNOWN: ReadonlySet<string> = new Set(['box-vented', 'box-bandpass4', 'box-bandpass6', 'box-abc']);

for (const id of PAGES) {
  test(`every number box on ${id} has room for the longest value its field can show in any unit`, async ({page}) => {
    if (KNOWN.has(id)) test.fail(true, 'BUG_20261110_layout-scan-first-run');
    await forceMobileSkin(page);
    await page.setViewportSize({width: PIXEL_9.width, height: 2600});
    await page.goto('/');
    await openAMobileProject(page);
    const surface = MOBILE_SURFACES.find(candidate => candidate.id === id);
    if (surface === undefined) throw new Error(`${id} is not on the phone view list`);
    await openMobileSurface(page, surface);
    const tooWide = await page.locator(surface.root).first().evaluate((root, longest) => {
      const context = document.createElement('canvas').getContext('2d');
      if (context === null) throw new Error('no canvas');
      const faults: string[] = [];
      for (const box of root.querySelectorAll<HTMLInputElement>('.ui-field[data-field] input[data-numinput]')) {
        if (!box.checkVisibility()) continue;
        const style = getComputedStyle(box);
        const room = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        context.font = style.font;
        const id = box.closest('.ui-field')?.getAttribute('data-field');
        for (const item of longest.filter(candidate => candidate.id === id)) {
          const width = context.measureText(item.text).width;
          if (width > room) faults.push(`${item.field} in ${item.unit}: "${item.text}" is ${Math.round(width)}px, its box holds ${Math.round(room)}px`);
        }
      }
      return faults;
    }, longestStrings());
    expect(tooWide).toEqual([]);
  });
}
