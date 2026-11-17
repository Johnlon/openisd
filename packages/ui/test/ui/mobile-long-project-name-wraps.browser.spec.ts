import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/**
 * The phone header's project name cell (90 px on a phone with the cloud badge): a long name
 * ("AS168-9-470 passive radiator") wraps onto three lines, whole, with no sideways overflow (T735, AI live review 8 Nov).
 */
test.use({viewport: {width: PIXEL_9.width, height: PIXEL_9.height}});

test('a 90 px header name cell shows "AS168-9-470 passive radiator" whole, on up to three lines, with no sideways overflow', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, undefined, 'AS168-9-470 passive radiator.owpr');
  const m = await page.locator('.mob-project-title').evaluate(el => {
    el.setAttribute('style', 'flex: none; width: 90px');
    return {sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight};
  });
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(m.sh).toBeLessThanOrEqual(m.ch);
});
