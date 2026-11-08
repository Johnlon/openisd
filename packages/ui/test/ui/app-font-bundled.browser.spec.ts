/**
 * The app carries its own fonts and draws every skin in its own one (John, QO466, T742): desktop in Selawik,
 * phone in Roboto, fixed-width text in the mono face; all from our own origin, none a device default.
 * Every text element and form control, on every tab and in the Driver Editor and Options dialogs, computes
 * to exactly its skin's family, and that family is loaded.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {SkinFonts} from '../../../design/fields/appFonts.js';
import type {Page} from '@playwright/test';

/** Every rendered text element and form control whose computed family is not exactly one of `allowed`. */
async function notInFamily(page: Page, allowed: readonly string[]): Promise<string[]> {
  return page.evaluate(families => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (!(node instanceof Element)) continue;
      const control = /^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(node.tagName);
      const hasText = Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '');
      if (!control && !hasText) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const family = getComputedStyle(node).fontFamily.replace(/"/g, '');
      if (!families.includes(family)) out.push(`<${node.tagName.toLowerCase()} class="${node.getAttribute('class') ?? ''}"> ${family}`);
    }
    return Array.from(new Set(out));
  }, [...allowed]);
}

async function loadedFamilies(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(new Set(Array.from(document.fonts).filter(face => face.status === 'loaded').map(face => face.family.replace(/"/g, ''))));
  });
}

async function fontFilesFromOurOrigin(page: Page): Promise<string[]> {
  return page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /\.woff2?(\?|$)/.test(name)).map(name => new URL(name).origin));
}

const DESKTOP_ALLOWED = [SkinFonts.DESKTOP.family, SkinFonts.MONO.family];
const PHONE_ALLOWED = [SkinFonts.PHONE.family, SkinFonts.MONO.family];

test.describe('desktop skin 1366x768', () => {
  test.use({viewport: {width: 1366, height: 768}});

  test('every tab, the Driver Editor and Options draw in Selawik, loaded from our origin', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    const faults: string[] = [];
    const tabs = await page.locator('.project-nav li').allInnerTexts();
    for (const tab of tabs.map(t => t.trim()).filter(t => t !== '')) {
      await page.locator('.project-nav li').filter({hasText: new RegExp(`^${tab}$`)}).click();
      faults.push(...(await notInFamily(page, DESKTOP_ALLOWED)).map(f => `${tab}: ${f}`));
    }
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await page.locator('.driver-id-row').getByRole('button', {name: 'Edit'}).click();
    await expect(page.locator('.de-modal')).toBeVisible();
    for (const tab of await page.locator('.de-tab').allInnerTexts()) {
      await page.locator('.de-tab').filter({hasText: new RegExp(`^${tab.trim()}$`)}).click();
      faults.push(...(await notInFamily(page, DESKTOP_ALLOWED)).map(f => `Driver Editor ${tab}: ${f}`));
    }
    await page.locator('.de-modal').getByRole('button', {name: /^(Cancel|Close)$/}).first().click();
    await page.locator('.tb-btn[title="Options"]').click();
    await expect(page.locator('.opt-modal')).toBeVisible();
    for (const tab of await page.locator('.opt-tab').allInnerTexts()) {
      await page.locator('.opt-tab').filter({hasText: new RegExp(`^${tab.trim()}$`)}).click();
      faults.push(...(await notInFamily(page, DESKTOP_ALLOWED)).map(f => `Options ${tab}: ${f}`));
    }
    expect(faults).toEqual([]);
    expect(await loadedFamilies(page)).toContain(SkinFonts.DESKTOP.family);
    const origin = new URL(page.url()).origin;
    expect(new Set(await fontFilesFromOurOrigin(page))).toEqual(new Set([origin]));
  });
});

test.describe('phone skin 374x705', () => {
  test.use({viewport: {width: 374, height: 705}});

  test('every tab and the Driver Editor draw in Roboto, loaded from our origin', async ({page}) => {
    await page.goto('/');
    await openAMobileProject(page);
    const faults: string[] = [];
    const tabs = await page.locator('.mob-tab').allInnerTexts();
    for (const tab of tabs.map(t => t.trim()).filter(t => t !== '')) {
      await page.locator('.mob-tab').filter({hasText: tab}).first().click();
      faults.push(...(await notInFamily(page, PHONE_ALLOWED)).map(f => `${tab}: ${f}`));
    }
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.getByRole('button', {name: 'Edit', exact: true}).click();
    await expect(page.locator('.de-body')).toBeVisible();
    for (const tab of await page.locator('.de-tab').allInnerTexts()) {
      await page.locator('.de-tab').filter({hasText: new RegExp(`^${tab.trim()}$`)}).click();
      faults.push(...(await notInFamily(page, PHONE_ALLOWED)).map(f => `Driver Editor ${tab}: ${f}`));
    }
    expect(faults).toEqual([]);
    expect(await loadedFamilies(page)).toContain(SkinFonts.PHONE.family);
    const origin = new URL(page.url()).origin;
    expect(new Set(await fontFilesFromOurOrigin(page))).toEqual(new Set([origin]));
  });
});
