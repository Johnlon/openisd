/**
 * T595: on desktop every field row's number control is the phone's classic control — the same box,
 * the same grey unit chip inside its right edge, the same ▲▼ pair beside it. The look is proven by
 * measuring the Volume control on both skins in one page (the phone skin is a phone-sized window),
 * not by reading the CSS. The phone's own values are pinned to what main drew on 26 Oct 2026, so
 * the desktop change cannot move the phone.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openAProject, openTab, setFocusedBoxType, test} from '../fixtures.js';
import {typeInto} from '../fixtures/numField.js';

/** What a control looks like: the box, the unit chip and the ▲▼ pair, and where they sit. */
interface ControlLook {
  readonly box: Readonly<Record<string, string>>;
  readonly unit: Readonly<Record<string, string>>;
  readonly button: Readonly<Record<string, string>>;
  readonly place: Readonly<Record<string, number | boolean>>;
}

/** The phone skin's Vb control on main, 26 Oct 2026 (Pixel 9 window, 374 x 705). */
const PHONE: ControlLook = {
  box: {'height': '34px', 'font-size': '15px', 'font-family': 'Arial', 'border-top': '1px solid rgb(196, 196, 196)', 'border-radius': '4px', 'background-color': 'rgb(255, 255, 255)', 'padding-left': '14px', 'padding-right': '44px'},
  unit: {'height': '34px', 'font-size': '13px', 'font-weight': '600', 'font-family': 'Inter, system-ui, sans-serif', 'color': 'rgb(136, 136, 136)', 'border-top': '1px solid rgb(207, 207, 207)', 'border-radius': '0px 3px 3px 0px', 'background-color': 'rgb(239, 239, 239)'},
  button: {'width': '40px', 'height': '36px', 'font-size': '18px', 'font-family': 'Inter, system-ui, sans-serif', 'color': 'rgb(34, 34, 34)', 'border-top': '1px solid rgb(153, 153, 153)', 'border-radius': '6px', 'background-image': 'linear-gradient(rgb(253, 253, 253), rgb(226, 226, 226))', 'box-shadow': 'rgba(0, 0, 0, 0.2) 0px 1px 2px 0px'},
  place: {unitInsetRight: 1, unitTop: 0, boxToButton: 6, buttonGap: 4, buttonsSideBySide: true, buttonTopFromBox: -1},
};

const fieldByLabel = (page: Page, label: RegExp): Locator =>
  page.locator('.ui-field', {has: page.locator('label', {hasText: label})}).filter({visible: true}).first();

async function lookOf(field: Locator): Promise<ControlLook> {
  return field.evaluate((f, keys) => {
    const pick = (el: Element | null, ks: readonly string[]): Record<string, string> => {
      if (el === null) return {};
      const c = getComputedStyle(el);
      return Object.fromEntries(ks.map(k => [k, c.getPropertyValue(k)]));
    };
    const input = f.querySelector('.ui-field-value input');
    const unit = f.querySelector('.ui-field-unit');
    const buttons = [...f.querySelectorAll('.num-stepper-btn')];
    const ir = input?.getBoundingClientRect(), ur = unit?.getBoundingClientRect();
    const [a, b] = buttons.map(x => x.getBoundingClientRect());
    const place: Record<string, number | boolean> = ir && ur && a && b ? {
      unitInsetRight: Math.round(ir.right - ur.right), unitTop: Math.round(ur.top - ir.top),
      boxToButton: Math.round(a.left - ir.right), buttonGap: Math.round(b.left - a.right),
      buttonsSideBySide: Math.abs(a.top - b.top) < 0.5, buttonTopFromBox: Math.round(a.top - ir.top),
    } : {};
    return {
      box: pick(input, keys.box), unit: pick(unit, keys.unit), button: pick(buttons[0] ?? null, keys.button),
      place,
    };
  }, {box: Object.keys(PHONE.box), unit: Object.keys(PHONE.unit), button: Object.keys(PHONE.button)});
}

