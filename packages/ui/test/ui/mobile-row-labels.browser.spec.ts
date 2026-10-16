/**
 * Phone field rows keep their label clear: the label's line is at least as tall as its text, sits
 * below the row's top border and ends above the input. Every mobile tab with field rows.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const TABS = ['Box', 'Signal', 'Vented'] as const;

interface RowProblem {
  readonly row: string;
  readonly problem: string;
}

/** Every row of the open tab, with whatever is wrong with its label. */
async function labelProblems(page: Page): Promise<{rows: number; problems: RowProblem[]}> {
  return page.locator('.mobile-root').evaluate(root => {
    const problems: RowProblem[] = [];
    const rows = Array.from(root.querySelectorAll('.mob-ui-field.ui-field, .mob-field-row'));
    for (const row of rows) {
      const label = row.querySelector(':scope > label, .mob-field-label');
      const input = row.querySelector('input, select');
      if (label === null || input === null) continue;
      const r = row.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      const i = input.getBoundingClientRect();
      if (r.height === 0 || l.height === 0) continue;
      const name = (label.textContent ?? '').trim();
      const fontSize = parseFloat(getComputedStyle(label).fontSize);
      const borderTop = parseFloat(getComputedStyle(row).borderTopWidth);
      if (l.height < fontSize) problems.push({row: name, problem: `label line ${l.height}px is shorter than its ${fontSize}px text`});
      if (l.top - r.top < borderTop + 2) problems.push({row: name, problem: `label is ${l.top - r.top}px from the row top, border ${borderTop}px`});
      if (l.bottom > i.top + 0.5 && l.top < i.bottom) problems.push({row: name, problem: `label box overlaps its input by ${l.bottom - i.top}px`});
    }
    return {rows: rows.length, problems};
  });
}

/** The Vented tab exists only once the box type is vented; the other tabs keep the default box. */
async function chooseBoxType(page: Page, tab: (typeof TABS)[number]): Promise<void> {
  if (tab !== 'Vented') return;
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  await page.locator('#mob-box-type').selectOption('vented');
}

for (const tab of TABS) {
  test(`mobile ${tab} tab: field labels clear the row border and the input`, async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await chooseBoxType(page, tab);
    await page.locator('.mob-tab', {hasText: tab}).first().click();
    const found = await labelProblems(page);
    expect(found.rows, `no field rows found on ${tab}`).toBeGreaterThan(0);
    expect(found.problems).toEqual([]);
  });
}
