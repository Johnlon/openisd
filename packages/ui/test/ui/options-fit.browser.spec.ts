/** Options dialog: no unit or input pokes out past the edge of its group box (kg/m³ did, 14 Oct 2026). */
import {expect, openAProject, test} from '../fixtures.js';

test('every control and unit in the Options dialog stays inside its group box', async ({ appPage: page }) => {
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/');
  await openAProject(page);
  await page.getByTitle('Options', {exact: true}).click();
  const bad = await page.evaluate(() => {
    const body = document.querySelector('.opt-body')!;
    const fs = Array.from(body.querySelectorAll('fieldset'));
    return fs.flatMap(f => { const fr = f.getBoundingClientRect(); return Array.from(f.querySelectorAll('*')).filter(e => e.getBoundingClientRect().right > fr.right + 0.5 && e.getBoundingClientRect().width > 0).map(e => e.className + ':' + e.textContent?.slice(0, 12)); });
  });
  expect(bad).toEqual([]);
});
