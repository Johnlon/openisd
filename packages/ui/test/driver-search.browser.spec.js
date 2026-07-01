import { test, expect } from '@playwright/test';

// Attach collectors for console errors/warnings, uncaught page errors, and
// same-origin network failures. UI tests MUST assert these are clean — a green
// DOM assertion alone once hid a Vue "Duplicate keys found" warning that was
// corrupting the driver-list rendering (unrelated drivers appeared for a query).
function attachDiagnostics(page) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const networkErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    else if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('requestfailed', req => {
    // Only the app's own resources are our responsibility; external federated
    // driver sources (github.com) may be unreachable in CI and are not our bug.
    if (req.url().includes('localhost')) networkErrors.push(`FAILED ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on('response', resp => {
    if (resp.url().includes('localhost') && resp.status() >= 400) networkErrors.push(`${resp.status()} ${resp.url()}`);
  });
  return { consoleErrors, consoleWarnings, pageErrors, networkErrors };
}

// Library rows only (exclude the "My Drivers" section rows).
const LIB_ITEM = '.ditem:not(.my-ditem) b';

test('driver library search returns only matching drivers, with a clean console + network', async ({ page }) => {
  const diag = attachDiagnostics(page);
  await page.goto('/');

  // Open the driver library browser.
  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  const filter = page.locator('.filter');
  await expect(filter).toBeVisible();

  // Type a query and wait until the rendered list reflects it (every visible row
  // contains the token) — a condition wait, not a fixed sleep.
  const searchNames = async (q) => {
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

  // Every visible result must actually contain the query token. The regression
  // showed unrelated drivers (e.g. "AE TD12M") appearing for "demo"/"generic"
  // because the v-for key was non-unique after switching to Brand+Model names.
  for (const q of ['demo', 'generic', 'tweeter']) {
    const names = await searchNames(q);
    expect(names.length, `"${q}" returned no drivers`).toBeGreaterThan(0);
    for (const n of names) {
      expect(n.toLowerCase(), `result "${n}" does not contain "${q}"`).toContain(q);
    }
  }

  // The two bundled demos must be findable by their WDR Brand + Model, NOT the
  // filename — both "demo" and "generic" resolve to them.
  const demoNames = await searchNames('demo');
  expect(demoNames).toContain('Demo Generic 6.5" Woofer');
  expect(demoNames).toContain('Demo Generic 1" Tweeter');

  // Console + network must be clean. This is the assertion that actually catches
  // the non-unique v-for key ("Duplicate keys found") and any load failure.
  const dupKeys = diag.consoleWarnings.filter(w => /duplicate key/i.test(w));
  expect(dupKeys, 'Vue "Duplicate keys found" warnings').toEqual([]);
  expect(diag.consoleErrors, 'console errors during search').toEqual([]);
  expect(diag.pageErrors, 'uncaught page errors').toEqual([]);
  expect(diag.networkErrors, 'same-origin network failures').toEqual([]);
});
