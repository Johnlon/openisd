import { test, expect, openAProject } from '../fixtures.js';

const soundVelocity = (page: import('@playwright/test').Page) =>
  page.locator('.field', { hasText: 'Sound velocity' }).locator('input');
const airDensity = (page: import('@playwright/test').Page) =>
  page.locator('.field', { hasText: 'Air density' }).locator('input');
const humidity = (page: import('@playwright/test').Page) =>
  page.locator('.field', { hasText: 'Relative humidity' }).locator('input');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('li', { hasText: /^Advanced$/ }).click();
});

test('air density is shown beside sound velocity, both at WinISD\'s own values', async ({ page }) => {
  await expect(soundVelocity(page)).toHaveValue('343.68');
  // WinISD prints 1.20095; the moist-air model gives 1.2009621, which rounds to 1.20096 at
  // the 5 dp WinISD uses — 8.3 ppm from its stored 1.20095217714682.
  await expect(airDensity(page)).toHaveValue('1.20096');
});

test('calculated air readouts stay with the three editable air constants', async ({ page }) => {
  const airFields = page.locator('.adv-air-fields');
  await expect(airFields.locator('label', { hasText: 'Temperature' })).toBeVisible();
  await expect(airFields.locator('label', { hasText: 'Relative humidity' })).toBeVisible();
  await expect(airFields.locator('label', { hasText: 'Air pressure' })).toBeVisible();
  await expect(airFields.locator('label', { hasText: 'Sound velocity' })).toBeVisible();
  await expect(airFields.locator('label', { hasText: 'Air density' })).toBeVisible();
  await expect(airFields.locator('input[readonly]')).toHaveCount(2);
});

test('air constants and calculated readouts use two columns', async ({ page }) => {
  const positions = await page.locator('.adv-air-fields .field').evaluateAll(fields =>
    fields.map(field => ({
      label: field.querySelector('label')?.textContent?.trim(),
      left: Math.round(field.getBoundingClientRect().left),
      top: Math.round(field.getBoundingClientRect().top),
    })),
  );

  const left = positions.filter(field => ['Temperature', 'Relative humidity', 'Air pressure'].includes(field.label ?? ''));
  const right = positions.filter(field => ['Sound velocity', 'Air density'].includes(field.label ?? ''));

  expect(new Set(left.map(field => field.left)).size).toBe(1);
  expect(new Set(right.map(field => field.left)).size).toBe(1);
  expect(right[0]!.left).toBeGreaterThan(left[0]!.left);
  expect(right.find(field => field.label === 'Sound velocity')!.top)
    .toBe(left.find(field => field.label === 'Temperature')!.top);
  expect(right.find(field => field.label === 'Air density')!.top)
    .toBe(left.find(field => field.label === 'Relative humidity')!.top);
  expect(Math.max(...positions.map(field => field.top)) - Math.min(...positions.map(field => field.top))).toBeLessThan(180);
});

test('relative humidity moves both readouts — the input is not inert', async ({ page }) => {
  await humidity(page).fill('100');
  await humidity(page).blur();
  await expect(airDensity(page)).toHaveValue('1.19358');
  await expect(soundVelocity(page)).toHaveValue('344.74');
});

test('ticking "Use WinISD air model" pins the readouts to WinISD\'s constants', async ({ page }) => {
  const useWinisd = page.locator('label', { hasText: 'Use WinISD air model' }).locator('input[type=checkbox]');
  await expect(useWinisd).not.toBeChecked();   // openisd does the physics by default (QO7)

  await humidity(page).fill('100');
  await humidity(page).blur();
  await useWinisd.check();

  await expect(soundVelocity(page)).toHaveValue('343.68');
  await expect(airDensity(page)).toHaveValue('1.20095');

  // Humidity is still a live input in the resolved environment; the switch changes the model.
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
    const raw = await page.evaluate(() => localStorage.getItem('openisd_open_sessions'));
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      const text = session.entries[0]?.text;
      if (!text) return null;
      const parsedProject = JSON.parse(text);
      const activeState = parsedProject.edited || parsedProject.saved;
      return activeState?.environment?.humidity_pct ?? null;
    } catch { return null; }
  }).toBe(55);

  await page.reload();
  await page.locator('li', { hasText: /^Advanced$/ }).click();

  await expect(humidity(page)).toHaveValue('55.00');
});
