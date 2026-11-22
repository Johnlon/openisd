import {expect, openAProject, test} from '../fixtures.js';

const TABS = ['General', 'Parameters', 'Advanced', 'Dimensions'];
const SIZES = [
  {width: 1366, height: 900},
  {width: 1920, height: 1080},
];

for (const size of SIZES) for (const tab of TABS) {
  test(`driver editor ${tab} labels never wrap at ${size.width}x${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: 'Driver'}).click();
    await page.locator('.driver-id-row').getByRole('button', {name: 'Edit'}).click();
    await expect(page.locator('.de-modal')).toBeVisible();
    await page.getByRole('button', {name: tab, exact: true}).click();

    const wrapped = await page.evaluate(() => {
      const bad: string[] = [];
      for (const label of document.querySelectorAll<HTMLElement>('.de-fld label, .de-dimlist label')) {
        if (label.getClientRects().length === 0) continue;
        const lineHeight = parseFloat(getComputedStyle(label).lineHeight) || label.getBoundingClientRect().height;
        const oneLine = label.scrollHeight <= Math.ceil(lineHeight) + 1;
        const fits = label.clientWidth >= label.scrollWidth;
        if (!oneLine || !fits) {
          bad.push(`${label.textContent} h=${label.scrollHeight}/${lineHeight} w=${label.clientWidth}/${label.scrollWidth}`);
        }
      }
      return bad;
    });
    expect(wrapped).toEqual([]);
  });
}
