/**
 * The Original skin's Advanced pane: temperature, relative humidity and air pressure all feed
 * the sound-velocity and air-density readouts, and the "Ignore humidity and air pressure
 * (as WinISD does)" checkbox turns the last two off (ledger QO7 / QO24.8).
 *
 * A browser test rather than a unit one because the claim being made is about the RENDERED
 * pane — two of these three inputs were visibly live and computationally inert for a long time,
 * which is exactly the failure a green unit test cannot catch.
 */
import { test, expect } from '../fixtures.js';

const soundVelocity = (page: import('@playwright/test').Page) =>
  page.locator('.field', { hasText: 'Sound velocity' }).locator('input');
const airDensity = (page: import('@playwright/test').Page) =>
  page.locator('.field', { hasText: 'Air density' }).locator('input');
const humidity = (page: import('@playwright/test').Page) =>
  page.locator('.field', { hasText: 'Relative humidity' }).locator('input');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('li', { hasText: /^Advanced$/ }).click();
});

test('air density is shown beside sound velocity, both at WinISD\'s own values', async ({ page }) => {
  await expect(soundVelocity(page)).toHaveValue('343.68');
  // WinISD prints 1.20095; the moist-air model gives 1.2009621, which rounds to 1.20096 at
  // the 5 dp WinISD uses — 8.3 ppm from its stored 1.20095217714682.
  await expect(airDensity(page)).toHaveValue('1.20096');
});

test('relative humidity moves both readouts — the input is not inert', async ({ page }) => {
  await humidity(page).fill('100');
  await humidity(page).blur();
  await expect(airDensity(page)).toHaveValue('1.19358');
  await expect(soundVelocity(page)).toHaveValue('344.74');
});

test('ticking "Ignore humidity and air pressure" pins the readouts to WinISD\'s constants', async ({ page }) => {
  const ignore = page.locator('label', { hasText: 'Ignore humidity and air pressure' }).locator('input[type=checkbox]');
  await expect(ignore).not.toBeChecked();   // openisd does the physics by default (QO7)

  await humidity(page).fill('100');
  await humidity(page).blur();
  await ignore.check();

  await expect(soundVelocity(page)).toHaveValue('343.68');
  await expect(airDensity(page)).toHaveValue('1.20095');

  // And humidity is then genuinely ignored, not merely reset.
  await humidity(page).fill('0');
  await humidity(page).blur();
  await expect(airDensity(page)).toHaveValue('1.20095');
});

test('a project\'s stored humidity survives a reload — not reset to the Options default on mount', async ({ page }) => {
  // 55% is deliberately distinct from the app-level Options → General → Environment default
  // (30%, presentationState.ts). BUG_20260823_advtemp_advhumidity_advpressure_overwrote_a_
  // loaded_projects_env_on_mount.md: the Advanced-tab env inputs used to be local refs seeded
  // from that default, pushed into the project by an `{immediate:true}` watch that fired again
  // on every mount — so a reload silently reset a loaded project's own value back to 30%. This
  // pins the fix: reload after the value is actually persisted, and it must come back as 55.
  await humidity(page).fill('55');
  await humidity(page).blur();

  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem('openisd.state'));
    return raw ? JSON.parse(raw).P?.humidityPct : null;
  }).toBe(55);

  await page.reload();
  await page.locator('li', { hasText: /^Advanced$/ }).click();

  await expect(humidity(page)).toHaveValue('55');
});
