/**
 * T520 (John, 21 Oct 2026, live demo): the General tab's Comment box fills the tab.
 * The Dimensions tab's diagram stays full size (John withdrew "too big": it shows the driver's
 * dimensions); the guard here is that its labels are visible and nothing is clipped.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const dims = r('.de-dims');
    const svg = r('.de-diagram svg');
        const labelEls = [...document.querySelectorAll('.de-diagram svg text')];
    const labels = labelEls.length;
    const labelsOutside = labelEls.filter((t) => {
      const b = t.getBoundingClientRect();
      return b.left < svg.left - 1 || b.right > svg.right + 1 || b.top < svg.top - 1 || b.bottom > svg.bottom + 1;
    }).length;
    const clipped = [...document.querySelectorAll<HTMLElement>('.de-dimlist .de-fld')]
      .filter((f) => f.scrollWidth > f.clientWidth + 1).length;
    const basket=[document.querySelector('.de-diagram g[transform] > rect'),...[...document.querySelectorAll('.de-diagram g[transform] > g:first-of-type > path')].slice(0,2)].filter((node):node is Element=>node!==null).map(node=>{const css=getComputedStyle(node);return {stroke:css.stroke,width:css.strokeWidth,vector:css.vectorEffect};});
    return {basket,
      dimsW: dims.width, svgW: svg.width, svgH: svg.height, labels, labelsOutside,
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, clipped,
    };
  });
}

test.describe('desktop', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('the diagram shows its dimension labels and nothing is clipped', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await page.locator('.driver-id-row').getByRole('button', {name: 'Edit'}).click();
    await page.getByRole('button', {name: 'Dimensions', exact: true}).click();
    await expect(page.locator('.de-diagram svg')).toBeVisible();
    const m = await measure(page);
    console.log('DESKTOP', JSON.stringify(m));
    expect(m.basket).toHaveLength(3);
    for(const edge of m.basket)expect(edge).toEqual({stroke:'rgb(15, 23, 42)',width:'2.5px',vector:'non-scaling-stroke'});
    expect(m.labels).toBeGreaterThan(0);
    expect(m.labelsOutside).toBe(0);
    expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
    expect(m.clipped).toBe(0);
  });
});

test.describe('phone', () => {
  test.use({viewport: PIXEL_9});

  test('the diagram shows its dimension labels, nothing is clipped, no horizontal scroll', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.getByText('Edit', {exact: true}).click();
    await page.getByRole('button', {name: 'Dimensions', exact: true}).click();
    await expect(page.locator('.de-diagram svg')).toBeVisible();
    await page.locator('.de-diagram svg').scrollIntoViewIfNeeded();
    const m = await measure(page);
    console.log('PHONE', JSON.stringify(m));
    expect(m.basket).toHaveLength(3);
    for(const edge of m.basket)expect(edge).toEqual({stroke:'rgb(15, 23, 42)',width:'2.5px',vector:'non-scaling-stroke'});
    expect(m.labels).toBeGreaterThan(0);
    expect(m.labelsOutside).toBe(0);
    expect(m.clipped).toBe(0);
    expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
  });
});

/** T520 addition (John, 21 Oct 2026): the General tab's text areas fill the remaining height. */
async function measureGeneral(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    // Where the tab's content area ends: the phone scrolls body + strips together, so the tab ends
    // above the strips; on the desktop the body ends at its own padding.
    const body = document.querySelector('.de-body')!;
    const scroll = document.querySelector('.de-scroll')!;
    const strips = scroll.querySelector('.de-strips');
    const padding = parseFloat(getComputedStyle(body).paddingBottom);
    const bottom = strips
      ? Math.max(body.getBoundingClientRect().bottom, scroll.getBoundingClientRect().bottom - strips.getBoundingClientRect().height) - padding
      : body.getBoundingClientRect().bottom - padding;
    const areas = [...document.querySelectorAll('.de-general textarea')].map((t) => t.getBoundingClientRect());
    const last = areas[areas.length - 1]!;
    return {
      count: areas.length, areaH: last.height, areaBottom: last.bottom,
      gapToBodyBottom: bottom - last.bottom,
      modalScrolls: scroll.scrollHeight > scroll.clientHeight + 1,
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
    };
  });
}

test.describe('general tab text areas, desktop', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('the text areas reach the bottom of the tab without a scrollbar', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await page.locator('.driver-id-row').getByRole('button', {name: 'Edit'}).click();
    await page.getByRole('button', {name: 'General', exact: true}).click();
    await expect(page.locator('.de-general textarea').first()).toBeVisible();
    const m = await measureGeneral(page);
    console.log('GENERAL-DESKTOP', JSON.stringify(m));
    expect(m.gapToBodyBottom).toBeLessThanOrEqual(8);
    expect(m.modalScrolls).toBe(false);
  });
});

test.describe('general tab text areas, phone', () => {
  test.use({viewport: {width: 412, height: 1000}});

  test('the text areas reach the bottom of the tab, no scrollbar, no sideways scroll', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.getByText('Edit', {exact: true}).click();
    await page.getByRole('button', {name: 'General', exact: true}).click();
    await expect(page.locator('.de-general textarea').first()).toBeVisible();
    const m = await measureGeneral(page);
    console.log('GENERAL-PHONE', JSON.stringify(m));
    expect(m.gapToBodyBottom).toBeLessThanOrEqual(8);
    expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
  });
});
