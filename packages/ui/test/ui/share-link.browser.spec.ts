import {expect, openAProject, test} from '../fixtures.js';

/** The Export menu's Share link: the design travels in the URL hash; session-only chart cursors do not. */

test.describe('Share link', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('the Export menu Share link writes the design into the address bar', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {})); // if clipboard is blocked, shareLink falls back to prompt()
    await page.locator('#btnExportMenu').click();
    await page.locator('#btnShare').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
  });

  test('a pinned graph cursor does NOT survive the share link (the cursor is session-only, never saved)', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const defaultHz = (await page.locator('.cursor-readout .ro-hz').textContent())!.trim();

    // Pin the cursor: hover mid-chart then click (hover sets cursorF, click locks it as pinnedF).
    const chart = page.locator('.graph-wrap .gpanel canvas').first();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    const hz = (await page.locator('.cursor-readout .ro-hz').textContent())!.trim();
    expect(hz).not.toContain('—'); // a real pinned frequency, e.g. "43.30 Hz"

    await page.locator('#btnExportMenu').click();
    await page.locator('#btnShare').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
    const url = await page.evaluate(() => location.href);

    // Open the link cold — no local state, only the URL carries the design. Shares write the
    // hash into the sender's own address bar, so goto(url) alone would be a same-URL no-op
    // navigation that keeps all in-memory state; bounce through about:blank to force a real load.
    await page.evaluate(() => localStorage.clear());
    await page.goto('about:blank');
    await page.goto(url);
    await expect(page.locator('.original-root')).toBeVisible();
    // QO168: cursorF/pinnedF/cursorLocked/dragRange are plain in-memory instance state, excluded
    // from every saved record (not .owpr, not autosave, not a share link) — the recipient sees the
    // sender's design but starts with a fresh, unpinned cursor.
    await expect(page.locator('.cursor-readout .ro-hz')).toHaveText(defaultHz);
  });

  test('a dragged frequency band selection does NOT survive the share link (the cursor is session-only, never saved)', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    // Band-select by dragging across the plot area.
    const chart = page.locator('.graph-wrap .gpanel canvas').first();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 8 });
    await page.mouse.up();
    const readout = (await page.locator('.gread').textContent())!.trim();
    expect(readout).toMatch(/Hz.*–.*Hz/); // e.g. "31.6 Hz – 100 Hz  Δ …"

    await page.locator('#btnExportMenu').click();
    await page.locator('#btnShare').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
    const url = await page.evaluate(() => location.href);

    // Cold open (about:blank bounce — see the pinned-cursor test above for why).
    await page.evaluate(() => localStorage.clear());
    await page.goto('about:blank');
    await page.goto(url);
    await expect(page.locator('.original-root')).toBeVisible();
    // QO168: dragRange is one of the four cursor fields — never part of the saved record, so the
    // recipient's chart opens with no band selected.
    await expect(page.locator('.gread')).toHaveText('');
  });
});
