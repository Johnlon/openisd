import { test, expect } from './fixtures.js';

// The `browserLog` auto-fixture (fixtures.js) already asserts a clean console +
// network for every test — no console errors, no Vue "Duplicate keys found"
// warning, no page errors, no same-origin network failures. This spec's job is to
// (a) assert the DOM results are correct and (b) drive the app into the state that
// makes the key-collision RENDER, so the fixture's console check can catch it.

// Library rows only (exclude the "My Drivers" section rows).
const LIB_ITEM = '.ditem:not(.my-ditem) b';

test('driver library search returns only matching drivers (and renders the duplicate-name case)', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  const filter = page.locator('.filter');
  await expect(filter).toBeVisible();

  // Type a query and wait until the rendered list reflects it (every visible row
  // contains the token) — a condition wait, not a fixed sleep.
  const searchNames = async (q: string) => {
    await filter.fill(q);
    await page.waitForFunction(
      ({ sel, query }) => {
        const items = [...document.querySelectorAll(sel)];
        return items.length > 0 && items.every(b => b.textContent.toLowerCase().includes(query));
      },
      { sel: LIB_ITEM, query: q },
      { timeout: 5000 },
    );
    return page.locator(LIB_ITEM).allTextContents();
  };

  // Every visible result must actually contain the query token.
  for (const q of ['dayton', 'dsa115']) {
    const names = await searchNames(q);
    expect(names.length, `"${q}" returned no drivers`).toBeGreaterThan(0);
    for (const n of names) {
      expect(n.toLowerCase(), `result "${n}" does not contain "${q}"`).toContain(q);
    }
  }

  const dsaNames = await searchNames('dsa115');
  expect(dsaNames.some(n => /dsa115/i.test(n))).toBe(true);
});
