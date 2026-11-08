/**
 * T733: the desktop What-if header button reads "Collapse" on one line, not clipped. The AI review of
 * test.openisd.app v20261108T0610Z read it as "Col apse" in a picture.
 */
import {expect, openAProject, test} from '../fixtures.js';

test('the What-if Collapse button shows the whole word on one line, unclipped', async ({page}) => {
  await page.setViewportSize({width: 1366, height: 900});
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.locator('.edit-btn', {hasText: 'What-if'}).click();
  const button = page.locator('.what-if-panel .collapse-btn');
  await expect(button).toHaveText('Collapse');
  const m = await button.evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lineTops = new Set(Array.from(range.getClientRects()).map(r => Math.round(r.top)));
    return {lines: lineTops.size, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, font: getComputedStyle(el).fontFamily};
  });
  expect(m.lines).toBe(1);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
});
