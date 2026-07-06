import { test, expect } from './fixtures.js';

// Persistence must have ONE source of truth: openisd.state (utils/persist.js,
// written by App.vue's watch, restored by loadLocal on mount). store.js must NOT
// keep its own redundant openisd_v2 key — two stores can disagree, and the second
// one was an orphan nothing else read. See the "two stores" investigation.

test('state persists via one key (openisd.state) and never writes the redundant openisd_v2', async ({ page }) => {
  // Two page.reload()s plus a debounce wait — under full-suite parallel load a reload
  // can exceed the 30 s default. Mark slow (×3) so a load spike isn't a false failure.
  test.slow();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Change a persisted setting.
  await page.locator('#boxtype').selectOption('sealed');
  await expect(page.locator('#side')).toContainText('Qtc'); // sealed panel rendered

  // openisd.state (the single source of truth) is written immediately.
  await page.waitForFunction(() => localStorage.getItem('openisd.state') !== null, { timeout: 3000 });

  // Wait out store.js's 500ms debounce so a (buggy) openisd_v2 write would have landed by now.
  await page.evaluate(() => { (window as unknown as { __persistMark: number }).__persistMark = Date.now(); });
  await page.waitForFunction(() => Date.now() - (window as unknown as { __persistMark: number }).__persistMark > 800, { timeout: 2000 });

  const keys = await page.evaluate(() => ({
    state: localStorage.getItem('openisd.state') !== null,
    v2: localStorage.getItem('openisd_v2') !== null,
  }));
  expect(keys.state, 'openisd.state must be the persistence key').toBe(true);
  expect(keys.v2, 'openisd_v2 must NOT be written — it was a redundant second store').toBe(false);

  // And it restores from that single key on reload.
  await page.reload();
  await expect(page.locator('#side')).toContainText('Qtc');
});
