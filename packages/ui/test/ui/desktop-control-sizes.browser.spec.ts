import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {DesktopSizes} from '@openisd/design/fields';

/**
 * The desktop ▲▼ buttons and footer buttons are one size on every screen: the New project wizard, the
 * Box tab and Options. The sizes come from `DesktopSizes`; this spec measures what is on screen.
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
  // The signal generator's compact field (T607) deliberately uses 11 px arrows; every other pair is the standard size.
  const boxTab = await sizesOf(page, '.ui-field:not(.signal-gen-field) .num-stepper-btn');
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
  expect([...all], `Box tab ${boxTab[0]}, wizard ${wizard[0]}`).toEqual([`${DesktopSizes.STEPPER_W_PX}x${DesktopSizes.CONTROL_H_PX}`]);
  const input = await page.locator('#np-vented-volume').boundingBox();
  expect(Math.round(input?.height ?? 0), 'the arrows are as tall as the number box').toBe(DesktopSizes.CONTROL_H_PX);

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

for (const [box, tab] of [['bandpass6', '6th Order Bandpass'], ['abc', 'ABC']] as const) {
  test(`${tab} port controls use the shared desktop size and remain usable`, async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('#og-box-type').selectOption(box);
    await page.locator('.project-nav li', {hasText: new RegExp(`^${tab}$`)}).click();
    const pane = page.locator('.tab-section.active');
    const controls = pane.locator('.port-count-row select, .port-shape-toggle, .vent-port-row select:not([id])');
    const sizes = await controls.evaluateAll(elements => elements.map(element => ({
      height: Math.round(element.getBoundingClientRect().height),
      font: getComputedStyle(element).fontSize,
    })));
    expect(sizes).toHaveLength(box === 'abc' ? 9 : 6);
    expect(sizes.every(size => size.height === DesktopSizes.CONTROL_H_PX && size.font === `${DesktopSizes.CONTROL_FONT_PX}px`)).toBe(true);

    const count = pane.locator('.port-count-row select').first();
    await count.selectOption('2');
    await expect(count).toHaveValue('2');
    const correction = pane.locator('.vent-port-row select:not([id])').first();
    const correctionValue = await correction.locator('option').nth(1).getAttribute('value');
    expect(correctionValue).not.toBeNull();
    await correction.selectOption(correctionValue!);
    await expect(correction).toHaveValue(correctionValue!);
    for (const toggle of await pane.locator('.port-shape-toggle').all()) await toggle.click();
    expect(await pane.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
    expect(await pane.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
