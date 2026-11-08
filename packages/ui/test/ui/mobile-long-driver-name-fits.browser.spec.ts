import {readFileSync} from 'node:fs';
import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';

/**
 * The phone Driver tab's driver-name button (BUG_20261108_phone-driver-name-button-overflows): a long
 * driver name ("SB Acoustics SB15BAC30-8-COAX/ aluminum") wraps inside the 374 px window, whole, and the full
 * name is the button's title (T736, AI live review 8 Nov).
 */
test.use({viewport: {width: 374, height: 705}});

const LONG_MODEL = 'SB Acoustics SB15BAC30-8-COAX/ aluminum cone with a very long descriptive suffix';

test('a long driver name wraps inside the window and is the button title', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  const project = readFileSync(SAMPLE_PROJECT_OWPR, 'utf8').replace(/("model"\s*:\s*\{\s*"value"\s*:\s*)"W5-1138SMF"/, (_all, head: string) => `${head}${JSON.stringify(LONG_MODEL)}`);
  expect(project).toContain('aluminum');
  await page.locator('.mobile-root input[type=file]').setInputFiles({name: 'long-driver.owpr', mimeType: 'application/json', buffer: Buffer.from(project)});
  await page.locator('.mob-tabbar').waitFor({state: 'visible'});
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  const button = page.locator('.mob-cname-button');
  await expect(button).toContainText('aluminum');
  const m = await button.evaluate(el => ({sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, right: el.getBoundingClientRect().right, title: el.getAttribute('title')}));
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(m.sh).toBeLessThanOrEqual(m.ch);
  expect(m.right).toBeLessThanOrEqual(374);
  expect(m.title).toContain('aluminum');
});