/** Every shown field control on screen that breaks a rule, with the reason; empty when all pass. */
async function brokenControls(page: Page): Promise<string[]> {
  return page.locator('.ui-field').evaluateAll(fields => {
    const layer = (el: Element): Element | null => el.closest('.what-if-panel, [role=dialog], [class*=modal], [class*=overlay]');
    const shown = (el: Element): boolean => el.checkVisibility({visibilityProperty: true, opacityProperty: true});
    const overlap = (a: DOMRect, b: DOMRect): boolean => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const out: string[] = [];
    const live = fields.filter(shown);
    for (const f of live) {
      const name = f.querySelector('label')?.textContent?.trim() || f.querySelector('input')?.id || '(no label)';
      const input = f.querySelector<HTMLInputElement>('.ui-field-value input');
      if (input === null) continue;
      if (input.scrollWidth > input.clientWidth + 1) out.push(`${name}: value cut off ("${input.value}")`);
      const unit = f.querySelector('.ui-field-unit');
      if (unit !== null && unit.scrollWidth > unit.clientWidth + 1) out.push(`${name}: unit cut off`);
      for (const el of [input, ...f.querySelectorAll('.num-stepper-btn')]) {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (hit !== null && hit !== el && !el.contains(hit) && !(el === input && f.contains(hit))) out.push(`${name}: ${el === input ? 'box' : 'button'} covered`);
        if (r.right > innerWidth + 0.5) out.push(`${name}: past the window edge (${Math.round(r.right)} > ${innerWidth})`);
      }
      const fr = f.getBoundingClientRect();
      for (const o of live) if (o !== f && layer(o) === layer(f) && overlap(fr, o.getBoundingClientRect())) out.push(`${name}: overlaps ${o.querySelector('label')?.textContent?.trim()}`);
      for (let a = f.parentElement; a !== null; a = a.parentElement) {
        if (!/hidden|clip/.test(getComputedStyle(a).overflowY)) continue;
        const ar = a.getBoundingClientRect();
        if (fr.bottom > ar.bottom + 0.5 || fr.top < ar.top - 0.5 || fr.right > ar.right + 0.5) { out.push(`${name}: cut off by its panel`); break; }
      }
    }
    const tab = document.querySelector('.tab-section.active');
    if (tab !== null && tab.scrollWidth > tab.clientWidth + 1) out.push(`tab scrolls sideways (${tab.scrollWidth} > ${tab.clientWidth})`);
    if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls sideways');
    if (document.documentElement.scrollHeight > innerHeight) out.push('page scrolls up and down');
    return out;
  });
}

const DESKTOP_TABS = ['Box', 'Driver', 'Vented', 'Filters', 'Signal', 'Advanced', 'Project'] as const;
const BOX_TYPES = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'] as const;

test.describe('desktop number controls are the phone control', () => {
  test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 1400, height: 900});
    await page.goto('/');
    await openAProject(page);
  });

  test('the Volume control looks the same on both skins, and the phone is as on main', async ({page}) => {
    const desktop = await lookOf(fieldByLabel(page, /^Volume$/));
    // A phone-sized window is how a user gets the phone skin; the open project follows.
    await page.setViewportSize({width: 374, height: 705});
    await page.locator('.mob-tabbar').getByText('Box', {exact: true}).click();
    const phone = await lookOf(fieldByLabel(page, /^(Vb|Volume)$/));
    expect(phone, 'the phone control is unchanged from main').toEqual(PHONE);
    expect(desktop, 'the desktop control is the phone control').toEqual(phone);
  });

  test('▲ and ▼ step a desktop value, and typing still works', async ({page}) => {
    const volume = fieldByLabel(page, /^Volume$/);
    const input = volume.locator('.ui-field-value input');
    const before = await input.inputValue();
    await volume.locator('.num-stepper-btn[title="Increase"]').click();
    await expect(input).not.toHaveValue(before);
    await volume.locator('.num-stepper-btn[title="Decrease"]').click();
    await expect(input).toHaveValue(before);
    await typeInto(input, '12.5');
    await input.press('Tab');
    await expect(input).toHaveValue('12.50');
  });

  for (const size of [{width: 1280, height: 800}, {width: 1400, height: 900}]) {
    test(`at ${size.width} x ${size.height} no control is cut off, covered or overlapping, on every tab and box type`, async ({page}) => {
      await page.setViewportSize(size);
      const broken: string[] = [];
      for (const tab of DESKTOP_TABS) {
        await openTab(page, tab);
        broken.push(...(await brokenControls(page)).map(b => `${tab}: ${b}`));
      }
      for (const box of BOX_TYPES) {
        await setFocusedBoxType(page, box);
        for (const tab of await page.locator('.project-nav li').allTextContents()) {
          await openTab(page, tab.trim());
          broken.push(...(await brokenControls(page)).map(b => `${box} ${tab.trim()}: ${b}`));
        }
      }
      expect(broken).toEqual([]);
    });
  }
});
