/**
 * RECORDER, not a test: writes three screenshots of the Original What-if? panel to build/what_if_shots/
 * (the panel, the panel with Qms and Qes cleared, and the panel with the previous field width).
 * The What-if? panel's behaviour is tested in packages/ui/test/ui/what-if-panel.browser.spec.ts. This
 * lives here, not under packages/ui/test, so the browser suite never runs it and never rewrites
 * a tracked file.
 *
 * Run it from the repo root through the tracked probe config, which serves specs from build/tmp:
 *   cp scripts/research/record-what-if-panel-shots.spec.ts build/tmp/record-what-if-panel-shots.browser.spec.ts
 *   npx playwright test -c scripts/playwright.probe.config.mjs build/tmp/record-what-if-panel-shots.browser.spec.ts
 */
import {expect, openAProject, test} from '../../packages/ui/test/fixtures.js';
import type {Page} from '@playwright/test';

const SHOTS = 'build/what_if_shots';

// The shots document the WHAT-IF? PANEL's flagged-Q-trio state, which only happens when Qts cannot
// be solved (needs two of the trio). On the scraped W5 sample the trio is never short of a route —
// clearing Qms/Qes just re-derives them from the rest of the T/S — so these run on the clean
// synthetic driver, where Qts genuinely goes unsolvable (the same fixture QO11.3 uses).
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../../packages/ui/test/fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

async function original(page: Page) {
  await page.goto('/');
  await openAProject(page, COMPLETE);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'What-if' }).click();
  const whatIf = page.locator('.what-if-panel');
  await whatIf.waitFor({ state: 'visible' });
  return whatIf;
}

test('record: Original What-if? panel', async ({ page }) => {
  const whatIf = await original(page);
  await expect(whatIf).toBeVisible();

  await whatIf.screenshot({ path: `${SHOTS}/view_1_driver_what_if_after.png` });

  const fld = (label: string) =>
    page.locator('.what-if-panel .what-if-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
  for (const q of ['Qms', 'Qes']) {
    const i = fld(q);
    await i.click();
    await i.press('Control+a');
    await i.press('Delete');
    await i.blur();
  }
  await whatIf.screenshot({ path: `${SHOTS}/view_1_driver_what_if_qtrio_unavailable.png` });
});

test('record: Original What-if? panel with the previous field width', async ({ page }) => {
  const whatIf = await original(page);
  await expect(whatIf).toBeVisible();
  await page.addStyleTag({ content: '.what-if-unit input, .what-if-roval { width: 100% !important }' });
  await whatIf.screenshot({ path: `${SHOTS}/view_1_driver_what_if_before_width.png` });
});
