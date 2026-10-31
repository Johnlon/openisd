/**
 * The Driver Editor (DriverEditorModal, shared with desktop) at phone width, opened from the mobile
 * Driver tab.
 *
 * Bug (John, live on his phone, 2026-09-29, screenshot): the Parameters tab's field rows
 * overlapped illegibly. `max-width: 96vw` on .de-modal computes against the REAL viewport, not
 * the 480px phone pane — at the default (wide) test viewport it never actually constrained the
 * 770px-wide grid, so this needs a genuinely narrow viewport to reproduce/verify.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {PhoneRowSizes, SheetSizes} from '@openisd/design/fields';

/** Where to save a screenshot of the editor at phone width; no screenshot when unset. */
const SCREENSHOT_PATH = process.env.DRIVER_EDITOR_SCREENSHOT;

async function screenshotIfAsked(page: import('@playwright/test').Page): Promise<void> {
  if (SCREENSHOT_PATH) await page.screenshot({ path: SCREENSHOT_PATH });
}

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Driver' }).click();
});

/** Open the footer's More menu (Export, Import, Copy to My Drivers, Reset). */
async function openMore(page: import('@playwright/test').Page) {
  await page.getByRole('button', {name: /^More/}).click();
  const menu = page.getByRole('menu', {name: 'More actions'});
  await expect(menu).toBeVisible();
  return menu;
}

/** On a phone, enabling Inspect Provenance immediately opens the overlay and removes its toolbar.
 *  Use the native click so the action is not coupled to the checkbox remaining mounted afterward. */
async function startPhoneProvenance(page: import('@playwright/test').Page) {
  await page.getByRole('checkbox', {name: 'Inspect Provenance'}).evaluate(el => {
    if (!(el instanceof HTMLInputElement)) throw new Error('Inspect Provenance control is not an input');
    el.click();
  });
  await expect(page.locator('.eq-inspector-card')).toBeVisible();
  await expect(page.locator('.de-toolbar')).toHaveCount(0);
}

test('the Driver Editor field rows stack without overlapping at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.locator('.de-modal')).toBeVisible();

  const qesBox = await page.locator('.de-fld[data-field-key="Qes"]').boundingBox();
  const fsBox = await page.locator('.de-fld[data-field-key="Fs_hz"]').boundingBox();
  expect(qesBox).not.toBeNull();
  expect(fsBox).not.toBeNull();
  // Fs_hz sits later in source order in the same field-slot column — stacked (not overlapping)
  // means it starts at or below where Qes ends.
  expect(fsBox!.y).toBeGreaterThanOrEqual(qesBox!.y + qesBox!.height - 1);
});

/** Every rendered element under `root` whose box crosses the left or right screen edge. Elements
 *  inside the tab row are skipped: that row scrolls sideways inside the editor by design. */
