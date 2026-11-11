/**
 * T744, QO534 ("an entered value is never overwritten with a calculated value"): a passive radiator picked from the library (P173)
 * keeps its stated Cms and Mms on the project's Passive Radiator tab; they agree with its Vas and Fs within the datasheet's rounding,
 * so no box is marked. A typed Vas that disagrees marks Vas and Cms, with one plain sentence naming them and what the maths gives.
 * The radiator's Sd, Mms, Cms and Rms boxes, which the charts read, are accented (QO532).
 */
import {expect, openTab, test} from '../fixtures.js';

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
  expect(text).toMatch(/Vas.*Cms.* disagree: .+ gives .+, the box says /);
  expect(text).not.toContain('disagree by');
  expect(text).not.toMatch(/roo_kg_per|c_m_per_s|_kg_|_m3|_m2/);
  await expect(page.locator('.ui-field', {has: vas}).locator('.ui-field-dq-btn')).toHaveCount(1);

  const accented = await page.locator('.pr-controls .ui-field-drives-charts').evaluateAll(fields => fields.map(f => f.getAttribute('data-field')));
  expect(accented).toHaveLength(4);
});
