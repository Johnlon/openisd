/**
 * BUG_20261115_mobile-wizard-box-type-select-width-varies (John, 15 Nov 2026: layout is deterministic).
 * The phone wizard's step 3 sizes its label column to "Box type", every time. The page root's style binding
 * rewrites the design's default column on each render, so the measured column must come back after it.
 */
import {expect, test} from '../fixtures.js';
import {VisualSkin} from '../visual/screens.js';

const VISITS = 20;

test('the wizard step 3 label column is the measured one on every visit', async ({page}) => {
  await VisualSkin.MOBILE.start(page);
  await page.getByText('New project').first().click();
  await page.locator('.mob-np-body .dlist .ditem').first().click();
  const footer = page.locator('.mob-np-footer');
  const next = footer.getByText('Next ▸', {exact: true});
  const back = footer.getByText('◀ Back', {exact: true});
  await next.click();
  const lefts: number[] = [];
  for (let visit = 0; visit < VISITS; visit++) {
    await next.click();
    // Two frames: every render and measure the app owes has run (nothing is retried; a stuck column stays stuck).
    const settled = (): Promise<void> => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    await settled();
    // A change after the page has settled draws the page again; the column stays the measured one.
    await page.locator('#np-box-type').selectOption(visit % 2 === 0 ? 'vented' : 'sealed');
    await settled();
    lefts.push(await page.locator('#np-box-type').evaluate(el => el.getBoundingClientRect().left));
    await back.click();
  }
  // The design's default column puts the box at 16 + 123 = 139; "Box type" measured puts it at about 78.
  expect(lefts.filter(left => left > 100), `box left edges: ${lefts.join(', ')}`).toEqual([]);
});