async function elementsPastScreenEdges(page: import('@playwright/test').Page, root: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const width = window.innerWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll(`${sel}, ${sel} *`)) {
      if (el.closest('.de-tabs')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -1 || r.right > width + 1) out.push(`${el.tagName}.${el.className} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return out;
  }, root);
}

// Bug (John, live on his phone, 2026-10-05: "that screen is really broken due to the bottom bar").
test('at phone width the Driver Editor fits the screen: first tab, legend one row, every footer button below it', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.getByText('Edit', { exact: true }).click();
  const modal = page.locator('.de-modal');
  await expect(modal).toBeVisible();

  expect(await elementsPastScreenEdges(page, '.de-modal')).toEqual([]);
  await expect(page.locator('.de-tab').first()).toBeInViewport({ ratio: 1 });
  for (const button of await page.locator('.de-btns button').all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
  }

  // The colour key is the strip under the tabs (T530), not the footer's legend.
  const strip = page.locator('.de-modal .mob-key-strip');
  await expect(strip).toBeVisible();
  for (const word of ['Entered', 'Calculated', 'Not Available']) await expect(strip).toContainText(word);
  const legend = (await strip.boundingBox())!;
  for (const button of await page.locator('.de-btns button').all()) {
    const b = (await button.boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(legend.y + legend.height - 1);
    expect(b.x + b.width).toBeLessThanOrEqual(412 + 1);
  }
  await screenshotIfAsked(page);
});

// T532 (editor-live.html): the phone footer is one row, OK (blue), Cancel, More ▲. Export, Import,
// Copy to My Drivers and Reset are in the More menu, a popup that stays a popup.
test('at phone width the Driver Editor footer is OK, Cancel, More; the other actions are in the More menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByText('Edit', { exact: true }).click();
  const footer = page.locator('.de-footer');
  await expect(footer).toBeVisible();
  const names = ['OK', 'Cancel', 'More'];
  const boxes = [];
  for (const name of names) boxes.push((await footer.getByRole('button', {name: new RegExp(`^${name}`)}).boundingBox())!);
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].y).toBeCloseTo(boxes[0].y, 0);
    expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
  }
  for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(PhoneRowSizes.BUTTON_PX - 0.5);
  await expect(footer.locator('button.mob-btn-primary'), 'one blue button').toHaveCount(1);
  for (const name of ['Export', 'Import', 'Copy to My Drivers', 'Reset']) {
    await expect(footer.getByRole('button', {name, exact: true})).toHaveCount(0);
  }
  for (const button of await footer.locator('button').all()) await expect(button).toBeInViewport({ratio: 1});

  const menu = await openMore(page);
  for (const name of ['Export', 'Import', 'Copy to My Drivers', 'Reset']) {
    const item = menu.getByRole('menuitem', {name, exact: true});
    await expect(item).toBeVisible();
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(SheetSizes.TOUCH_MIN_PX - 0.5);
  }
  const m = (await menu.boundingBox())!;
  expect(m.x).toBeGreaterThanOrEqual(0);
  expect(m.x + m.width).toBeLessThanOrEqual(375);
  expect(m.y + m.height, 'the menu sits above the footer').toBeLessThanOrEqual(boxes[2].y + 1);
  expect(await elementsPastScreenEdges(page, '.de-modal')).toEqual([]);
  // Tapping outside closes it without doing anything.
  await page.locator('.de-more-scrim').click({position: {x: 5, y: 5}});
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.de-modal')).toBeVisible();
});

test('on the phone Reset in the More menu puts the opening values back and closes the menu', async ({ page }) => {
  await page.setViewportSize(PIXEL_9);
  await page.getByText('Edit', { exact: true }).click();
  await page.locator('.de-tab', { hasText: 'General' }).click();
  const comment = page.locator('#de-text-comment');
  const before = await comment.inputValue();
  await comment.fill(before + ' changed');
  const menu = await openMore(page);
  await menu.getByRole('menuitem', {name: 'Reset', exact: true}).click();
  await expect(menu).toHaveCount(0);
  await expect(comment).toHaveValue(before);
});

// T532 (editor-live.html): a bar above the checkboxes, closed: "N values disagree ▸"; open, one line per disagreement.
test.describe('values disagree bar on the phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PIXEL_9);
    await page.getByText('Edit', { exact: true }).click();
    await page.locator('.de-tab', { hasText: 'Parameters' }).click();
  });

  async function enterDisagreeingQs(page: import('@playwright/test').Page) {
    for (const [key, v] of [['Qts', '0.1'], ['Qes', '0.5'], ['Qms', '3']]) {
      const input = page.locator(`.de-fld[data-field-key="${key}"] input`);
      await input.fill(v);
      await input.press('Tab');
    }
  }

  test('the bar is outside the scroll, above the checkboxes, closed by default, and opens to list the disagreements', async ({ page }) => {
    await enterDisagreeingQs(page);
    const bar = page.locator('.de-dq-bar');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.de-dq-head')).toHaveText(/\d+ values? disagrees?/);
    expect(await bar.evaluate(el => el.closest('.de-scroll') === null), 'not in the scroll area').toBe(true);
    await expect(bar.locator('.de-dq-list')).toHaveCount(0);
    const head = (await bar.locator('.de-dq-head').boundingBox())!;
    expect(head.height).toBeGreaterThanOrEqual(SheetSizes.TOUCH_MIN_PX - 0.5);
    const toolbar = (await page.locator('.de-toolbar').boundingBox())!;
    expect(head.y + head.height).toBeLessThanOrEqual(toolbar.y + 1);

    await bar.locator('.de-dq-head').click();
    await expect(bar.locator('.de-dq-list li').first()).toBeVisible();
    expect(await bar.locator('.de-dq-list li').count()).toBeGreaterThanOrEqual(1);
    expect(await elementsPastScreenEdges(page, '.de-modal')).toEqual([]);
    const footer = (await page.locator('.de-footer').boundingBox())!;
    const list = (await bar.boundingBox())!;
    expect(list.y + list.height).toBeLessThanOrEqual(footer.y + 1);
    await bar.locator('.de-dq-head').click();
    await expect(bar.locator('.de-dq-list')).toHaveCount(0);
  });
});

// T532: entering provenance mode opens its overlay immediately; calculable rows carry ƒ marks,
// and selecting another row updates the formula and its live input badges.
test.describe('ƒ marks and value badges on the phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PIXEL_9);
    await page.getByText('Edit', { exact: true }).click();
    await page.locator('.de-tab', { hasText: 'Parameters' }).click();
  });

  test('no ƒ marks until Inspect Provenance is ticked; then calculable rows have one and plain rows do not', async ({ page }) => {
    await expect(page.locator('.de-fx')).toHaveCount(0);
    await startPhoneProvenance(page);
    await expect(page.locator('.de-fld.de-fx[data-field-key="Qts"]')).toHaveCount(1);
    await expect(page.locator('.de-fld.de-fx[data-field-key="Fs_hz"]')).toHaveCount(1);
    await expect(page.locator('.de-fld.de-fx[data-field-key="Le_H"]')).toHaveCount(0);
    const mark = await page.locator('.de-fld[data-field-key="Qts"]').evaluate(el => getComputedStyle(el, '::before').content);
    expect(mark).toContain('ƒ');
    await page.locator('.eq-inspector-card .eq-x').click();
    await expect(page.locator('.de-fx')).toHaveCount(0);
    await expect(page.locator('.de-toolbar')).toBeVisible();
  });

  test('tapping the ƒ row opens the inspector and its badges show the current values', async ({ page }) => {
    const qes = page.locator('.de-fld[data-field-key="Qes"] input');
    await qes.fill('0.42');
    await qes.press('Tab');
    await startPhoneProvenance(page);
    await expect(page.locator('.eq-inspector-card')).toContainText('Provenance: Qes');
    await page.locator('.de-fld[data-field-key="Qts"] label').first().click();
    const card = page.locator('.eq-inspector-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Provenance: Qts');
    await expect(card.locator('.eq-in-badge', {hasText: 'Qes = 0.420'})).toBeVisible();
    for (const b of await card.locator('.eq-in-badge').all()) expect(await b.textContent()).toMatch(/^\s*\S+( = \S+( \S+)?)?\s*$/);
  });
});

// Bug (John, live on his phone, 2026-10-05): the Save to My Drivers boxes ran past the dialog.
test('at phone width the Save to My Drivers dialog sits on screen with its boxes inside it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByText('Edit', { exact: true }).click();
  await (await openMore(page)).getByRole('menuitem', {name: 'Copy to My Drivers', exact: true}).click();
  const panel = page.getByRole('dialog', { name: 'Save to My Drivers' });
  await expect(panel).toBeVisible();

  expect(await elementsPastScreenEdges(page, '.save-lib-panel')).toEqual([]);
  const p = (await panel.boundingBox())!;
  for (const input of await panel.locator('input').all()) {
    const r = (await input.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(p.x);
    expect(r.x + r.width).toBeLessThanOrEqual(p.x + p.width);
  }
});

// Bug (John, live on his phone, 2026-10-05): tapping a field's ⚠ cycled its unit instead of showing
// why it is flagged, and the value boxes changed width with the unit.
// bugs/BUG_20261005_driver-editor-dq-tap-cycles-unit-and-fields-resize.md
test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('tapping a field\'s ⚠ shows the reason and leaves the unit alone; the box keeps one width in every unit', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 900 });
    await page.getByText('Edit', { exact: true }).click();
    const vasField = page.locator('.de-fld[data-field-key="Vas_m3"]');
    await vasField.locator('input').fill('900');
    await vasField.locator('input').press('Tab');

    const unit = vasField.locator('.ui-field-unit');
    const unitBefore = await unit.textContent();
    await vasField.locator('.ui-field-dq-btn').tap();
    await expect(unit).toHaveText(unitBefore!);
    await expect(vasField.locator('.ui-field-note')).toContainText('equivalent volume (Vas)');

    const width = async () => (await vasField.locator('input').boundingBox())!.width;
    const first = await width();
    for (let i = 0; i < 4; i++) {
      await unit.tap();
      expect(await width()).toBe(first);
    }
  });
});

test('the Driver Editor tab titles all fit without scrolling sideways at phone widths', async ({ page }) => {
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  for (const width of [320, 360, 375, 412]) {
    await page.setViewportSize({ width, height: 800 });
    const tabs = page.locator('.de-tabs');
    const [scroll, client] = await tabs.evaluate(el => [el.scrollWidth, el.clientWidth]);
    expect(scroll, `tabs at ${width}px`).toBeLessThanOrEqual(client);
    for (const tab of await page.locator('.de-tab').all()) await expect(tab).toBeInViewport({ ratio: 1 });
  }
});

// John, 18 Oct 2026: "the driver editor buttons are tiny and unusable" and "looks totally different".
// bugs/BUG_20261018_driver-editor-buttons-tiny.md. The editor is built from the same pieces as the
// phone tabs: the shared phone field row, and finger-sized buttons, tabs and boxes.
for (const tabName of ['General', 'Parameters', 'Advanced', 'Dimensions']) {
  test(`on the phone the Driver Editor ${tabName} tab: classic one-line rows, finger-sized buttons, DQ text inside the scroll, nothing past the edge`, async ({ page }) => {
    await page.setViewportSize(PIXEL_9);
    await page.getByText('Edit', { exact: true }).click();
    await expect(page.locator('.de-modal')).toBeVisible();
    await page.locator('.de-tab', { hasText: tabName }).click();

    // Buttons and tabs are finger-sized; the boxes inside a row are the classic set's.
    const small = await page.locator('.de-modal').evaluate((root, [touch, box]) => {
      const shown = (el: Element): boolean => el.getClientRects().length > 0;
      // The band's and the editor's ? are the classic page's 22 px round help button (PHONE_CLASSIC_BUILD_SPEC §2), not a row control.
      const rowPart = '.num-stepper-btn, .ui-field-dq-btn, .ui-field-unit';
      const buttons = [...root.querySelectorAll('button, [role=button]')].filter(el => shown(el) && !el.matches(`${rowPart}, .mob-band-help, .de-help-button`));
      const parts = [...root.querySelectorAll(`${rowPart}, select, input:not([type=file]):not([type=checkbox])`)].filter(shown);
      const checks = [...root.querySelectorAll('input[type=checkbox]')].filter(shown).map(el => el.closest('label') ?? el);
      const measure = (el: Element, min: number) => ({
        what: `${el.tagName}.${el.className} ${el.getAttribute('title') ?? el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''}`.trim(),
        h: el.getBoundingClientRect().height, min,
      });
      return [...buttons.map(el => measure(el, touch)), ...[...parts, ...checks].map(el => measure(el, box))].filter(c => c.h < c.min);
    }, [SheetSizes.TOUCH_MIN_PX, PhoneRowSizes.CLASSIC.inputMinPx]);
    expect(small, 'controls under their minimum').toEqual([]);

    const notPhoneRows = await page.locator('.de-fld.ui-field').evaluateAll(els =>
      els.filter(el => !el.classList.contains('mob-ui-field')).map(el => el.getAttribute('data-field-key')));
    expect(notPhoneRows, 'field rows that are not the shared phone row').toEqual([]);

    // A row is 40 px deep, and its label is on the same line as its box (the two overlap vertically).
    const rows = await page.locator('.de-fld.mob-ui-field:not(.de-comment)').evaluateAll(els => els.map(el => {
      const r = el.getBoundingClientRect();
      const l = el.querySelector('label')!.getBoundingClientRect();
      const b = el.querySelector('input, select')!.getBoundingClientRect();
      return { key: el.getAttribute('data-field-key'), h: r.height, sameLine: l.top < b.bottom && l.bottom > b.top };
    }));
    expect(rows.length, 'inline rows on the tab').toBeGreaterThan(0);
    expect(rows.filter(r => Math.abs(r.h - PhoneRowSizes.CLASSIC.rowMinPx) > 0.5 || !r.sameLine), 'rows not 40 px deep or with the label above the box').toEqual([]);

    expect(await elementsPastScreenEdges(page, '.de-modal')).toEqual([]);
    const scroll = page.locator('.de-scroll');
    expect(await scroll.evaluate(el => el.scrollWidth <= el.clientWidth), 'no sideways scroll').toBe(true);
  });
}

test('on the phone the incomplete-driver text scrolls with the fields, not fixed above the footer', async ({ page }) => {
  await page.setViewportSize(PIXEL_9);
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.locator('.de-tab', { hasText: 'General' }).click();
  await page.locator('.de-fld[data-field-key="brand"] input').fill('');
  const strip = page.locator('.de-incomplete').first();
  await expect(strip).toBeVisible();
  expect(await strip.evaluate(el => el.closest('.de-scroll') !== null), 'the strip is inside the scroll area').toBe(true);
});

// bugs/BUG_20261018_phone-equation-inspector-covers-editor-tabs.md: the Provenance card sat over the
// editor's ✕ and tabs, so the editor could be neither switched nor closed until the card was.
test.describe('Provenance card on the phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PIXEL_9);
    await page.getByText('Edit', { exact: true }).click();
    await expect(page.locator('.de-modal')).toBeVisible();
    await startPhoneProvenance(page);
    await expect(page.locator('.eq-inspector-card')).toBeVisible();
  });

  test('with the card open the Advanced tab can be tapped and shows', async ({ page }) => {
    await page.locator('.de-tab', { hasText: 'Advanced' }).click();
    await expect(page.locator('.de-tab.on')).toHaveText('Advanced');
    await expect(page.locator('.de-fld:has-text("AlfaVC")').first()).toBeVisible();
  });

  test('with the card open the editor\'s ✕ closes the editor', async ({ page }) => {
    await page.locator('.de-modal h2 .x').click();
    await expect(page.locator('.de-modal')).toHaveCount(0);
  });

  test('the overlay stays inside the screen below the tabs and hides editor action controls', async ({ page }) => {
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
    const card = await box('.eq-inspector-card');
    const header = await box('.de-modal h2');
    const tabs = await box('.de-tabs');
    const viewport = await page.evaluate(() => ({width: innerWidth, height: innerHeight}));
    expect(card.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect(card.y).toBeGreaterThanOrEqual(tabs.y + tabs.height - 1);
    expect(card.y + card.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(viewport.width + 1);
    await expect(page.locator('.de-toolbar')).toHaveCount(0);
    for (const name of ['OK', 'Cancel', 'More']) await expect(page.getByRole('button', {name: new RegExp(`^${name}`)})).toHaveCount(0);
    await expect(page.locator('.de-footer button')).toHaveCount(0);
  });
});

test('on the phone the General tab\'s text rows are one line: label left, box on the same line, running to the right edge', async ({ page }) => {
  await page.setViewportSize(PIXEL_9);
  await page.getByText('Edit', { exact: true }).click();
  await page.locator('.de-tab', { hasText: 'General' }).click();
  const m = await page.locator('.de-general').evaluate(el => {
    const g = el.getBoundingClientRect();
    return {right: g.right, left: g.left, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
      rows: [...el.querySelectorAll('.de-fld:not(.de-comment)')].map(row => {
        const l = row.querySelector('label')!.getBoundingClientRect();
        const b = row.querySelector('input[type=text]')!.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        const contentRight = rr.right - parseFloat(getComputedStyle(row).paddingRight);
        return {key: row.getAttribute('data-field-key'), contentRight, labelRight: l.right, labelTop: l.top, labelBottom: l.bottom, boxLeft: b.left, boxRight: b.right, boxTop: b.top, boxBottom: b.bottom};
      })};
  });
  expect(m.rows.length, 'the text rows are there').toBeGreaterThanOrEqual(6);
  for (const r of m.rows) {
    const labelMid = (r.labelTop + r.labelBottom) / 2;
    expect(labelMid, `${r.key} label is level with its box`).toBeGreaterThan(r.boxTop);
    expect(labelMid, `${r.key} label is level with its box`).toBeLessThan(r.boxBottom);
    expect(r.boxLeft, `${r.key} box is right of its label`).toBeGreaterThanOrEqual(r.labelRight - 1);
    expect(r.contentRight - r.boxRight, `${r.key} box reaches the content's right edge`).toBeLessThanOrEqual(4);
    expect(r.contentRight - r.boxRight).toBeGreaterThanOrEqual(-0.5);
  }
  expect(m.scrollW, 'no sideways scroll').toBeLessThanOrEqual(m.innerW);
});

