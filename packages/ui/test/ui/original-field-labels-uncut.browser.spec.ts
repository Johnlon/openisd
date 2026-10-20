import {expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

/**
 * No field label on the Original Box or Vented tab is cut by an ellipsis at 1280x800
 * (bugs/BUG_20261019_desktop-target-tuning-label-cut.md: "Tuning freq (Fb)" showed as
 * "Target …", "Number of Vents" as "Number of Ve…"). A label may wrap onto two lines, never be cut.
 */

test.use({viewport: {width: 1280, height: 800}});

/** The text of every visible label whose text runs past its own box. */
async function cutLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cut: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.tab-section.active label, .tab-section.active .ui-field-label')) {
      if (el.offsetParent === null) continue;
      if (el.scrollWidth > el.clientWidth + 1) cut.push(`${el.textContent ?? ''} (${el.scrollWidth} > ${el.clientWidth})`);
    }
    return cut;
  });
}

for (const [tab, boxType] of [
  ['Box', 'sealed'], ['Box', 'vented'], ['Vented', 'vented'], ['Box', 'bandpass4'], ['Box', 'bandpass6'], ['Box', 'abc'],
] as const) {
  test(`${tab} tab of a ${boxType} project: no label is cut`, async ({appPage: page}) => {
    await page.goto('/');
    await openAProject(page);
    await setFocusedBoxType(page, boxType);
    await page.locator('.project-nav li', {hasText: tab}).first().click();
    expect(await cutLabels(page)).toEqual([]);
  });
}

// BUG_20261020_desktop-abc-chamber-labels-inconsistent: a wrapped chamber label is centred on its box, not sitting lower.
for (const boxType of ['abc', 'bandpass4'] as const) {
  test(`Box tab of a ${boxType} project: each chamber label is level with its input box`, async ({appPage: page}) => {
    await page.goto('/');
    await openAProject(page);
    await setFocusedBoxType(page, boxType);
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    const offsets = await page.evaluate(() => {
      const out: number[] = [];
      for (const f of document.querySelectorAll<HTMLElement>('.tab-section.active .box-fields-col .ui-field')) {
        const label = f.querySelector('label');
        const input = f.querySelector('input');
        if (!label || !input || input.offsetParent === null) continue;
        const l = label.getBoundingClientRect();
        const i = input.getBoundingClientRect();
        out.push(Math.abs((l.top + l.bottom) / 2 - (i.top + i.bottom) / 2));
      }
      return out;
    });
    expect(offsets.length).toBeGreaterThan(0);
    for (const o of offsets) expect(o).toBeLessThanOrEqual(2);
  });
}
