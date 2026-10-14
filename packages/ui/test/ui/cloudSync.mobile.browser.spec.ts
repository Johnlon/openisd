import {execSync, spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdirSync, rmSync} from 'node:fs';
import net from 'node:net';
import {join} from 'node:path';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';

const REPO_ROOT = join(process.cwd());
const CLOUD_DIST = join(REPO_ROOT, 'build', `test-dist-cloud-mobile-${process.pid}`);
const SCREENSHOT_DIR = join(REPO_ROOT, 'build', 'screenshots');

let cloudPort = 0;
let cloudBaseUrl = '';
let previewProcess: ChildProcess | null = null;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr !== null) {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error('could not bind free port'));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
    } catch {
      // wait a bit
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

test.describe('Mobile Cloud Sync (T129 / P1-13b)', () => {
  test.beforeAll(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    cloudPort = await getFreePort();
    cloudBaseUrl = `http://localhost:${cloudPort}`;

    execSync(
      `node_modules/.bin/vite build --mode test --outDir ${CLOUD_DIST} --emptyOutDir`,
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          VITE_GOOGLE_CLIENT_ID: 'test-google-client-id-12345.apps.googleusercontent.com',
        },
        stdio: 'pipe',
      },
    );

    previewProcess = spawn(
      'node_modules/.bin/vite',
      [
        'preview',
        '--outDir',
        CLOUD_DIST,
        '--port',
        String(cloudPort),
        '--strictPort',
      ],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          OPENISD_DRIVERS_BUNDLE_DIR: 'build/test-bundle',
        },
        stdio: 'pipe',
      },
    );

    await waitForServer(cloudBaseUrl);
  });

  test.afterAll(async () => {
    if (previewProcess) {
      previewProcess.kill('SIGTERM');
    }
    if (existsSync(CLOUD_DIST)) {
      rmSync(CLOUD_DIST, { recursive: true, force: true });
    }
  });

  test.describe('Default test build without client ID (ADDENDUM)', () => {
    test('renders nothing cloud-related when client id is null', async ({ page }) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);

      // 1. No header sync icon
      await expect(page.locator('.mob-header-sync')).toHaveCount(0);
      await expect(page.locator('.cloud-sync-badge')).toHaveCount(0);

      // 2. No menu row
      await openMobileMenu(page);
      const menuItems = await page.locator('.mob-menu-item').allTextContents();
      expect(menuItems.some(item => item.includes('Cloud sync'))).toBe(false);

      // 3. No cloud banners
      await expect(page.locator('.mob-reconnect-banner')).toHaveCount(0);
      await expect(page.locator('.mob-conflict-banner')).toHaveCount(0);
      await expect(page.locator('.mob-hint-banner')).toHaveCount(0);
    });
  });

  test.describe('Mobile Cloud UI enabled', () => {
    test.beforeEach(async ({ page }) => {
      await forceMobileSkin(page);
    });

    test('header sync icon is visible, long press shows tooltip as Flash line, and tap opens dialog in MobilePaneDialog', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(cloudBaseUrl + '/');
      await openAMobileProject(page);

      const syncBadge = page.locator('.mob-header-sync');
      await expect(syncBadge).toBeVisible();

      // Take header screenshot at 390x844
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'cloud-sync-mobile-header.png'),
      });

      // Long press test: pointerdown for > 500ms
      await syncBadge.dispatchEvent('pointerdown');
      await new Promise(r => setTimeout(r, 600));
      await syncBadge.dispatchEvent('pointerup');

      const flash = page.locator('.flash');
      await expect(flash).toBeVisible();
      await expect(flash).toContainText('Google Drive');

      // Tap opens CloudSyncDialog inside MobilePaneDialog
      await syncBadge.click();
      const paneDlg = page.locator('.mob-dlg');
      await expect(paneDlg).toBeVisible();
      await expect(paneDlg.locator('.mob-dlg-title')).toHaveText('Cloud sync');
      await expect(paneDlg.locator('.cloud-sync-dialog')).toBeVisible();

      // Take open pane screenshot at 390x844
      await page.screenshot({
        path: join(SCREENSHOT_DIR, 'cloud-sync-mobile-pane.png'),
      });

      // Close footer button works
      const closeBtn = paneDlg.locator('.mob-dlg-footer').getByRole('button', { name: 'Close' });
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(paneDlg).toHaveCount(0);
    });

    test('menu row "Cloud sync" opens the Cloud sync pane', async ({ page }) => {
      await page.goto(cloudBaseUrl + '/');
      await openAMobileProject(page);

      await openMobileMenu(page);
      const menuRow = page.locator('.mob-menu-item', { hasText: 'Cloud sync' });
      await expect(menuRow).toBeVisible();
      await menuRow.click();

      // Drawer closes, pane opens
      await expect(page.locator('.mob-menu')).toHaveCount(0);
      const paneDlg = page.locator('.mob-dlg');
      await expect(paneDlg).toBeVisible();
      await expect(paneDlg.locator('.mob-dlg-title')).toHaveText('Cloud sync');
      await expect(paneDlg.locator('.cloud-sync-dialog')).toBeVisible();
    });

    test('reconnect banner and update banner never both show at 320x568 and 390x844', async ({ page }) => {
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);

        // Seed reconnect status and new build info
        await page.addInitScript(() => {
          localStorage.setItem('openisd_cloud_auth', JSON.stringify({
            kind: 'reconnect',
            account: 'john@gmail.com',
          }));
        });

        await page.route('**/build-info.json', route => {
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ version: 'v99999999T9999Z' }),
          });
        });

        await page.goto(cloudBaseUrl + '/');
        await openAMobileProject(page);

        // When update banner is shown, reconnect banner MUST NOT show
        const updateBanner = page.locator('.mob-update-banner').filter({ hasText: 'A new version of OpenISD is available.' });
        await expect(updateBanner).toBeVisible();
        await expect(page.locator('.mob-reconnect-banner')).toHaveCount(0);

        // Dismiss update banner -> reconnect banner appears
        await updateBanner.locator('.mob-update-later').click();
        await expect(updateBanner).toHaveCount(0);

        const reconnectBanner = page.locator('.mob-reconnect-banner');
        await expect(reconnectBanner).toBeVisible();
        await expect(reconnectBanner.locator('.mob-update-reload')).toHaveText('Reconnect');

        // Clean up routes and storage for next viewport
        await page.unroute('**/build-info.json');
        await page.evaluate(() => {
          localStorage.removeItem('openisd_cloud_auth');
          sessionStorage.clear();
        });
      }
    });

    test('conflict notice shows when there are unseen conflicts and opens dialog', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('openisd_storage_layout', '2');
        localStorage.setItem('openisd_cloud_auth', JSON.stringify({
          kind: 'token',
          account: 'john@gmail.com',
          accessToken: 'ya29.valid-token',
          expiresAt_ms: Date.now() + 3600_000,
        }));
        localStorage.setItem('openisd_cloud_state', JSON.stringify({
          rows: [],
          cursor: '100',
          conflicts: [{
            id: { kind: 'project', text: 'conf-1' },
            name: 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)',
            from: 'phone',
            at_ms: Date.now(),
          }],
          deviceId: 'dev-1',
          maxSeq: 1,
        }));
        localStorage.setItem('openisd_cloud_ui', JSON.stringify({
          launches: 1,
          hintDismissed: false,
          conflictsSeen: 0,
        }));
      });

      await page.route('https://www.googleapis.com/**', route => {
        const url = route.request().url();
        if (url.includes('/about')) {
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ user: { emailAddress: 'john@gmail.com' } }),
          });
        } else if (url.includes('/changes/startPageToken')) {
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ startPageToken: '100' }),
          });
        } else if (url.includes('/changes')) {
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ kind: 'drive#changeList', newStartPageToken: '100', changes: [] }),
          });
        } else if (url.includes('/files')) {
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ kind: 'drive#fileList', files: [] }),
          });
        } else {
          void route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
      });

      await page.goto(cloudBaseUrl + '/');
      await openAMobileProject(page);

      const conflictBanner = page.locator('.mob-conflict-banner');
      await expect(conflictBanner).toBeVisible();
      await expect(conflictBanner).toContainText('1 item changed on two devices. Both kept.');

      // Click "View"
      await conflictBanner.locator('.mob-update-reload').click();

      // Dialog opens showing the conflict copy
      const paneDlg = page.locator('.mob-dlg');
      await expect(paneDlg).toBeVisible();
      await expect(paneDlg.locator('.cloud-sync-conflict-row')).toHaveCount(1);
      await expect(paneDlg.locator('.cloud-sync-conflict-title')).toContainText('Sub 12');
    });

    test('dialog layout at 320x568 and 390x844: no horizontal overflow and every button above Close footer', async ({ page }) => {
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.goto(cloudBaseUrl + '/');
        await openAMobileProject(page);

        // Open dialog
        await page.locator('.mob-header-sync').click();
        const paneDlg = page.locator('.mob-dlg');
        await expect(paneDlg).toBeVisible();

        // Check horizontal overflow
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false);

        // Check all buttons in dialog are above Close footer
        const areButtonsAbove = await page.evaluate(() => {
          const footer = document.querySelector('.mob-dlg-footer');
          if (!footer) return false;
          const footerTop = footer.getBoundingClientRect().top;
          const buttons = Array.from(document.querySelectorAll('.mob-cloud-dialog-body button'));
          if (buttons.length === 0) return false;
          return buttons.every(b => b.getBoundingClientRect().bottom <= footerTop + 2);
        });
        expect(areButtonsAbove).toBe(true);

        // Close dialog
        await page.locator('.mob-dlg-footer').getByRole('button', { name: 'Close' }).click();
      }
    });
  });
});
