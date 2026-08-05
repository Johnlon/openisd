import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

// The scope control — which POOL the WinISD picker lists. All three scopes are on screen at
// once, exactly one highlighted, and a click anywhere on the control rotates the highlight:
// Bundled → My Drivers → All → Bundled. It sits beside the Favorites chip and is ORTHOGONAL
// to it, so the two compose and all six pairings are reachable. That table is what this spec
// proves, one test per cell.
//
// WinISD picker only (DriverBrowserWinisd.vue) — Original and Classic. The Modern picker is
// deliberately untouched. store.ts forces `modern` on port 4100, this suite's port, so the
// skin is seeded through localStorage or these specs never reach the component at all.

const POOL_ROWS = '.dlist .ditem:not(.my-ditem)';
const MY_ROWS = '.dlist .my-ditem';
const SCOPE_CHIP = '.fav-row .scope-filter';
const SCOPE_SEGS = '.fav-row .scope-filter .scope-seg';
const SCOPE_ACTIVE = '.fav-row .scope-filter .scope-seg.active';
const FAV_CHIP = '.fav-row .fav-filter';

// Every scope, in the order the control renders them — which is also the click cycle.
const SCOPE_LABELS = ['Bundled', 'My Drivers', 'All'];

// Two saved drivers, so "My Drivers" can be narrowed to one by a star and the difference
// between "the section is filtered" and "the section is hidden" is visible.
const MY_DRIVERS = [
  { brand: 'Scope Test', model: 'Alpha', Fs: 40, Re: 6.2, Sd: 0.02, Qts: 0.4, Qes: 0.5, Qms: 3 },
  { brand: 'Scope Test', model: 'Beta', Fs: 55, Re: 6.4, Sd: 0.015, Qts: 0.42, Qes: 0.52, Qms: 3.2 },
];

// Clicks needed to reach each scope from the chip's starting position, `All`. Declaring the
// distance rather than clicking until the label matches keeps the walk assertion-free — and
// makes a change to the cycle order fail the cycle test below rather than hang here.
const CLICKS_TO: Record<string, number> = { All: 0, Bundled: 1, 'My Drivers': 2 };

async function openPicker(page: Page): Promise<void> {
  await page.addInitScript((drivers) => {
    localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: 'original' } }));
    localStorage.setItem('openisd_my_drivers', JSON.stringify(drivers));
  }, MY_DRIVERS);
  await page.goto('/');
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist')).toBeVisible();
}

/** Star exactly one bundled driver and one saved driver, with the picker in its `All` state. */
async function starOneOfEach(page: Page): Promise<void> {
  await expect(page.locator(MY_ROWS), 'the two saved drivers were not seeded').toHaveCount(2);
  await page.locator(POOL_ROWS).first().locator('.fav-btn').click();
  await page.locator(MY_ROWS).first().locator('.fav-btn').click();
}

async function setScope(page: Page, label: string): Promise<void> {
  const active = page.locator(SCOPE_ACTIVE);
  await expect(active, 'the picker did not start on the All scope').toHaveText('All');
  for (let i = 0; i < CLICKS_TO[label]; i++) await page.locator(SCOPE_CHIP).click();
  await expect(active, `clicking ${CLICKS_TO[label]}x did not reach the ${label} scope`)
    .toHaveText(label);
}

test('all three scopes are shown at once, and exactly one is highlighted', async ({ page }) => {
  await openPicker(page);
  await expect(page.locator(SCOPE_CHIP), 'no scope control rendered next to the Favorites chip')
    .toHaveCount(1);
  await expect(page.locator(FAV_CHIP), 'the Favorites chip left the row').toHaveCount(1);

  // The whole point of the segmented form: the choices are visible without clicking, in the
  // order clicking will visit them.
  await expect(page.locator(SCOPE_SEGS), 'the control does not show all three scopes at once')
    .toHaveText(SCOPE_LABELS);
  await expect(page.locator(SCOPE_ACTIVE), 'the control does not highlight exactly one scope')
    .toHaveCount(1);
});

