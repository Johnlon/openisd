/**
 * The mobile Project tab — name, creator, created/modified, description. Reached via the
 * hamburger menu (not the bottom tab bar — it's secondary, not a primary design destination).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  await page.getByText('Project details').click();
});

test('shows the project\'s name, creator, dates and description', async ({ page }) => {
  await expect(page.locator('#mob-proj-name')).toBeVisible();
  await expect(page.locator('#mob-proj-creator')).toBeVisible();
  await expect(page.locator('#mob-proj-created')).toBeVisible();
  await expect(page.locator('#mob-proj-modified')).toBeVisible();
  await expect(page.locator('#mob-proj-description')).toBeVisible();
});

test('editing the name writes the project, and survives switching tabs', async ({ page }) => {
  await page.locator('#mob-proj-name').fill('Living-room sub');
  await page.locator('#mob-proj-name').blur();

  await page.locator('.mob-dlg-close').click();
  await page.locator('.mob-hamburger').click();
  await page.getByText('Project details').click();
  await expect(page.locator('#mob-proj-name')).toHaveValue('Living-room sub');
});

test('editing the description writes the project', async ({ page }) => {
  await page.locator('#mob-proj-description').fill('A test description.');
  await page.locator('#mob-proj-description').blur();
  await expect(page.locator('#mob-proj-description')).toHaveValue('A test description.');
});

// Bug (John, live on his phone, 2026-09-29): "dates should be yyyy-mm-dd" — Created/Modified
// showed the raw WinISD-parity storage string (YYYYMMDD, no separators). Display-only fix
// (logic/dateDisplay.ts); the stored format itself is untouched (pinned by .wpr round-trip
// goldens) — confirmed by typing the displayed format back in and reading the same value out.
test('Created and Modified show as yyyy-mm-dd, not the raw YYYYMMDD storage string', async ({ page }) => {
  const created = page.locator('#mob-proj-created');
  await expect(created).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);

  await created.fill('2026-01-02');
  await created.blur();
  await expect(created).toHaveValue('2026-01-02');
});
