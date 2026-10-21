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

test('no sideways scroll and nothing cut at 374x705', async ({ appPage: page }) => {
  await page.setViewportSize({ width: 374, height: 705 });
  const over = await page.locator('.mob-classic').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});