test.describe('tab strip at the Pixel 9 pixel density', () => {
  test.use({ deviceScaleFactor: 2.566 });

  test('no line is drawn across the selected tab: its face runs unbroken down into the page', async ({ page }) => {
    await page.setViewportSize(PIXEL_9);
    await page.getByText('Edit', { exact: true }).click();
    await page.locator('.de-tab', { hasText: 'General' }).click();
    const tab = page.locator('.de-tab.on');
    const box = (await tab.boundingBox())!;
    const strip = (await page.locator('.de-tabs').boundingBox())!;
    const bottom = Math.max(box.y + box.height, strip.y + strip.height);
    // The tab's lower 8 px and 3 px below it, away from the rounded sides.
    const clip = {x: box.x + 10, y: bottom - 8, width: box.width - 20, height: 11};
    const png = await page.screenshot({clip});
    const rows = await page.evaluate(async (b64: string) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const out: string[] = [];
      for (let y = 0; y < img.height; y++) {
        const seen = new Set<string>();
        for (let x = 0; x < img.width; x++) seen.add([...ctx.getImageData(x, y, 1, 1).data].join(','));
        out.push([...seen].join('|'));
      }
      return out;
    }, png.toString('base64'));
    const broken = rows.map((r, y) => ({r, y})).filter(({r}) => r.includes('|'));
    expect(broken, 'every pixel row across the tab\'s face and just below it is one colour').toEqual([]);
  });
});

