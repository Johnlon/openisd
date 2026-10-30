import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * The driver filter row (Fs, Sd, Z) wraps only between its groups: a group's label, boxes, unit
 * or chips always share one line (John, 16 Oct 2026: "Z" ended one line and the 4Ω/8Ω/16Ω chips
 * began the next).
 */
for (const width of [360, 390]) {
  test(`mobile New project step 1: each filter group stays on one line at ${width} px`, async ({page}) => {
    await page.setViewportSize({width, height: 800});
    await forceMobileSkin(page);
    await page.goto('/');
    await page.getByText('New project').click();
    await page.locator('.mob-np-body .dl-filters-toggle').click();
    await expect(page.locator('.mob-np-body .param-row')).toBeVisible();
    const groups = page.locator('.mob-np-body .param-row .pgroup');
    await expect(groups).toHaveCount(3);
    const tops = await groups.evaluateAll(nodes => nodes.map(group => {
      const parts = [...group.children].map(child => Math.round(child.getBoundingClientRect().top + child.getBoundingClientRect().height / 2));
      return {spread: Math.max(...parts) - Math.min(...parts), right: group.getBoundingClientRect().right};
    }));
    for (const group of tops) {
      expect(group.spread).toBeLessThanOrEqual(4);
      expect(group.right).toBeLessThanOrEqual(width);
    }
  });
}
