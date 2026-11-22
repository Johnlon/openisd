/**
 * The skin switch: automatic by viewport width (`logic/viewport.ts`, 600px breakpoint) with a
 * manual, persisted override (`presentationState.ui.skinOverride`, set from each shell's Info
 * menu). `App.vue`'s `activeSkin` combines the two, override winning when present.
 *
 * The viewport must be set BEFORE `page.goto('/')`: `App.vue` reads `matchMedia` synchronously
 * at setup time, before its first render, so the skin is decided from whatever viewport the
 * page already has at load — not from a later resize.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test('the default (wide) viewport renders the desktop shell, with no mobile root in the DOM', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.mobile-root')).toHaveCount(0);
});

test('a phone-width viewport auto-detects into the mobile shell, with no desktop root in the DOM', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();
  await expect(page.locator('.original-root')).toHaveCount(0);
});

test('a viewport right at the breakpoint boundary: 600px is mobile, 601px is desktop', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();

  await page.setViewportSize({ width: 601, height: 800 });
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
});

test('the Info menu\'s "Switch to Mobile view" overrides a wide viewport, and the choice survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();

  await page.locator('.tb-btn[title="Info"]').click();
  await page.getByText('Switch to Mobile view').click();
  await expect(page.locator('.mobile-root')).toBeVisible();
  await expect(page.locator('.original-root')).toHaveCount(0);

  // Still a wide viewport — only the persisted override explains staying on the mobile shell.
  await page.reload();
  await expect(page.locator('.mobile-root')).toBeVisible();
});

test('the mobile shell\'s "Switch to Desktop view" overrides a narrow viewport, and the choice survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();

  await page.getByText('Switch to Desktop view').click();
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.mobile-root')).toHaveCount(0);

  // Still a narrow viewport — only the persisted override explains staying on the desktop shell.
  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
});

test('the desktop Info menu offers "Automatic view" only after a choice was made, and it follows the window again', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tb-btn[title="Info"]').click();
  await expect(page.getByText('Automatic view')).toHaveCount(0);

  await page.getByText('Switch to Mobile view').click();
  await expect(page.locator('.mobile-root')).toBeVisible();
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'Automatic view' }).click();

  // Wide window, no choice saved: the desktop shell is back, and stays after a reload.
  await expect(page.locator('.original-root')).toBeVisible();
  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
  await page.locator('.tb-btn[title="Info"]').click();
  await expect(page.getByText('Automatic view')).toHaveCount(0);
});

test('on a phone-width window, "Automatic view" undoes "Switch to Desktop view" and the mobile shell returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Automatic view' })).toHaveCount(0);

  await page.getByText('Switch to Desktop view').click();
  await expect(page.locator('.original-root')).toBeVisible();
  await page.locator('.tb-btn[title="Info"]').click();
  await page.getByText('Automatic view').click();

  await expect(page.locator('.mobile-root')).toBeVisible();
  await page.reload();
  await expect(page.locator('.mobile-root')).toBeVisible();
});

// QO418: a phone turned sideways keeps the phone layout. Tablets and mouse-driven short windows stay desktop.
test.describe('touch phone, turned sideways', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 705, height: 374 } });

  test('705x374 touch is the mobile shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mobile-root')).toBeVisible();
    await expect(page.locator('.original-root')).toHaveCount(0);
  });

  test('rotating with a project open and an unsaved edit keeps the project and the edit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await openAMobileProject(page);
    const input = page.locator('.mob-content input').first();
    await input.fill('1.234');
    await input.blur();
    const edited = await input.inputValue();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.mobile-root')).toBeVisible();
    await expect(page.locator('.mob-tabbar')).toBeVisible();
    await expect(page.locator('.mob-content input').first()).toHaveValue(edited);
  });

  test('the saved Desktop choice still wins sideways', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'original' } }));
    });
    await page.goto('/');
    await expect(page.locator('.original-root')).toBeVisible();
  });
});

test.describe('tablets and mouse windows stay desktop', () => {
  for (const [w, h] of [[1024, 768], [768, 1024]] as const) {
    test(`${w}x${h} touch tablet`, async ({ browser }) => {
      const ctx = await browser.newContext({ hasTouch: true, viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.locator('.original-root')).toBeVisible();
      await ctx.close();
    });
  }

  test('a short mouse window (900x400) stays desktop', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 400 });
    await page.goto('/');
    await expect(page.locator('.original-root')).toBeVisible();
  });
});
