/**
 * A stored project with a field the schema refuses loads anyway, with that field reset, and the
 * user is shown which field and offered the original (John, 2026-10-01: repair, never reset).
 * bugs/BUG_20261001_one-bad-field-refuses-a-whole-project.md
 */
import {expect, openAProject, test} from '../fixtures.js';
import {z} from 'zod';

/** The stored open-session record, as far as this test touches it. */
const OpenSessionRecord = z.looseObject({entries: z.array(z.looseObject({text: z.string()}))});

test('a reload over an open project with a bad field shows the repair and keeps the project', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  const name = await page.locator('.project-nav').first().textContent();

  // Break one field of the stored open project, the way an older or damaged record would be.
  const raw = await page.evaluate(() => localStorage.getItem('openisd_open_sessions'));
  expect(raw).not.toBeNull();
  const record = OpenSessionRecord.parse(JSON.parse(raw ?? ''));
  const text = record.entries[0].text;
  const broken = text.replace('"box": {', '"box": {"portVelocityLimit_m_per_s": "fast",');
  expect(broken).not.toBe(text);
  record.entries[0].text = broken;
  await page.evaluate(next => localStorage.setItem('openisd_open_sessions', next), JSON.stringify(record));
  await page.reload();

  const dialog = page.locator('.dg');
  await expect(dialog).toContainText('Saved projects were repaired');
  await expect(dialog).toContainText('saved.box.portVelocityLimit_m_per_s');
  await expect(dialog.getByRole('button', { name: 'Download the original' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.locator('.project-nav').first()).toHaveText(name ?? '');
});
