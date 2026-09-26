import {expect, openAProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('li', { hasText: /^Advanced$/ }).click();
});

test('WinISD\'s inductance model has no switch of its own — "WinISD driver calculations" covers it (John, 2026-09-26)', async ({ page }) => {
  await expect(page.locator('[data-field-key="winisdInductance"]')).toHaveCount(0);
  const driverCalcs = page.locator('[data-field-key="useWinisdDriverModel"]');
  await expect(driverCalcs).toHaveAttribute('title', /inductance/);
  await expect(driverCalcs).toHaveAttribute('title', /WinISD bug/);
});

test('WinISD Compatibility labels are unclipped and drop the "Use" prefix', async ({ page }) => {
  const panel = page.locator('.sim-options-box', { hasText: 'WinISD Compatibility' });
  const labels = panel.locator('label[data-field-key]');
  await expect(labels).toHaveText(['WinISD driver calculations', 'WinISD air model']);
  const panelBox = (await panel.boundingBox())!;
  const clipRight = await panel.evaluate(el => {
    // The visible right edge: the panel's own, or an ancestor's that clips it first.
    let right = el.getBoundingClientRect().right;
    for (let a = el.parentElement; a; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') right = Math.min(right, a.getBoundingClientRect().right);
    }
    return right;
  });
  for (const label of await labels.all()) {
    const textRight = await label.evaluate(el => {
      const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().right;
    });
    expect(textRight, await label.innerText()).toBeLessThanOrEqual(Math.min(panelBox.x + panelBox.width, clipRight));
  }
});

test('Advanced layout: Reset sits in the WinISD Compatibility header', async ({ page }) => {
  const header = page.locator('.sim-options-header', { hasText: 'WinISD Compatibility' });
  await expect(header.getByRole('button', { name: 'Reset' })).toBeVisible();
});

test('Advanced layout: the transmission-line label wraps before "for"', async ({ page }) => {
  const label = page.locator('label[data-field-key="tlPortModel"]');
  const [firstTop, forTop] = await label.evaluate(el => {
    const text = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent!.includes('for port'))!;
    const at = (i: number) => { const r = document.createRange(); r.setStart(text, i); r.setEnd(text, i + 1); return r.getBoundingClientRect().top; };
    const s = text.textContent!;
    return [at(s.indexOf('U')), at(s.indexOf('for port'))];
  });
  expect(forTop).toBeGreaterThan(firstTop);
});

test('Advanced layout: the air readout column sits 16 px from the air-constant column', async ({ page }) => {
  const rows = page.locator('.adv-air-fields .field-row');
  const leftRight = Math.max(...await Promise.all([0, 1, 2].map(async i => {
    const b = (await rows.nth(i).boundingBox())!; return b.x + b.width;
  })));
  const rightLeft = (await rows.nth(3).boundingBox())!.x;
  expect(Math.round(rightLeft - leftRight)).toBe(16);
});
