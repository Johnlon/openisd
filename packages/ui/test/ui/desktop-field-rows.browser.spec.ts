/**
 * Every desktop field row (`UIFieldBody`), on every tab and box type: nothing in the row overlaps
 * (the value's text area, the unit, the ⚠, the ≠W badge, the ▲▼ pair), every part is vertically
 * centred on the row, every box is the control height, and the fonts are one size across the page.
 * John, 26 Oct 2026, after the phone's ≠W badge sat over the Fsc value: "same applies to desktop";
 * "literally every placement and alignment and font and overlap".
 */
import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

const PAGES: readonly {readonly name: string; readonly open: (page: Page) => Promise<void>}[] = [
  ...['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'].map(type => ({
    name: `Box ${type}`,
    open: async (page: Page) => {
      await page.locator('.project-nav li', {hasText: /^Box$/}).click();
      await page.locator('#og-box-type').selectOption(type);
    },
  })),
  ...['Vented', 'Passive Radiator', 'Bandpass', 'ABC'].map(tab => ({
    name: `enclosure tab ${tab}`,
    open: async (page: Page) => {
      await page.locator('.project-nav li', {hasText: /^Box$/}).click();
      await page.locator('#og-box-type').selectOption(tab === 'Vented' ? 'vented' : tab === 'Passive Radiator' ? 'box-passive-radiator' : tab === 'Bandpass' ? 'bandpass6' : 'abc');
      await page.locator('.project-nav li', {hasText: new RegExp(tab)}).first().click();
    },
  })),
  ...['Driver', 'Signal', 'Advanced'].map(tab => ({
    name: tab,
    open: async (page: Page) => { await page.locator('.project-nav li', {hasText: new RegExp(`^${tab}$`)}).click(); },
  })),
];

for (const spec of PAGES) {
  test(`desktop field rows: ${spec.name}`, async ({appPage: page}) => {
    await page.goto('/');
    await openAProject(page);
    await spec.open(page);
    const rows = page.locator('.original-root .ui-field:visible');
    expect(await rows.count(), 'the page has field rows').toBeGreaterThan(0);

    const faults = await rows.evaluateAll(els => {
      const out: string[] = [];
      const fonts = {box: new Set<string>(), label: new Set<string>()};
      const rect = (el: Element | null) => { const r = el?.getBoundingClientRect(); return r && r.width > 0 && r.height > 0 ? r : null; };
      for (const row of els) {
        const input = row.querySelector<HTMLElement>('.ui-field-value input');
        if (!input) continue;
        const label = row.querySelector('label')?.textContent?.trim() ?? '?';
        const say = (what: string, got: number, want: number, tol = 1.5) => { if (Math.abs(got - want) > tol) out.push(`${label}: ${what} is ${got.toFixed(1)}, contract ${want.toFixed(1)}`); };
        const cs = getComputedStyle(input);
        const b = input.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        say('box height', b.height, parseFloat(getComputedStyle(row).getPropertyValue('--ctl-h')) || b.height);
        if (cs.textAlign !== 'right') out.push(`${label}: text-align ${cs.textAlign}, contract right`);
        fonts.box.add(cs.fontSize);
        // The What-if panel and the tight vent pane are deliberately smaller; each is one size within itself.
        const labelFont = getComputedStyle(row.querySelector('label') ?? row).fontSize;
        if (!row.closest('.what-if-fld, .vent-pane-tight')) fonts.label.add(labelFont);
        const parts: {name: string; left: number; right: number; top: number; bottom: number}[] = [{
          name: 'text', left: b.left + parseFloat(cs.paddingLeft), right: b.right - parseFloat(cs.paddingRight), top: b.top, bottom: b.bottom,
        }];
        for (const el of row.querySelectorAll<HTMLElement>('.winisd-deviation-cue, .ui-field-dq-btn, .ui-field-unit, .num-stepper-btn, label')) {
          const e = rect(el);
          if (!e) continue;
          parts.push({name: el.tagName === 'LABEL' ? 'label' : el.className.split(' ')[0], left: e.left, right: e.right, top: e.top, bottom: e.bottom});
        }
        for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], d = parts[j];
          if (Math.min(a.right, d.right) - Math.max(a.left, d.left) > 0.5 && Math.min(a.bottom, d.bottom) - Math.max(a.top, d.top) > 0.5) out.push(`${label}: ${a.name} over ${d.name}`);
        }
        const mid = (b.top + b.bottom) / 2;   // the box is the row's reference; the row may carry a note below
        for (const p of parts) if (p.name !== 'label') say(`${p.name} centre`, (p.top + p.bottom) / 2, mid, 2);
        if (r.right < b.right - 0.5) out.push(`${label}: box past the row's right edge`);
      }
      if (fonts.box.size > 1) out.push(`box fonts differ across the page: ${[...fonts.box].join(', ')}`);
      if (fonts.label.size > 1) out.push(`label fonts differ across the page: ${[...fonts.label].join(', ')}`);
      return out;
    });
    expect(faults, 'every row part sits, sizes and reads as the contract says').toEqual([]);
  });

  // Entered values with many digits (Vas 6.267153900, Fpr 31.83098862, Fb) are cut in the 90 px
  // desktop box: bugs/BUG_20261026_desktop-box-cuts-long-entered-values.md. This test is expected
  // to fail until that bug is fixed; Playwright fails the run when it starts passing, so the mark
  // comes off then.
  test(`desktop field rows: no value is cut — ${spec.name}`, async ({appPage: page}) => {
    test.fail(/Box vented|enclosure tab (Vented|Passive Radiator)/.test(spec.name), 'BUG_20261026_desktop-box-cuts-long-entered-values');
    await page.goto('/');
    await openAProject(page);
    await spec.open(page);
    const cut = await page.locator('.original-root .ui-field:visible .ui-field-value input').evaluateAll(els =>
      els.filter((e): e is HTMLInputElement => e instanceof HTMLInputElement && e.scrollWidth > e.clientWidth + 1).map(e => `${e.id || e.className}: ${e.value}`));
    expect(cut, 'no value is cut in its box').toEqual([]);
  });
}
