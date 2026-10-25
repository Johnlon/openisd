/**
 * The mobile Project tab — name, creator, created/modified, description. Reached via the
 * hamburger menu (not the bottom tab bar — it's secondary, not a primary design destination).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
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

// John, 17 Oct 2026: Created and Modified follow the date rule ("16 Oct 2026"), through the one
// design formatter (formatDateStamp / dateStampFrom in packages/design/fields/format.ts). The stored
// stamp stays WinISD's YYYYMMDD, pinned by the .wpr round-trip goldens. Replaces yyyy-mm-dd (29 Sep).
test('Created and Modified show as "16 Oct 2026", and a typed date reads back in that form', async ({ page }) => {
  const created = page.locator('#mob-proj-created');
  await expect(created).toHaveValue(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
  await expect(page.locator('#mob-proj-modified')).toHaveValue(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);

  await created.fill('2 Jan 2026');
  await created.blur();
  await expect(created).toHaveValue('2 Jan 2026');
});

// v-model writes on every key. A half-typed date that is already a real day ("2026-10-1") must not
// redraw the box under the typist; the text stays as typed until the date is complete.
for (const typed of ['2026-10-16', '16 Oct 2026']) {
  test(`typing "${typed}" key by key keeps the typed text, and the date is stored`, async ({ page }) => {
    const created = page.locator('#mob-proj-created');
    await created.fill('');
    await created.pressSequentially(typed);
    await expect(created).toHaveValue(typed);
    await created.blur();
    await page.locator('.mob-dlg-close').click();
    await page.locator('.mob-hamburger').click();
    await page.getByText('Project details').click();
    await expect(page.locator('#mob-proj-created')).toHaveValue('16 Oct 2026');
  });
}
