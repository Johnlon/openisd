/**
 * T744 goal 6: a passive radiator whose datasheet states a Cms and a Vas that disagree (P173) carries one plain sentence
 * on its Cms box in the project's Passive Radiator tab, naming the Cms the charts use. The generic "disagree by N%" text
 * and the raw names of its inputs do not appear.
 */
import {expect, openTab, test} from '../fixtures.js';

test('the Cms popup of P173 on the Passive Radiator tab says the one sentence, in plain names', async ({appPage: page}) => {
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
  const cms = page.locator('.ui-field', {has: page.locator('#og-pr-cms')});
  await cms.locator('.ui-field-dq-btn').first().click();
  const note = cms.locator('.ui-field-note');
  await expect(note).toBeVisible();
  const text = (await note.textContent()) ?? '';
  expect(text).toMatch(/The stated Cms and Vas disagree, so the charts use Cms from Vas \([\d.]+ mm\/N\)\./);
  expect(text).not.toContain('disagree by');
  expect(text).not.toMatch(/roo_kg_per|c_m_per_s|_kg_|_m3|_m2/);
});
