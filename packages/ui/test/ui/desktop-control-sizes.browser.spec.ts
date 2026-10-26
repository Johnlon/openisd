import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {DesktopSizes} from '@openisd/design/fields';

/**
 * The desktop ▲▼ buttons (the phone's classic pair, T595) and footer buttons are one size on every screen: the New project wizard, the
 * Box tab and Options. The sizes come from `DesktopSizes`; this spec measures what is on screen.
 * (John, 17 Oct 2026: "the buttons are tiny on desktop and completely inconsistent".)
 */

const TEST_DRIVER = 'Tang Band W5-1138SMF';

async function sizesOf(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll(els => els.filter(el => el.checkVisibility()).map(el => {
    const b = el.getBoundingClientRect();
    return `${Math.round(b.width)}x${Math.round(b.height)}`;
  }));
}

/** Every shown ▲ and ▼ is what a click at its centre would hit: none is clipped or covered. */
async function coveredArrows(page: Page, scope: string): Promise<number> {
  return page.locator(`${scope} .num-stepper-btn`).evaluateAll(els => els.filter(el => el.checkVisibility({visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true})).filter(el => {
    const b = el.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return hit !== el;
  }).length);
}

test('the ▲▼ pair is one size on the wizard and the Box tab (Options joins when its boxes move to the standard control, T367), and as tall as a number box', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const boxTab = await sizesOf(page, '.num-stepper-btn');
  expect(await coveredArrows(page, 'body'), 'Box tab arrows clipped or covered').toBe(0);
  expect(boxTab.length, 'the Box tab has arrows').toBeGreaterThan(0);

  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  const next = modal.locator('.modal-footer').getByText('Next', {exact: true});
  await modal.getByText(TEST_DRIVER).first().click();
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption('vented');
  await next.click();
  const wizard = await sizesOf(page, '.overlay.open .num-stepper-btn');
  expect(await coveredArrows(page, '.overlay.open'), 'wizard arrows clipped or covered').toBe(0);

  const all = new Set([...boxTab, ...wizard]);
  // T595: the pair is the phone's classic ▲▼ (40 x 36) beside the phone's 34 px box.
  expect([...all], `Box tab ${boxTab[0]}, wizard ${wizard[0]}`).toEqual(['40x36']);
  const input = await page.locator('#np-vented-volume').boundingBox();
  expect(Math.round(input?.height ?? 0), 'the number box is the phone box height').toBe(34);

  const footer = await sizesOf(page, '.overlay.open .footer-buttons button');
  expect(footer, 'the wizard has Back, Next, Cancel').toHaveLength(3);
  expect(new Set(footer).size, `wizard footer: ${footer.join(', ')}`).toBe(1);
  expect(footer[0]?.split('x')[1], 'footer buttons have the DesktopSizes height').toBe(String(DesktopSizes.FOOTER_BTN_H_PX));
  expect(Number(footer[0]?.split('x')[0]), 'footer buttons are at least the DesktopSizes width').toBeGreaterThanOrEqual(DesktopSizes.FOOTER_BTN_W_PX);
  await modal.getByRole('button', {name: 'Cancel', exact: true}).click();

  await page.locator('.tb-btn[title^="Options"]').click();
  const optFooter = await sizesOf(page, '.opt-footer button');
  expect(optFooter, 'Options has Defaults, OK, Cancel').toHaveLength(3);
  expect(new Set(optFooter).size, `Options footer: ${optFooter.join(', ')}`).toBe(1);
  expect(optFooter[0]?.split('x')[1]).toBe(String(DesktopSizes.FOOTER_BTN_H_PX));
});
