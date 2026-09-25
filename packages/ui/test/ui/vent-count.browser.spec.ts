import {expect, openAProject, test} from '../fixtures.js';
import {PageOps} from '../fixtures/numField.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('select#og-box-type').selectOption('vented');
  await new PageOps(page).setNum('#og-fb-target', '40');
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
});

test('Number of Vents shows one port by default and offers the registry\'s 1..4', async ({ page }) => {
  const count = page.locator('select#vent-count');
  await expect(count).toHaveValue('1');
  await expect(count.locator('option')).toHaveCount(4);
});

test('picking two vents makes the solved port length longer than with one', async ({ page }) => {
  const length = page.locator('#og-vent-length-ro');
  await expect(length).not.toHaveValue(/^[—\s]*$/);
  const one = parseFloat(await length.inputValue());
  expect(one).toBeGreaterThan(0);

  await page.locator('select#vent-count').selectOption('2');
  await expect.poll(async () => parseFloat(await length.inputValue())).toBeGreaterThan(one);
});
