/**
 * Nothing in the phone skin may be cut off (John, 5 Nov 2026: "running of the edge is bad why are you
 * asking me!"). Two defects found on a phone: a filter card's refusal note was cut by the card's own
 * overflow:hidden (the Gpk -6 note stopped at "below its flat"), and the "Choose alignment" sheet's
 * label read "Alignmer" because the label column was sized to "Volume", not "Alignment".
 * Each journey runs at 360 and 412 px wide.
 */
import type {Locator, Page} from '@playwright/test';
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';
import {fillAndCommit} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const WIDTHS = [360, 412] as const;
const ADD_BUTTONS = ['+ LP', '+ HP', '+ AP', '+ LT', '+ PEQ', '+ Peak HP', '+ Gain', '+ DLP', '+ LS', '+ HS'] as const;

/** True when the element's text fits its own box, it lies inside the window, and every corner shows the element itself, not a clipping ancestor. */
async function isWhole(el: Locator): Promise<boolean> {
  return el.evaluate(node => {
    const fits = node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1;
    const r = node.getBoundingClientRect();
    const inWindow = r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight;
    const corners = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]]
      .every(([x, y]) => node.contains(document.elementFromPoint(x, y)));
    return fits && inWindow && corners;
  });
}

interface NoteScan { notes: number; problems: string[] }

/** Types an impossible value into each box of the card; every refusal note that appears must show whole. */
async function measureCardNotes(card: Locator, where: string): Promise<NoteScan> {
  const scan: NoteScan = {notes: 0, problems: []};
  const fields = card.locator('.ui-field').filter({has: card.page().locator('input')});
  for (let i = 0; i < await fields.count(); i++) {
    const input = fields.nth(i).locator('input').first();
    for (const bad of ['-999999', '999999999']) {
      await fillAndCommit(input, bad);
      const note = fields.nth(i).locator('.ui-field-note');
      if (await note.count() === 0) continue;
      scan.notes++;
      if (!await isWhole(note)) scan.problems.push(`${where}, field ${i}, typed ${bad}: "${await note.textContent()}"`);
      await input.press('Escape');
    }
  }
  return scan;
}

async function openPhone(page: Page, width: number, project?: string): Promise<void> {
  await page.setViewportSize({width, height: 800});
  await forceMobileSkin(page);
  await page.goto('/');
  if (project === undefined) await openAMobileProject(page);
  else await openAMobileProject(page, project);
}

for (const width of WIDTHS) {
  test(`phone ${width}px: every refusal note of every filter type shows whole, not cut by its card`, async ({appPage: page}) => {
    await openPhone(page, width);
    await page.locator('.mob-tab', {hasText: 'Filters'}).click();
    const problems: string[] = [];
    let notes = 0;
    for (const button of ADD_BUTTONS) {
      await page.getByText(button, {exact: true}).click();
      const result = await measureCardNotes(page.locator('.mob-fcard').last(), `${button} at ${width}px`);
      notes += result.notes;
      problems.push(...result.problems);
      await page.locator('.mob-fcard').last().locator('.mob-fcard-rm').click();
    }
    expect(problems, 'notes cut off').toEqual([]);
    expect(notes, 'the notes were really measured').toBeGreaterThan(5);
  });

  for (const box of ['sealed', 'vented'] as const) {
    test(`phone ${width}px: the ${box} alignment sheet shows every label whole`, async ({appPage: page}) => {
      await openPhone(page, width, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator('#mob-box-type').selectOption(box);
      await page.locator('.mob-clink', {hasText: 'Choose alignment'}).click();
      const sheet = page.locator('.mob-align-sheet');
      await expect(sheet).toBeVisible();
      const labels = sheet.locator('label');
      expect(await labels.count()).toBeGreaterThan(1);
      for (let i = 0; i < await labels.count(); i++) {
        expect(await isWhole(labels.nth(i)), `"${await labels.nth(i).textContent()}" in the ${box} sheet at ${width}px`).toBe(true);
      }
    });
  }
}
