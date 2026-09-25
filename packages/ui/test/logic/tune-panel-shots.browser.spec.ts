import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

const SHOTS = 'docs/winisd';

// The shots document the TUNE PANEL's flagged-Q-trio state, which only happens when Qts cannot
// be solved (needs two of the trio). On the scraped W5 sample the trio is never short of a route —
// clearing Qms/Qes just re-derives them from the rest of the T/S — so these run on the clean
// synthetic driver, where Qts genuinely goes unsolvable (the same fixture QO11.3 uses).
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

async function original(page: Page) {
  await page.goto('/');
  await openAProject(page, COMPLETE);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
  const tune = page.locator('.tune-panel');
  await tune.waitFor({ state: 'visible' });
  return tune;
}

test('shots: Original Tune panel', async ({ page }) => {
  const tune = await original(page);
  // The subject has to be on screen for the shot to be worth anything — a screenshot of a panel
  // that never opened is still a valid PNG.
  await expect(tune).toBeVisible();

  await tune.screenshot({ path: `${SHOTS}/view_1_driver_tune_after.png` });

  // QO11.3's documented trio state: with fewer than two of the trio usable, the cleared members
  // fall back to Not Available while the entered anchor stays visible — nothing here is flagged,
  // because the solver never uses a calculated member as a fresh input. (The "all three flagged"
  // panel state this shot once asserted is not what the skin produces today — the trio alert
  // lives in the driver editor's strip instead, which driver-editor-mandatory covers.) The shot
  // documents what the panel actually shows.
  const fld = (label: string) =>
    page.locator('.tune-panel .tune-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
  for (const q of ['Qms', 'Qes']) {
    const i = fld(q);
    await i.click();
    await i.press('Control+a');
    await i.press('Delete');
    await i.blur();
  }
  await expect(fld('Qts')).toHaveClass(/value-e/);
  await expect(fld('Qts')).toHaveValue('0.380');
  await expect(fld('Qes')).toHaveValue('');
  await expect(fld('Qms')).toHaveValue('');
  await tune.screenshot({ path: `${SHOTS}/view_1_driver_tune_qtrio_unavailable.png` });
});

test('shots: Original Tune panel — previous field width', async ({ page }) => {
  const tune = await original(page);
  await expect(tune).toBeVisible();
  await page.addStyleTag({ content: '.tune-unit input, .tune-roval { width: 100% !important }' });
  await tune.screenshot({ path: `${SHOTS}/view_1_driver_tune_before_width.png` });
});
