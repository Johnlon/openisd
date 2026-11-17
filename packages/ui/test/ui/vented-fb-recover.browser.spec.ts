import {expect, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {fillAndCommit} from '../fixtures/numField.js';

/**
 * John, 17 Nov 2026: "bug in vented box once FB goes to low and we get dq and port len is
 * ridiculous then raising FB the Len does not respond until I clear it". Whatever Fb has been,
 * typing a sensible Fb makes the port length follow it again.
 */
const SHOT = '/tmp/claude-1000/-home-johnl-work-winisd/ffd8e5c1-e913-4f9a-9636-1eedad94d42a/scratchpad/ventfb';

test('raising Fb after an absurdly low Fb recalculates the port length', async ({appPage: page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'vented');
  await page.locator('.project-nav li', {hasText: 'Vented'}).click();
  const fb = page.locator('#og-vent-fb-target'), len = page.locator('#og-vent-length');

  await fillAndCommit(fb, '40');
  const lenAt40 = Number(await len.inputValue());
  expect(lenAt40).toBeGreaterThan(0);

  await fillAndCommit(fb, '1');
  const absurd = Number(await len.inputValue());
  expect(absurd, 'a 1 Hz tuning needs an absurdly long port').toBeGreaterThan(lenAt40 * 100);

  await fillAndCommit(fb, '2');
  await fillAndCommit(fb, '40');
  await page.screenshot({path: `${SHOT}/after-raising-fb.png`});
  await expect.poll(async () => Number(await len.inputValue()), {message: 'port length follows the raised Fb'}).toBeCloseTo(lenAt40, 1);
});

test('on the phone skin, raising Fb after an absurdly low Fb recalculates the vent length', async ({appPage: page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  const fb = mobileFieldRow(page, 'Fb').locator('input'), len = mobileFieldRow(page, 'Vent length').locator('input');

  await fb.fill('28.6');
  await fb.blur();
  const lenAt28 = Number(await len.inputValue());
  expect(lenAt28).toBeGreaterThan(0);

  await fb.fill('1');
  await fb.blur();
  expect(Number(await len.inputValue()), 'a 1 Hz tuning needs an absurdly long port').toBeGreaterThan(lenAt28 * 100);

  await fb.fill('28.6');
  await fb.blur();
  await page.screenshot({path: `${SHOT}/after-fix-phone.png`});
  await expect.poll(async () => Number(await len.inputValue()), {message: 'vent length follows the raised Fb'}).toBeCloseTo(lenAt28, 1);
});
