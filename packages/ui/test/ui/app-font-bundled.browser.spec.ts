/**
 * The app carries its own Inter (John, QO466, T742): every label is measured in the font users see,
 * served from our own origin, latin subset only, and precached so it works offline.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

test('labels render in the bundled Inter, loaded from our own origin', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(async () => {
    await document.fonts.load('13px Inter');
    const label = document.querySelector('label');
    const faces = Array.from(document.fonts).filter(face => face.family.replace(/"/g, '') === 'Inter');
    const fontFiles = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /inter.*\.woff2?(\?|$)/.test(name));
    return {
      checks: document.fonts.check('13px Inter'),
      labelStack: label === null ? '' : getComputedStyle(label).fontFamily,
      loadedFaces: faces.filter(face => face.status === 'loaded').length,
      fontFiles: fontFiles.map(name => new URL(name).origin + ' ' + new URL(name).pathname.split('/').pop()),
    };
  });
  expect(result.checks).toBe(true);
  expect(result.labelStack.replace(/"/g, '')).toBe('Inter');
  expect(result.loadedFaces).toBeGreaterThan(0);
  const origin = new URL(page.url()).origin;
  expect(result.fontFiles.length).toBeGreaterThan(0);
  for (const file of result.fontFiles) {
    expect(file).toMatch(new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} inter-latin-(400|600|700)-normal(-[A-Za-z0-9_-]+)?\\.woff2$`));
  }
});

/** Every rendered text element and form control, with a computed family other than exactly Inter. */
async function notInter(page: Page): Promise<string[]> {
  return page.evaluate(() => {
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
      if (family !== 'Inter') out.push(`<${node.tagName.toLowerCase()} class="${node.getAttribute('class') ?? ''}"> ${family}`);
    }
    return Array.from(new Set(out));
  });
}

const SCREENS = [
  {width: 1366, height: 768, open: openAProject},
  {width: 374, height: 705, open: openAMobileProject},
];

for (const size of SCREENS) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({viewport: {width: size.width, height: size.height}});

    test('every text element and form control computes to exactly Inter, and Inter is loaded', async ({page}) => {
      await page.goto('/');
      await size.open(page);
      await page.evaluate(() => document.fonts.load('13px Inter'));
      expect(await notInter(page)).toEqual([]);
      const loaded = await page.evaluate(() => Array.from(document.fonts).filter(face => face.family.replace(/"/g, '') === 'Inter' && face.status === 'loaded').map(face => face.weight));
      expect(loaded.length).toBeGreaterThan(0);
    });
  });
}
