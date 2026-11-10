/**
 * T770 (John, 10 Nov 2026, QO526; field-layout rule 2: nothing is cut). The phone Box tab's "Box type"
 * dropdown shows the chosen type's whole name at 374 x 705, for every box type.
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const BOX_TYPES = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'] as const;

for (const boxType of BOX_TYPES) {
  test(`the Box type dropdown shows its whole text for ${boxType}`, async ({page}) => {
    await forceMobileSkin(page);
    await page.setViewportSize({width: PIXEL_9.width, height: PIXEL_9.height});
    await page.goto('/');
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    const select = page.locator('#mob-box-type');
    await select.selectOption(boxType);
    // The text width of the chosen option, drawn in the select's own font, against the room the select leaves for it.
    const cut = await select.evaluate((el: HTMLSelectElement) => {
      const style = getComputedStyle(el);
      const canvas = document.createElement('canvas').getContext('2d');
      if (canvas === null) throw new Error('no canvas');
      canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = el.selectedOptions[0]?.textContent?.trim() ?? '';
      const ARROW_PX = 20; // the dropdown arrow takes the right end of the box
      const room = el.clientWidth - parseFloat(style.paddingLeft) - ARROW_PX;
      return {text, need: canvas.measureText(text).width, room};
    });
    expect(cut.need, `"${cut.text}" needs ${cut.need}px, the dropdown has ${cut.room}px`).toBeLessThanOrEqual(cut.room);
  });
}