// T530, screen 36 (gaps-phone/save-to-library.html): the dialog on the phone has the label above a
// 36 px box, Cancel left of Save, both 44 px, Save the one blue button; it fits the screen at every size.
test('on the phone the Save to My Drivers dialog follows the mock: label above 36 px boxes, Cancel then Save at 44 px', async ({ page }) => {
  await page.setViewportSize(PIXEL_9);
  await page.getByText('Edit', { exact: true }).click();
  await (await openMore(page)).getByRole('menuitem', {name: 'Copy to My Drivers', exact: true}).click();
  const panel = page.getByRole('dialog', { name: 'Save to My Drivers' });
  await expect(panel).toBeVisible();

  const m = await panel.evaluate(el => {
    const r = (e: Element) => e.getBoundingClientRect();
    return {
      panel: r(el),
      fields: [...el.querySelectorAll('.save-lib-fld')].map(f => ({label: r(f.querySelector('label')!), input: r(f.querySelector('input')!)})),
      cancel: r(el.querySelector('.save-cancel-btn')!), save: r(el.querySelector('.save-confirm-btn')!),
      savePrimary: el.querySelector('.save-confirm-btn')!.classList.contains('mob-btn-primary'),
      cancelPrimary: el.querySelector('.save-cancel-btn')!.classList.contains('mob-btn-primary'),
    };
  });
  expect(m.fields, 'Brand and Model').toHaveLength(2);
  for (const f of m.fields) {
    expect(f.input.height, 'box 36 px').toBeCloseTo(36, 0);
    expect(f.input.width, 'box is the panel width less its padding').toBeGreaterThan(m.panel.width - 40);
    expect(f.input.top, 'label text above the box').toBeGreaterThanOrEqual(f.label.top + 10);
  }
  expect(m.cancel.height).toBeGreaterThanOrEqual(PhoneRowSizes.BUTTON_PX - 0.5);
  expect(m.save.height).toBeGreaterThanOrEqual(PhoneRowSizes.BUTTON_PX - 0.5);
  expect(m.cancel.right, 'Cancel left of Save').toBeLessThanOrEqual(m.save.left + 1);
  expect(m.savePrimary, 'Save is the blue button').toBe(true);
  expect(m.cancelPrimary, 'Cancel is the plain button').toBe(false);
  expect(m.panel.width).toBeLessThanOrEqual(340.5);
  expect(m.panel.left).toBeGreaterThanOrEqual(0);
  expect(m.panel.right).toBeLessThanOrEqual(PIXEL_9.width);
  expect(m.panel.bottom).toBeLessThanOrEqual(PIXEL_9.height);
});

