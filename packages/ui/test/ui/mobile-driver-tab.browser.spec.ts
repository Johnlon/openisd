/**
 * The mobile Driver tab. Select/Edit reuse the app's existing global overlays (DriverBrowser,
 * DriverEditorModal) unchanged — these specs prove the mobile tab reaches the editor, not that
 * the overlays themselves behave correctly (`mobile-driver-browser`, `mobile-driver-editor` and
 * their own spec files cover that).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ appPage: page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Driver' }).click();
});

test('shows the driver identity and the Select/Edit actions', async ({ appPage: page }) => {
  await expect(page.locator('.mob-cname')).toBeVisible();
  await expect(page.getByText('Select driver')).toBeVisible();
  await expect(page.getByText('Edit')).toBeVisible();
});

test('Edit opens the driver editor modal', async ({ appPage: page }) => {
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
});

test('changing the number of drivers and the wiring writes the project', async ({ appPage: page }) => {
  await page.locator('#mob-n-drivers').selectOption('2');
  await expect(page.locator('#mob-n-drivers')).toHaveValue('2');

  const wiringBefore = await page.locator('#mob-wiring').inputValue();
  const options = await page.locator('#mob-wiring option').allTextContents();
  await page.locator('#mob-wiring').selectOption({ index: 1 });
  const wiringAfter = await page.locator('#mob-wiring').inputValue();
  expect(options.length).toBeGreaterThan(1);
  // eslint-disable-next-line playwright/prefer-web-first-assertions -- comparing two runtime-captured values, not a fixed expected one
  expect(wiringAfter).not.toBe(wiringBefore);
});

test('the Connection dropdown uses the same value width as the other Driver dropdown', async ({ appPage: page }) => {
  const widths = await page.evaluate(() => ({
    drivers: document.querySelector<HTMLElement>('#mob-n-drivers')?.getBoundingClientRect().width ?? 0,
    connection: document.querySelector<HTMLElement>('#mob-wiring')?.getBoundingClientRect().width ?? 0,
  }));
  expect(Math.abs(widths.connection - widths.drivers), 'Connection must not use the full-width select variant').toBeLessThanOrEqual(0.5);
});

test('page order matches the mock: name, buttons, Driver band, count, wiring, Key figures band, five figures', async ({ appPage: page }) => {
  await page.setViewportSize({ width: 374, height: 705 });
  const kids = await page.locator('.mob-classic').evaluate(root => [...root.children].map(e => ({
    cls: e.className,
    text: (e instanceof HTMLElement ? e.innerText : '').replace(/\s+/g, ' ').trim(),
  })));
  expect(kids.map(k => k.text.split(' ')[0])).toEqual(['Tang', 'Select', 'DRIVER', 'Drivers', 'Connection', 'KEY', 'Fs', 'Qts', 'Vas', 'Re', 'Xmax']);
  expect(kids.filter(k => k.cls.includes('mob-band')).map(k => k.text)).toEqual(['DRIVER ?', 'KEY FIGURES ?']);
});

test('tapping a key figure opens the driver editor', async ({ appPage: page }) => {
  await page.locator('.mob-ui-field', { hasText: 'Qts' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
});

test('dragging a key figure to scroll does not open the driver editor', async ({ appPage: page }) => {
  await page.setViewportSize({width: 374, height: 400});
  const row = page.locator('.mob-ui-field', {hasText: 'Qts'});
  await row.scrollIntoViewIfNeeded();
  const bounds = (await row.boundingBox())!;
  const content = page.locator('.mob-content');
  const top = await content.evaluate(el => el.scrollTop);
  const cdp = await page.context().newCDPSession(page);
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1}]});
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: y - 15 * i, id: 1}]});
  }
  await expect.poll(() => content.evaluate(el => el.scrollTop)).not.toBe(top);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await expect(page.locator('.de-modal')).toHaveCount(0);
});

test('no sideways scroll and nothing cut at 374x705', async ({ appPage: page }) => {
  await page.setViewportSize({ width: 374, height: 705 });
  const over = await page.locator('.mob-classic').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test('the Select driver button text is visible against its background', async ({ appPage: page }) => {
  await page.setViewportSize({ width: 374, height: 705 });
  const button = page.getByRole('button', { name: 'Select driver' });
  await expect(button).toBeVisible();
  const colours = await button.evaluate(el => {
    const s = getComputedStyle(el);
    return { text: s.color, background: s.backgroundColor };
  });
  expect(colours.text).not.toBe(colours.background);
});
