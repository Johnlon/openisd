/**
 * The Options dialog's "Backup" section — download everything in this browser as one JSON
 * file, and restore from one. The repo's own export/import logic (shape, replace-not-merge
 * semantics) is covered once in `packages/persistence/test/backupRepo.test.ts`; this spec
 * proves the UI is wired to it — the download fires, and a chosen file reaches
 * `DesignIO.importBackup` and reloads the page.
 */
import {expect, test} from '../fixtures.js';

async function openOptions(page: import('playwright').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
  await page.locator('.tb-btn[title="Options"]').click();
  await expect(page.locator('.opt-modal')).toBeVisible();
}

test('the Backup section downloads a JSON snapshot of this browser\'s storage', async ({ page }) => {
  await openOptions(page);
  const legend = page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) });
  await expect(legend).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    legend.locator('button', { hasText: 'Download backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^openisd-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const text = await (await download.createReadStream()).toArray().then(a => Buffer.concat(a).toString());
  const parsed: unknown = JSON.parse(text);
  expect(parsed).toMatchObject({ openisdBackup: true });
});

test('restoring a backup asks for confirmation, then reloads the page', async ({ page }) => {
  await openOptions(page);
  const legend = page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) });

  // Confirm, then the post-restore reload notice — both native dialogs this flow raises.
  // `reloaded` is the real finish line: the page's own 'load' only fires again once
  // window.location.reload() actually runs, which is the last thing the success path does —
  // waiting on it (not just the two dialogs) is what proves the reload happened at all.
  let confirmSeen = false;
  let alertSeen = false;
  let reloaded = false;
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') { confirmSeen = true; await dialog.accept(); return; }
    alertSeen = true;
    await dialog.accept();
  });
  page.on('load', () => { reloaded = true; });

  const backupJson = JSON.stringify({
    openisdBackup: true, schemaVersion: 1, exportedAt: new Date().toISOString(),
    data: {},
  });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await legend.locator('button', { hasText: 'Restore from file' }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles({ name: 'openisd-backup-test.json', mimeType: 'application/json', buffer: Buffer.from(backupJson) });

  await expect.poll(() => reloaded).toBe(true);
  expect(confirmSeen).toBe(true);
  expect(alertSeen).toBe(true);
});

test('restoring an invalid file reports the error and does not reload', async ({ page }) => {
  await openOptions(page);
  const legend = page.locator('.opt-group', { has: page.locator('legend', { hasText: 'Backup' }) });

  let sawInvalidAlert = false;
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') { await dialog.accept(); return; }
    if (dialog.message().includes('Could not restore')) sawInvalidAlert = true;
    await dialog.accept();
  });

  const fileChooserPromise = page.waitForEvent('filechooser');
  await legend.locator('button', { hasText: 'Restore from file' }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles({ name: 'not-a-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') });

  await expect.poll(() => sawInvalidAlert).toBe(true);
  // The dialog is still open — a failed restore did not navigate away.
  await expect(page.locator('.opt-modal')).toBeVisible();
});
