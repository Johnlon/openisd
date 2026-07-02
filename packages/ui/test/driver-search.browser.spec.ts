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
  for (const q of ['demo', 'generic', 'tweeter']) {
    const names = await searchNames(q);
    expect(names.length, `"${q}" returned no drivers`).toBeGreaterThan(0);
    for (const n of names) {
      expect(n.toLowerCase(), `result "${n}" does not contain "${q}"`).toContain(q);
    }
  }

  // Demos are found by their WDR Brand + Model, NOT the filename.
  const demoNames = await searchNames('demo');
  expect(demoNames).toContain('Demo Generic 6.5" Woofer');
  expect(demoNames).toContain('Demo Generic 1" Tweeter');

  // Render the duplicate-name case: the Matt set has "AE TD12M" as two dated files.
  // This re-patches the keyed list with colliding rows, which emits Vue's
  // "Duplicate keys found" warning if the v-for key is not unique — caught by the
  // fixture's console assertion. (A search that filters the duplicates out, like
  // "demo", never triggers it — which is why the first version of this test missed
  // the bug.)
  const dupRows = await searchNames('td12m');
  expect(dupRows.filter(n => /AE TD12M/i.test(n)).length,
    'expected the duplicate "AE TD12M" rows to render (they trigger the key collision)')
    .toBeGreaterThanOrEqual(2);
});