test('on the phone Cancel in the Save to My Drivers dialog closes it and tells nothing was saved', async ({ page }) => {
  await page.setViewportSize(PIXEL_9);
  await page.getByText('Edit', { exact: true }).click();
  await (await openMore(page)).getByRole('menuitem', {name: 'Copy to My Drivers', exact: true}).click();
  const panel = page.getByRole('dialog', { name: 'Save to My Drivers' });
  await panel.locator('.save-cancel-btn').click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.de-modal')).toBeVisible();
});

// T530, screen 31 (gaps-phone/equation-inspector.html): the inspector in the editor has a 44 px header
// with a 44x44 close, and no text under 12 px.
test('the equation inspector on the phone has a 44 px header and close, and text of 12 px or more', async ({ page }) => {
  await page.setViewportSize(PIXEL_9);
  await page.getByText('Edit', { exact: true }).click();
  await page.locator('.de-tab', { hasText: 'Parameters' }).click();
  await startPhoneProvenance(page);
  const card = page.locator('.eq-inspector-card');
  await expect(card).toBeVisible();
  const m = await card.evaluate(el => ({
    header: el.querySelector('.eq-hdr')!.getBoundingClientRect().height,
    close: (() => { const r = el.querySelector('.eq-x')!.getBoundingClientRect(); return {w: r.width, h: r.height}; })(),
    smallest: Math.min(...[...el.querySelectorAll('.eq-title, .eq-target, .eq-path-name, .eq-formula, .eq-in-lbl, .eq-in-badge')].map(e => parseFloat(getComputedStyle(e).fontSize))),
  }));
  expect(m.header, 'header at least 44 px').toBeGreaterThanOrEqual(SheetSizes.TOUCH_MIN_PX - 0.5);
  expect(m.close.w).toBeGreaterThanOrEqual(SheetSizes.TOUCH_MIN_PX - 0.5);
  expect(m.close.h).toBeGreaterThanOrEqual(SheetSizes.TOUCH_MIN_PX - 0.5);
  expect(m.smallest, 'smallest text').toBeGreaterThanOrEqual(12);
  await card.locator('.eq-x').click();
  await expect(card).toHaveCount(0);
});
