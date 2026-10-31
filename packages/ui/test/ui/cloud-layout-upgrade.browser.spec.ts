/**
 * A browser already synced with Drive at storage layout 2 loads the layout-3 app: its projects
 * upgrade in place. Sync makes no conflict copy of any project, on Drive or in the browser.
 * The layout-2 store and Drive file are seeded the way the older build left them (the golden
 * layout-2 dump); real sync and Drive client run over an emulated Drive.
 * bugs/BUG_20261031_layout-upgrade-makes-conflict-copies.md
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect, test} from '../fixtures.js';
import {emulateDriveServer} from './fixtures/driveConnected.js';
import {enableCloudSync} from './fixtures/cloudSyncStubs.js';

const GOLDEN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'persistence', 'test', 'goldens', 'one-project', 'dump-layout-2.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The text sync hashes: the JSON with its keys sorted, as the app's own body hash reads it. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** The one saved project the older build stored: its entry id and its stored text. */
function layoutTwoProject(): {readonly id: string; readonly text: string; readonly bucket: string; readonly state: string} {
  const dump: unknown = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  if (!isRecord(dump) || typeof dump['openisd_projects'] !== 'string' || typeof dump['openisd_state'] !== 'string') throw new Error('golden dump is not a store dump');
  const bucket: unknown = JSON.parse(dump['openisd_projects']);
  const entries: unknown = isRecord(bucket) ? bucket['entries'] : null;
  const entry: unknown = Array.isArray(entries) ? entries[0] : null;
  if (!isRecord(entry) || typeof entry['id'] !== 'string' || typeof entry['text'] !== 'string') throw new Error('golden dump has no project');
  return {id: entry['id'], text: entry['text'], bucket: dump['openisd_projects'], state: dump['openisd_state']};
}

test('a layout-2 store synced with Drive upgrades to layout 3 without a conflict copy', async ({page}) => {
  const {id, text, bucket, state} = layoutTwoProject();
  const hash = createHash('sha256').update(canonical(JSON.parse(text))).digest('hex');
  const drive = await emulateDriveServer(page);
  drive.seed(`project-${id}.owpr`, {app: 'openisd', kind: 'project', uuid: id, layout: '2', seq: '1', writer: 'dev-laptop', device: 'Linux desktop', hash}, text);
  await enableCloudSync(page);
  const ledger = JSON.stringify({
    rows: [{id: {kind: 'project', uuid: id}, fileId: 'file-1', revision: 'rev-1', hash, seq: 1}],
    cursor: '2',
    conflicts: [{id: {kind: 'project', text: 'earlier-copy'}, name: 'Beta (conflict, 12 Oct 2026, iPhone)', item: 'Beta', otherDevice: 'iPhone', from: 'dev-phone', at_ms: 1_760_000_000_000}],
    deviceId: 'dev-laptop', maxSeq: 1,
  });
  await page.addInitScript(([projects, autosave, ledgerText]: readonly [string, string, string]) => {
    if (localStorage.getItem('openisd_storage_layout') !== null) return;
    localStorage.setItem('openisd_storage_layout', '2');
    localStorage.setItem('openisd_projects', projects);
    localStorage.setItem('openisd_state', autosave);
    localStorage.setItem('openisd_cloud_state', ledgerText);
    localStorage.setItem('openisd_cloud_auth', JSON.stringify({
      kind: 'token', accessToken: 'ya29.stubbed_test_token', expiresAt_ms: Date.now() + 3_600_000, account: 'john@gmail.com',
    }));
  }, [bucket, state, ledger] as const);

  await page.goto('/');
  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await expect(page.locator('.cloud-modal')).toContainText('Synced');

  // The upgraded project replaces the older one on Drive, in the same file.
  await expect.poll(() => drive.listFiles().map(f => `${f.name} layout ${f.appProperties['layout']}`)).toEqual([`project-${id}.owpr layout 3`]);
  // The conflict notice from before the upgrade is still there, and no new copy was made.
  await expect(page.locator('.cloud-modal .cloud-sync-conflict-row')).toHaveCount(1);
  await expect(page.locator('.cloud-modal .cloud-sync-conflict-row')).toContainText('Beta (conflict, 12 Oct 2026, iPhone)');
  await expect(page.locator('.cloud-modal')).not.toContainText('Alpha (conflict');
  const stored = await page.evaluate(() => localStorage.getItem('openisd_projects'));
  expect(stored).not.toBeNull();
  expect(stored).not.toContain('conflict');
});
