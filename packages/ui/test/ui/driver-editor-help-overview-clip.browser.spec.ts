/**
 * T744, John (16 Nov 2026): "Clipping is a bug: fix it, don't ask". The driver editor's help overview ("Blue dot" is its next-to-last
 * paragraph) was cut off at the bottom of the dialog. The dialog keeps its size ("dlg changing size for a workflow is anti pattern"),
 * and the help sheet keeps 680 px and scrolls (John, 21 Nov 2026: "big text dialogues can scroll if needed, better than losing good
 * explanations"). Shown the overview cut off mid-sentence with no scrollbar, John (21 Nov 2026): "it's clipped". So every help sheet
 * lies inside the window (it may reach past the editor, which keeps its size), the overview fits whole in 1880 x 1000 and 1280 x 720, and
 * a sheet that must scroll says "More below" at its foot until its end is reached.
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

async function expectSheetInsideWindow(sheet: Locator): Promise<void> {
  const width = await sheet.evaluate(el => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(680);
  await expect(sheet).toBeInViewport({ratio: 1});
}

async function expectMoreBelowShown(sheet: Locator): Promise<void> {
  await expect(sheet.getByText('More below ▼')).toBeInViewport({ratio: 1});
}

async function expectLastParagraphAtEnd(sheet: Locator): Promise<number> {
  const scrollHeight = await sheet.evaluate(el => el.scrollHeight);
  await sheet.hover();
  await sheet.page().mouse.wheel(0, scrollHeight);
  await expect.poll(() => sheet.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
  await expect(sheet.locator('.mob-help-row').last()).toBeInViewport({ratio: 1});
  await expect(sheet.getByText('More below ▼')).toHaveCount(0);
  return sheet.evaluate(el => el.scrollTop);
}

const helpSurfaces = DESKTOP_SURFACES.filter(surface => surface.route === DesktopRoute.EditorHelp);
const overview = helpSurfaces.find(surface => surface.id === 'desktop/driver/editor/help/overview')!;
const thieleSmall = helpSurfaces.find(surface => surface.id === 'desktop/driver/editor/help/thiele-small')!;

for (const surface of helpSurfaces) {
  test(`${surface.title} fits the window and its last paragraph is reachable`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 720});
    const sheet = await openHelp(page, surface);
    await expectSheetInsideWindow(sheet);
    expect(await expectLastParagraphAtEnd(sheet)).toBeGreaterThanOrEqual(0);
  });
}

for (const {width, height} of [{width: 1880, height: 1000}, {width: 1280, height: 720}]) {
  test(`the whole overview shows without scrolling in a ${width} × ${height} window`, async ({page}) => {
    await page.setViewportSize({width, height});
    const sheet = await openHelp(page, overview);
    await expectSheetInsideWindow(sheet);
    const [scrollHeight, clientHeight] = await sheet.evaluate(el => [el.scrollHeight, el.clientHeight]);
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
    await expect(sheet.getByText('More below ▼')).toHaveCount(0);
    await expect(sheet.locator('.mob-help-row').last()).toContainText('Other fields:');
    await expect(sheet.locator('.mob-help-row').last()).toBeInViewport({ratio: 1});
  });
}

test('help that fits is fully visible without scrolling in a large desktop window', async ({page}) => {
  await page.setViewportSize({width: 1880, height: 1000});
  const sheet = await openHelp(page, thieleSmall);
  const [scrollHeight, clientHeight] = await sheet.evaluate(el => [el.scrollHeight, el.clientHeight]);
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
  await expect(sheet.locator('.mob-help-row').last()).toBeInViewport({ratio: 1});
});

// In a short window the overview still needs scrolling: it says More below and reaches Other fields.
for (const {width, height} of [{width: 1280, height: 560}, {width: 1280, height: 480}]) {
  test(`the overview says More below and scrolls to Other fields at ${width} × ${height}`, async ({page}) => {
    await page.setViewportSize({width, height});
    const sheet = await openHelp(page, overview);
    await expectSheetInsideWindow(sheet);
    await expectMoreBelowShown(sheet);
    await expect(sheet.locator('.mob-help-row').last()).toContainText('Other fields:');
    expect(await expectLastParagraphAtEnd(sheet)).toBeGreaterThan(0);
  });
}
