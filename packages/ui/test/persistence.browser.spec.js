import { test, expect } from './fixtures.js';

// Persistence must have ONE source of truth: resonate.state (utils/persist.js,
// written by App.vue's watch, restored by loadLocal on mount). store.js must NOT
// keep its own redundant resonate_v2 key — two stores can disagree, and the second
// one was an orphan nothing else read. See the "two stores" investigation.

test('state persists via one key (resonate.state) and never writes the redundant resonate_v2', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Change a persisted setting.
  await page.locator('#boxtype').selectOption('sealed');
  await expect(page.locator('#side')).toContainText('Qtc'); // sealed panel rendered

  // resonate.state (the single source of truth) is written immediately.
  await page.waitForFunction(() => localStorage.getItem('resonate.state') !== null, { timeout: 3000 });

  // Wait out store.js's 500ms debounce so a (buggy) resonate_v2 write would have landed by now.
  await page.evaluate(() => { window.__persistMark = Date.now(); });
  await page.waitForFunction(() => Date.now() - window.__persistMark > 800, { timeout: 2000 });

  const keys = await page.evaluate(() => ({
    state: localStorage.getItem('resonate.state') !== null,
    v2: localStorage.getItem('resonate_v2') !== null,
  }));
  expect(keys.state, 'resonate.state must be the persistence key').toBe(true);
  expect(keys.v2, 'resonate_v2 must NOT be written — it was a redundant second store').toBe(false);

  // And it restores from that single key on reload.
  await page.reload();
  await expect(page.locator('#side')).toContainText('Qtc');
});
