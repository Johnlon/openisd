/**
 * T744, QO534 ("an entered value is never overwritten with a calculated value"): a passive radiator picked from the library (P173)
 * keeps its stated Cms and Mms on the project's Passive Radiator tab; they agree with its Vas and Fs within the datasheet's rounding,
 * so no box is marked. A typed Vas that disagrees marks Vas and Cms, with one plain sentence naming them and what the maths gives.
 * The radiator's Sd, Mms, Cms and Rms boxes, which the charts read, carry the blue dot right of their label (ruling: QO532, John,
 * 11 Nov 2026, on the blue dot picture: "do this"); the boxes keep their size and type.
 */
import {expect, openTab, test} from '../fixtures.js';
import {boxLooks, boxesChangedByAccent, drawnDots} from '../fixtures/engineDot.js';
import {ChartInputs} from '@openisd/design/fields';

test('P173 keeps its stated Cms; a typed Vas that disagrees marks Vas and Cms in plain names; the four chart boxes are accented', async ({appPage: page}) => {
  await page.locator('.tb-btn[title*="New project"]').click();
  const root = page.locator('.overlay.open');
  const footer = root.locator('.modal-footer');
  const next = footer.getByRole('button', {name: /Next/});
  await root.locator('.dlist .ditem').first().click();
  await next.click();
  await next.click();
  await root.locator('#np-box-type').selectOption('box-passive-radiator');
  await next.click();
  await root.locator('#np-pr-select').click();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'P173'}).first().click();
  await footer.getByRole('button', {name: /Back/}).click();
  await next.click();
  await footer.getByRole('button', {name: /Create/}).click();
  await expect(root).toHaveCount(0);

  await openTab(page, 'Passive Radiator');
  const cmsBox = page.locator('#og-pr-cms');
  await expect(cmsBox).toHaveValue(/^1\.01/);
  const cms = page.locator('.ui-field', {has: cmsBox});
  await expect(cms.locator('.ui-field-dq-btn')).toHaveCount(0);

  const vas = page.locator('#og-pr-vas');
  await vas.fill('40');
  await vas.blur();
  await expect(cmsBox).toHaveValue(/^1\.01/);
  await cms.locator('.ui-field-dq-btn').first().click();
  const note = cms.locator('.ui-field-note');
  await expect(note).toBeVisible();
  const text = (await note.textContent()) ?? '';
  expect(text).toMatch(/Vas.*Cms.* disagree by [0-9.]+%: .+ gives .+, the box says /);
  expect(text).not.toMatch(/0\.0%/);
  expect(text).not.toMatch(/roo_kg_per|c_m_per_s|_kg_|_m3|_m2/);
  await expect(page.locator('.ui-field', {has: vas}).locator('.ui-field-dq-btn')).toHaveCount(1);

  const dots = await drawnDots(page, '.pr-controls');
  expect(dots.map(d => d.label).sort()).toEqual(['Cms', 'Mms', 'Rms', 'Sd']);
  for (const dot of dots) {
    expect(dot.round, JSON.stringify(dot)).toBe(true);
    expect([dot.width, dot.height, dot.colour], JSON.stringify(dot)).toEqual([ChartInputs.DOT_PX, ChartInputs.DOT_PX, ChartInputs.DOT_COLOUR_RGB]);
    expect(Math.abs(dot.gapFromText - ChartInputs.DOT_GAP_PX), JSON.stringify(dot)).toBeLessThanOrEqual(1);
    expect([dot.hit, dot.clippedBy, dot.overlaps], JSON.stringify(dot)).toEqual(['label', [], []]);
  }
  const looks = await boxLooks(page.locator('.pr-controls .ui-field input'));
  expect(looks.filter(l => l.accented)).toHaveLength(4);
  expect(boxesChangedByAccent(looks)).toEqual([]);
});
