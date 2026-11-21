/**
 * T744, John (16 Nov 2026): "Clipping is a bug: fix it, don't ask". The driver editor's help overview ("Blue dot" is its next-to-last
 * paragraph) was cut off at the bottom of the dialog. The dialog keeps its size ("dlg changing size for a workflow is anti pattern"),
 * and the help sheet keeps 680 px and scrolls (John, 21 Nov 2026: "big text dialogues can scroll if needed, better than losing good
 * explanations"), so every help sheet must lie inside the editor and scroll to its last paragraph.
 */
import {expect, openAProject, test} from '../fixtures.js';
import {DESKTOP_SURFACES, DesktopRoute, type DesktopSurface} from '../fixtures/desktopSurfaceManifest.js';
import {openDesktopSurface} from '../fixtures/desktopSurfaceNavigation.js';
import type {Locator, Page} from '@playwright/test';

async function openHelp(page: Page, surface: DesktopSurface): Promise<Locator> {
  await page.goto('/');
  await openAProject(page);
  await openDesktopSurface(page, surface);
  const sheet = page.locator('.de-desktop .mob-help-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

async function expectSheetInsideEditor(sheet: Locator): Promise<void> {
  const {width, top, right, bottom, left} = await sheet.evaluate(el => {
    const bounds = el.getBoundingClientRect();
    const editor = el.closest('.de-modal')!.getBoundingClientRect();
    return {
      width: bounds.width,
      top: bounds.top - editor.top,
      right: editor.right - bounds.right,
      bottom: editor.bottom - bounds.bottom,
      left: bounds.left - editor.left,
    };
  });
  expect(width).toBeLessThanOrEqual(680);
  expect(top, 'space above the sheet inside the editor').toBeGreaterThanOrEqual(0);
  expect(right, 'space right of the sheet inside the editor').toBeGreaterThanOrEqual(0);
  expect(bottom, 'space below the sheet inside the editor').toBeGreaterThanOrEqual(0);
  expect(left, 'space left of the sheet inside the editor').toBeGreaterThanOrEqual(0);
  await expect(sheet).toBeInViewport({ratio: 1});
}

async function expectLastParagraphAtEnd(sheet: Locator): Promise<number> {
  const scrollHeight = await sheet.evaluate(el => el.scrollHeight);
  await sheet.hover();
  await sheet.page().mouse.wheel(0, scrollHeight);
  await expect.poll(() => sheet.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
  await expect(sheet.locator('.mob-help-row').last()).toBeInViewport({ratio: 1});
  return sheet.evaluate(el => el.scrollTop);
}

const helpSurfaces = DESKTOP_SURFACES.filter(surface => surface.route === DesktopRoute.EditorHelp);
const overview = helpSurfaces.find(surface => surface.id === 'desktop/driver/editor/help/overview')!;
const thieleSmall = helpSurfaces.find(surface => surface.id === 'desktop/driver/editor/help/thiele-small')!;

for (const surface of helpSurfaces) {
  test(`${surface.title} fits the desktop editor and its last paragraph is reachable`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 720});
    const sheet = await openHelp(page, surface);
    await expectSheetInsideEditor(sheet);
    const scrollTop = await expectLastParagraphAtEnd(sheet);
    if (surface === overview) expect(scrollTop).toBeGreaterThan(0);
  });
}

test('help that fits is fully visible without scrolling in a large desktop window', async ({page}) => {
  await page.setViewportSize({width: 1880, height: 1000});
  const sheet = await openHelp(page, thieleSmall);
  const [scrollHeight, clientHeight] = await sheet.evaluate(el => [el.scrollHeight, el.clientHeight]);
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
  await expect(sheet.locator('.mob-help-row').last()).toBeInViewport({ratio: 1});
});

// The overview retains its full text at the restored width, so it can need scrolling even in a large window.
for (const {width, height} of [{width: 1880, height: 1000}, {width: 1280, height: 560}, {width: 1280, height: 480}]) {
  test(`the overview scrolls to Other fields inside the editor at ${width} × ${height}`, async ({page}) => {
    await page.setViewportSize({width, height});
    const sheet = await openHelp(page, overview);
    await expectSheetInsideEditor(sheet);
    await expect(sheet.locator('.mob-help-row').last()).toContainText('Other fields:');
    expect(await expectLastParagraphAtEnd(sheet)).toBeGreaterThan(0);
  });
}
