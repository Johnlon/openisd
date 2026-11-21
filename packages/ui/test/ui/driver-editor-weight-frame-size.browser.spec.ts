import {expect, openAMobileProject, openAProject, openDriverEditor, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import type {Locator, Page} from '@playwright/test';

/**
 * #515 / T790: the driver editor's Dimensions view shows the driver's weight and its rectangular
 * frame size (OuterX, OuterY), on both skins. FaitalPRO 2FE22 (8 ohm) states weight 0.184 kg,
 * OuterX 0.088 m and OuterY 0.068 m in the bundled catalogue.
 */

async function pickCatalogueDriver(page: Page): Promise<void> {
  await page.locator('.filter').fill('2FE22');
  await page.locator('.dlist .ditem:not(.my-ditem)').filter({hasText: '2FE22'}).first().click();
  await page.locator('.use-btn').click();
  await expect(page.locator('.wb-modal')).toBeHidden();
}

/** What a user reads in the row with this label: the number and its unit. */
async function shown(row: Locator): Promise<{value: string; text: string}> {
  return {value: await row.locator('input').first().inputValue(), text: (await row.innerText()).replace(/\s+/g, ' ')};
}

test.describe('desktop', () => {
  test.use({viewport: {width: 1280, height: 800}});

  test('the Dimensions tab shows weight and frame size for a catalogue driver', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('[title*="librar" i]').first().click();
    await pickCatalogueDriver(page);
    await openDriverEditor(page);
    await page.getByRole('button', {name: 'Dimensions', exact: true}).click();

    const row = (key: string) => page.locator(`.de-dimlist .de-fld[data-field-key="${key}"]`);
    const weight = await shown(row('weight_kg'));
    expect(weight.text).toContain('Driver Weight');
    expect(weight.value).toBe('0.184');
    expect(weight.text).toContain('kg');
    const x = await shown(row('OuterX_m'));
    expect(x.text).toContain('Frame Size X (OuterX)');
    expect(x.value).toBe('88.00');
    expect(x.text).toContain('mm');
    const y = await shown(row('OuterY_m'));
    expect(y.text).toContain('Frame Size Y (OuterY)');
    expect(y.value).toBe('68.00');
  });
});

test.describe('phone', () => {
  test.use({viewport: PIXEL_9});

  test('the Dimensions tab shows weight and frame size for a catalogue driver', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.getByText('Select driver').click();
    await pickCatalogueDriver(page);
    await page.getByText('Edit', {exact: true}).click();
    await page.getByRole('button', {name: 'Dimensions', exact: true}).click();

    const row = (key: string) => page.locator(`.de-dimlist .de-fld[data-field-key="${key}"]`);
    const weight = await shown(row('weight_kg'));
    expect(weight.text).toContain('Weight');
    expect(weight.value).toBe('0.184');
    expect(weight.text).toContain('kg');
    const x = await shown(row('OuterX_m'));
    expect(x.text).toContain('OuterX');
    expect(x.value).toBe('88.00');
    const y = await shown(row('OuterY_m'));
    expect(y.text).toContain('OuterY');
    expect(y.value).toBe('68.00');
  });
});
