import {expect, test} from '../fixtures.js';
import {auditScreen, type AuditMode} from '../fixtures/screenSizeAudit.js';
import {measureWholeScreen} from '../fixtures/wholeScreenAudit.js';

/**
 * A [data-carousel] strip may overflow sideways inside itself (John, 16 Nov 2026, QO946.c132: "leave the buttons in a
 * carousels please"); the same strip without the marker is still a fault, and a carousel wider than the window still is.
 */
const MODE: AuditMode = {kind: 'must-fit', vertical: true};
const strip = (attr: string, width: string): string => `<div id="root"><div class="s" ${attr} style="display:flex;gap:6px;overflow-x:auto;width:${width}">${
  Array.from({length: 8}, (_, i) => `<button style="flex:none;width:80px;height:44px">Chip ${i}</button>`).join('')}</div></div>`;

for (const [label, attr, width, fails] of [
  ['a carousel strip that fits the window passes', 'data-carousel', '300px', false],
  ['the same strip without the carousel marker fails', '', '300px', true],
  ['a carousel wider than the window fails', 'data-carousel', '600px', true],
] as const) {
  test(label, async ({page}) => {
    await page.setViewportSize({width: 360, height: 400});
    await page.setContent(`<body style="margin:0">${strip(attr, width)}</body>`);
    const faults = [...await page.evaluate(auditScreen, MODE), ...(await page.locator('#root').evaluate(measureWholeScreen)).issues];
    expect(faults.length > 0, faults.join('; ')).toBe(fails);
  });
}