test('a click rotates the highlight Bundled → My Drivers → All, and the labels never move', async ({ page }) => {
  await openPicker(page);
  const chip = page.locator(SCOPE_CHIP);
  const active = page.locator(SCOPE_ACTIVE);

  await expect(active, 'the control started somewhere other than All').toHaveText('All');

  // One click, one step, through the rendered order and back to the start — and after each,
  // still all three labels in the same order and still exactly one highlighted. A rotate must
  // never turn into a swap of the control's face.
  for (const expected of SCOPE_LABELS) {
    await chip.click();
    await expect(active, `a click did not move the highlight to ${expected}`).toHaveText(expected);
    await expect(page.locator(SCOPE_SEGS), `the labels changed on the way to ${expected}`)
      .toHaveText(SCOPE_LABELS);
    await expect(active, `more than one scope was highlighted at ${expected}`).toHaveCount(1);
  }
});

// ── The six combinations. Scope decides which library is a candidate, Favorites decides
//    which of those rows survive; neither may swallow the other.

test('Bundled + Favorites off — bundled drivers, and no saved ones', async ({ page }) => {
  await openPicker(page);
  await setScope(page, 'Bundled');
  await expect(page.locator(POOL_ROWS), 'Bundled listed no bundled drivers').not.toHaveCount(0);
  await expect(page.locator(MY_ROWS), 'Bundled left the saved drivers on screen').toHaveCount(0);
});

test('My Drivers + Favorites off — the saved drivers, and nothing bundled', async ({ page }) => {
  await openPicker(page);
  await setScope(page, 'My Drivers');
  await expect(page.locator(POOL_ROWS), 'My Drivers left bundled drivers on screen').toHaveCount(0);
  await expect(page.locator(MY_ROWS), 'My Drivers dropped a saved driver').toHaveCount(2);
});

test('All + Favorites off — every driver, both kinds together', async ({ page }) => {
  await openPicker(page);
  await setScope(page, 'All');
  await expect(page.locator(POOL_ROWS), 'All listed no bundled drivers').not.toHaveCount(0);
  await expect(page.locator(MY_ROWS), 'All dropped a saved driver').toHaveCount(2);
});

test('Bundled + Favorites on — the starred bundled driver only', async ({ page }) => {
  await openPicker(page);
  await starOneOfEach(page);
  await page.locator(FAV_CHIP).click();
  await setScope(page, 'Bundled');
  await expect(page.locator(POOL_ROWS), 'the two filters did not compose over the pool').toHaveCount(1);
  await expect(page.locator(MY_ROWS), 'a starred saved driver survived the Bundled scope').toHaveCount(0);
});

test('My Drivers + Favorites on — the starred saved driver only', async ({ page }) => {
  await openPicker(page);
  await starOneOfEach(page);
  await page.locator(FAV_CHIP).click();
  await setScope(page, 'My Drivers');
  await expect(page.locator(POOL_ROWS), 'a starred bundled driver survived the My Drivers scope').toHaveCount(0);
  await expect(page.locator(MY_ROWS), 'Favorites did not narrow the saved drivers to the starred one').toHaveCount(1);
});

test('All + Favorites on — every starred driver, of both kinds', async ({ page }) => {
  await openPicker(page);
  await starOneOfEach(page);
  await page.locator(FAV_CHIP).click();
  await setScope(page, 'All');
  await expect(page.locator(POOL_ROWS), 'the starred bundled driver is missing').toHaveCount(1);
  await expect(page.locator(MY_ROWS), 'the starred saved driver is missing').toHaveCount(1);
});

test('the count above the list follows the scope, counting both sections', async ({ page }) => {
  await openPicker(page);
  const status = page.locator('.statusrow .status');

  await setScope(page, 'My Drivers');
  await expect(status, 'the count ignored the saved drivers it was listing').toHaveText('2 drivers');

  // A scope that lists rows must never read as an empty list.
  await expect(page.locator('.dlist .status.loading'), 'a populated My Drivers list still showed the empty/loading message')
    .toHaveCount(0);
});
