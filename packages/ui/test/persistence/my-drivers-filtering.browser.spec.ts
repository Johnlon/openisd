import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';
import {myDriversJson, type SeedDriver} from '../fixtures/seedMyDrivers.js';

// EVERY control in the filter bar reaches My Drivers, not just the text box.
//
// The section used to answer the search query and the Favorites toggle and silently ignore
// the type chips and the Fs/Sd/Znom bounds, so narrowing the library left unrelated saved
// drivers sitting on screen — the exact failure `.claude/rules/openisd-ui-design.md`
// §"Filters apply to every list" exists to prevent. Both lists now run through one
// predicate (`matchesCriteria` in packages/persistence/src/repos/driverRepo.ts).

const MY_DRIVERS_KEY = 'openisd_my_drivers';
const MY_ROWS = '.dlist .my-ditem';

// Two saved drivers that differ in every axis the filter bar can ask about: name, Fs, Sd
// and nominal impedance — and whose NAMES classify them into different type chips.
const SAVED: SeedDriver[] = [
  { brand: 'Bench', model: 'Deep Subwoofer', specs: { Fs_hz: 22, Qts: 0.4, Qes: 0.44, Qms: 5,
    Vas_m3: 0.09, Sd_m2: 0.052, Re_ohm: 3.4, Xmax_m: 0.012, Pe_W: 300, Znom_ohm: 4 } },
  { brand: 'Bench', model: 'Midrange Cone', specs: { Fs_hz: 900, Qts: 0.5, Qes: 0.6, Qms: 3,
    Vas_m3: 0.0002, Sd_m2: 0.0009, Re_ohm: 5.6, Xmax_m: 0.0005, Pe_W: 40, Znom_ohm: 8 } },
];

async function open(page: Page): Promise<void> {
  await page.addInitScript(([json, key]) => {
    localStorage.setItem(key as string, json as string);
  }, [myDriversJson(SAVED), MY_DRIVERS_KEY] as const);
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
}

test('My Drivers honour the Fs bounds', async ({ page }) => {
  await open(page);
  await expect(page.locator(MY_ROWS)).toHaveCount(2);

  await page.locator('input.pnum[title*="Minimum Fs" i]').fill('100');
  await expect(page.locator(MY_ROWS)).toHaveCount(1);
  await expect(page.locator(MY_ROWS)).toContainText('Silk Dome Tweeter');

  await page.locator('input.pnum[title*="Minimum Fs" i]').fill('');
  await page.locator('input.pnum[title*="Maximum Fs" i]').fill('100');
  await expect(page.locator(MY_ROWS)).toHaveCount(1);
  await expect(page.locator(MY_ROWS)).toContainText('Deep Subwoofer');
});

test('My Drivers honour the type chips', async ({ page }) => {
  await open(page);
  await page.locator('button.type-chip', { hasText: /^Tweet$/ }).click();
  await expect(page.locator(MY_ROWS)).toHaveCount(1);
  await expect(page.locator(MY_ROWS)).toContainText('Silk Dome Tweeter');
});

test('My Drivers honour the Sd bounds', async ({ page }) => {
  await open(page);
  await page.locator('input.pnum[title*="Minimum Sd" i]').fill('100');   // cm²
  await expect(page.locator(MY_ROWS)).toHaveCount(1);
  await expect(page.locator(MY_ROWS)).toContainText('Deep Subwoofer');
});

test('My Drivers honour the impedance filter', async ({ page }) => {
  await open(page);
  await page.locator('button', { hasText: /^4/ }).first().click();
  await expect(page.locator(MY_ROWS)).toHaveCount(1);
  await expect(page.locator(MY_ROWS)).toContainText('Deep Subwoofer');
});
