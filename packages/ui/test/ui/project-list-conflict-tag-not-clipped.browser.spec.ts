/**
 * The conflict tag of a kept copy in the desktop Projects list is readable whole (T899, John 18 Nov 2026: the tag
 * was cut at "conflict, 18 Nov 2026," because it neither wrapped nor shrank). The name beside it wraps; the tag wraps too.
 * Real sync over an emulated Drive, as the conflict-notice spec does.
 */
import {dirtyFocusedDesign, expect, openAProject, test} from '../fixtures.js';
import {connectedToDrive, iPhoneEdit} from './fixtures/driveConnected.js';

test('the conflict tag in the Projects list fits its box: none of its text is cut off', async ({page}) => {
  const drive = await connectedToDrive(page);
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();
  await expect.poll(() => drive.listFiles().filter(f => f.name.startsWith('project-')).length, {timeout: 20_000}).toBe(1);
  await dirtyFocusedDesign(page);
  drive.editAsDevice('project-', iPhoneEdit, 'iPhone');
  await page.locator('.cloud-sync-badge').click();
  await page.locator('.cloud-modal button', {hasText: 'Sync now'}).click();
  await page.locator('.cloud-modal-x').click();

  const tag = page.locator('.quad-topleft .project-tag-conflict');
  await expect(tag).toHaveCount(1);
  const m = await tag.evaluate(el => {
    const r = el.getBoundingClientRect();
    const list = el.closest('.project-row')!.getBoundingClientRect();
    return {sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, right: r.right, listRight: list.right, text: el.textContent};
  });
  expect(m.text).toContain('conflict, ');
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(m.sh).toBeLessThanOrEqual(m.ch);
  expect(m.right).toBeLessThanOrEqual(m.listRight);
});
