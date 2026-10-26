import {expect, test} from '../fixtures.js';
import {ANNOUNCEMENTS_URL} from '../../src/logic/announcementCenter.js';

const first = {
  id: 'test-announcement-1', version: '7.0.957', published: '2026-10-26',
  title: 'Mobile controls and driver library fixes', summary: 'The fields are more consistent.',
  body: ['Alignment units are part of the control.'], href: 'https://openisd.app/',
};
const later = {...first, id: 'test-announcement-2', version: '7.0.958', published: '2026-10-27', title: 'A later announcement'};

async function feed(page: import('@playwright/test').Page, items: readonly object[]): Promise<void> {
  await page.route(ANNOUNCEMENTS_URL, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {'Cache-Control': 'no-store'},
    body: JSON.stringify({version: 1, announcements: items}),
  }));
}

async function start(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, skinOverride: 'desktop'}})));
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('announcements can be dismissed by version and the full list stays reviewable', async ({appPage: page}) => {
  await feed(page, [first]);
  await start(page);
  await expect(page.getByRole('heading', {name: 'Mobile controls and driver library fixes'})).toBeVisible();
  await page.getByRole('button', {name: 'All announcements'}).click();
  await expect(page.getByRole('heading', {name: 'OpenISD announcements'})).toBeVisible();
  await expect(page.getByText('All announcements remain here after you dismiss them.')).toBeVisible();
  await page.getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Dismiss the version explicitly; it stays dismissed across reloads.
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', {name: 'Dismiss'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A new stable ID opens even when the previous announcement was dismissed.
  await page.unroute(ANNOUNCEMENTS_URL);
  await feed(page, [later, first]);
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'A later announcement'})).toBeVisible();
  await page.getByRole('button', {name: 'Dismiss'}).click();
  await page.evaluate(() => localStorage.removeItem('openisd_announcements_dismissed_v1'));
});
