import type {Locator} from '@playwright/test';
import {chartPicture, expect, expectChartDrawn, openAProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

/** The `.filter-edit-body` row whose label starts with `label`: a `UIFixedField` row for a number, or the
 *  Subtype `<label>` around its select. Anchored so "Q" never matches "Qp". */
function editorRow(panel: Locator, label: string): Locator {
  return panel.locator('.filter-edit-body .ui-field, .filter-edit-body > label')
    .filter({hasText: new RegExp(`^${label}\\b`)});
}

function editorField(panel: Locator, label: string): Locator {
  return editorRow(panel, label).locator('input, select');
}

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Filters'}).click();
});

// One quick-add + one edit per WinISD filter type, proving the tab adds and edits every
// variant — not just the six it used to know about.
const CASES: {
  addLabel: string; badge: string; initialCaption: string;
  editLabel: string; editValue: string | number; editedCaption: string;
}[] = [
  {
    addLabel: '+ LP', badge: 'LP', initialCaption: 'Lowpass (Butterworth, n=2, fc=50.00 Hz)',
    editLabel: 'Cutoff', editValue: 88, editedCaption: 'Lowpass (Butterworth, n=2, fc=88.00 Hz)',
  },
  {
    addLabel: '+ HP', badge: 'HP', initialCaption: 'Highpass (Butterworth, n=2, fc=20.00 Hz)',
    editLabel: 'Cutoff', editValue: 33, editedCaption: 'Highpass (Butterworth, n=2, fc=33.00 Hz)',
  },
  {
    addLabel: '+ AP', badge: 'AP', initialCaption: 'Allpass (n=1, t=0.001 s)',
    editLabel: 't', editValue: 0.005, editedCaption: 'Allpass (n=1, t=0.005 s)',
  },
  {
    addLabel: '+ LT', badge: 'LT', initialCaption: 'Linkwitz transform (f0=50.00 Q0=0.70 fp=20.00 Qp=0.50)',
    editLabel: 'f0', editValue: 45, editedCaption: 'Linkwitz transform (f0=45.00 Q0=0.70 fp=20.00 Qp=0.50)',
  },
  {
    addLabel: '+ PEQ', badge: 'PEQ', initialCaption: 'Parametric EQ (fc=30.00 Hz, Q=2.00, Gain=6.00 dB)',
    editLabel: 'Gain', editValue: 3, editedCaption: 'Parametric EQ (fc=30.00 Hz, Q=2.00, Gain=3.00 dB)',
  },
  {
    addLabel: '+ Peak HP', badge: 'PHP', initialCaption: 'Peaking 2nd order highpass (Gpk=6.00 dB fpk=20.00 Hz)',
    editLabel: 'fpk', editValue: 25, editedCaption: 'Peaking 2nd order highpass (Gpk=6.00 dB fpk=25.00 Hz)',
  },
  {
    addLabel: '+ Gain', badge: 'GAIN', initialCaption: 'Static gain (Gain=0.00 dB)',
    editLabel: 'Gain', editValue: -3, editedCaption: 'Static gain (Gain=-3.00 dB)',
  },
  {
    addLabel: '+ DLP', badge: 'DLP', initialCaption: 'DLP Raised Cosine (fc=100.00 Hz, BW=0.33 oct, Gain=6.00 dB)',
    editLabel: 'BW', editValue: 0.5, editedCaption: 'DLP Raised Cosine (fc=100.00 Hz, BW=0.50 oct, Gain=6.00 dB)',
  },
  {
    addLabel: '+ LS', badge: 'LS', initialCaption: 'Low shelf (fc 150 Hz · Q 0.71 · 6.0 dB)',
    editLabel: 'Gain', editValue: 3, editedCaption: 'Low shelf (fc 150 Hz · Q 0.71 · 3.0 dB)',
  },
  {
    addLabel: '+ HS', badge: 'HS', initialCaption: 'High shelf (fc 2000 Hz · Q 0.71 · 6.0 dB)',
    editLabel: 'fc', editValue: 2500, editedCaption: 'High shelf (fc 2500 Hz · Q 0.71 · 6.0 dB)',
  },
];

for (const c of CASES) {
  test(`Filters tab quick-adds, shows and edits ${c.badge}`, async ({page}) => {
    const panel = page.locator('.content-panel');
    await panel.locator('.action-btn', {hasText: c.addLabel}).click();
    await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(1);
    await expect(panel.locator('.filter-type-badge')).toHaveText(c.badge);
    await expect(panel.locator('.filter-summary')).toContainText(c.initialCaption);

    // Quick-add opens the new row's editor already — no click needed to reveal it.
    await fillAndBlur(editorField(panel, c.editLabel), String(c.editValue));
    await expect(panel.locator('.filter-summary')).toContainText(c.editedCaption);

    await panel.locator('.filter-del').click();
    await expect(panel.locator('.filters-list .filter-row-inline')).toHaveCount(0);
  });
}

test('switching a lowpass Subtype to Bessel keeps order/fc/Q and updates the caption', async ({page}) => {
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ LP'}).click();
  await expect(panel.locator('.filter-summary')).toContainText('Lowpass (Butterworth, n=2, fc=50.00 Hz)');

  await editorField(panel, 'Subtype').selectOption({label: 'Bessel'});

  await expect(panel.locator('.filter-summary')).toContainText('Lowpass (Bessel, n=2, fc=50.00 Hz)');
});

// Every filter number has the ▲▼ step buttons; a tap on ▲ applies at once (BUG_20261005_no-common-ui-field-component).
for (const c of CASES) {
  test(`${c.badge}: ${c.editLabel} has step buttons, and a ▲ tap changes the filter`, async ({page}) => {
    const panel = page.locator('.content-panel');
    await panel.locator('.action-btn', {hasText: c.addLabel}).click();
    await expect(panel.locator('.filter-summary')).toContainText(c.initialCaption);
    await expect(panel.locator('.filter-edit-body input[type=number]')).toHaveCount(0);

    const buttons = editorRow(panel, c.editLabel).locator('.num-stepper-btn');
    await expect(buttons).toHaveCount(2);
    for (let i = 0; i < 10; i++) await buttons.first().click();
    await expect(panel.locator('.filter-summary')).not.toContainText(c.initialCaption);
  });
}

test('an emptied field waits for the entry instead of snapping to its limit', async ({page}) => {
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ LP'}).click();
  const cutoff = editorField(panel, 'Cutoff');
  await cutoff.fill('');
  await expect(cutoff).toHaveValue('');
  await expect(panel.locator('.filter-summary')).toContainText('fc=50.00 Hz');
});

// John, 2026-10-01: spinning a filter value moved the charts only on release. Each held-spinner
// step (an `input`, no `change`) must reach the swept curves, not just the caption.
test('a LP Cutoff step button moves the swept SPL', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const splPicture = () => chartPicture(page);

  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ LP'}).click();
  await expect(panel.locator('.filter-summary')).toContainText('fc=50.00 Hz');
  await expectChartDrawn(page);
  const before = await splPicture();

  const down = editorRow(panel, 'Cutoff').locator('.num-stepper-btn').nth(1);
  for (let step = 0; step < 5; step++) await down.click();
  await expect(panel.locator('.filter-summary')).not.toContainText('fc=50.00 Hz');
  await expect.poll(splPicture).not.toBe(before);
  expect(errors).toEqual([]);
});

test('the quick-add bar offers every WinISD filter type plus the two shelves, and a quick-add reaches the project', async ({page}) => {
  const panel = page.locator('.content-panel');
  // Every WinISD Filter Editor type (8) plus the two OpenISD-only shelves.
  await expect(panel.locator('.filters-quickadd .action-btn')).toHaveCount(10);

  await panel.locator('.action-btn', {hasText: '+ HP'}).click();
  await expect(panel.locator('.filter-del')).toHaveCount(1);
  await panel.locator('.filter-del').click();
  await expect(panel.locator('.filter-del')).toHaveCount(0);
});

// WinISD deviation cue: a small button next to a control whose result differs from WinISD because
// OpenISD fixed a WinISD bug. It opens the help page "OpenISD and WinISD differences" at the bug's
// entry (its size and the bug switch that brings WinISD back); it is hidden while that switch
// reproduces WinISD. It sits on every filter of the kind the bug concerns, whatever the order
// (John, 2026-10-05).
test('an allpass shows the WinISD deviation cue at any order; WinISD ignores orders above 2, so there is no switch', async ({page}) => {
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ AP'}).click();
  const cue = panel.locator('.filter-edit-body button.winisd-deviation-cue');
  await fillAndBlur(editorField(panel, 'Order'), '2');
  await expect(panel.locator('.filter-summary')).toContainText('n=2');
  await expect(cue).toBeVisible();
  await fillAndBlur(editorField(panel, 'Order'), '4');
  await expect(cue).toBeVisible();
  await expect(cue).toHaveAttribute('aria-label', /^Differs from WinISD: /);

  await cue.click();
  const dialog = page.getByRole('dialog', {name: 'OpenISD and WinISD differences'});
  await expect(dialog).toBeVisible();
  const entry = dialog.locator('.wd-entry.current');
  await expect(entry.locator('h4')).toHaveText('WinISD ignores allpass orders above 2');
  await expect(entry).toContainText('t/Q');
  await expect(entry).toContainText('5.0 ms');
  await expect(entry.locator('dt', {hasText: 'Switch'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await cue.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await dialog.locator('.wd-footer').getByRole('button', {name: 'Close'}).click();
  await expect(dialog).toHaveCount(0);
});

test('a Linkwitz-Riley takes even orders and shows the WinISD deviation cue at every order, 4 included', async ({page}) => {
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ LP'}).click();
  await editorField(panel, 'Subtype').selectOption({label: 'Linkwitz-Riley'});
  const order = editorField(panel, 'Order');
  const cue = panel.locator('.filter-edit-body button.winisd-deviation-cue');
  // The new low-pass is order 2, so it becomes LR2: WinISD would draw LR4.
  await expect(panel.locator('.filter-summary')).toContainText('Linkwitz-Riley, n=2');
  await expect(cue).toBeVisible();
  await fillAndBlur(order, '3');
  await expect(panel.locator('.filter-summary')).toContainText('Linkwitz-Riley, n=4');
  await expect(cue).toBeVisible();
  await fillAndBlur(order, '2');
  await expect(panel.locator('.filter-summary')).toContainText('Linkwitz-Riley, n=2');
  await expect(cue).toBeVisible();
  await cue.click();
  await expect(page.getByRole('dialog', {name: 'OpenISD and WinISD differences'}).locator('.wd-entry.current')).toContainText('always draws a 4th-order');
});

test('a Linkwitz-Riley Order steps by 2 with a floor of 2; Butterworth steps by 1', async ({page}) => {
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ LP'}).click();
  const order = editorField(panel, 'Order');
  const [up, down] = [0, 1].map(i => editorRow(panel, 'Order').locator('.num-stepper-btn').nth(i));
  await up.click();
  await expect(panel.locator('.filter-summary')).toContainText('Butterworth, n=3');
  await down.click();
  await editorField(panel, 'Subtype').selectOption({label: 'Linkwitz-Riley'});
  await fillAndBlur(order, '4');
  await expect(panel.locator('.filter-summary')).toContainText('Linkwitz-Riley, n=4');
  await up.click();
  await expect(panel.locator('.filter-summary')).toContainText('Linkwitz-Riley, n=6');
  await down.click();
  await down.click();
  await expect(panel.locator('.filter-summary')).toContainText('Linkwitz-Riley, n=2');
  await down.click();
  await expect(panel.locator('.filter-summary')).toContainText('Linkwitz-Riley, n=2');
  await expect(order).toHaveValue('2');
});

test('a User SOS Order box is greyed out: a second-order section is order 2', async ({page}) => {
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ HP'}).click();
  await editorField(panel, 'Subtype').selectOption({label: 'SOS, User specified fc and Q'});
  await expect(editorField(panel, 'Order')).toHaveAttribute('readonly', '');
  await expect(editorRow(panel, 'Order')).toHaveAttribute('title', /second-order section/);
});

test('a Bessel high-pass shows the WinISD deviation cue by its Subtype', async ({page}) => {
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ HP'}).click();
  const cue = panel.locator('.filter-edit-body button.winisd-deviation-cue');
  await expect(cue).toHaveCount(0);
  await editorField(panel, 'Subtype').selectOption({label: 'Bessel'});
  await expect(cue).toBeVisible();
  await cue.click();
  await expect(page.getByRole('dialog', {name: 'OpenISD and WinISD differences'}).locator('.wd-entry.current')).toContainText('"Bessel high-pass"');
});

// UI layout safety: all ten editors open at once never push a scrollbar or clip a control in the panel.
for (const size of [{width: 1280, height: 800}, {width: 1880, height: 1000}]) {
  test(`the filter editors fit the panel without a scrollbar at ${size.width}x${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    const panel = page.locator('.content-panel');
    for (const label of ['+ LP', '+ AP', '+ LT', '+ PEQ', '+ Peak HP', '+ Gain', '+ DLP', '+ LS']) {
      await panel.locator('.action-btn', {hasText: label}).click();
    }
    const fit = await panel.evaluate(el => {
      const box = el.getBoundingClientRect();
      const outside = [...el.querySelectorAll('.filter-edit-body .ui-field')].filter(f => f.getBoundingClientRect().right > box.right + 0.5).length;
      return {scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, outside};
    });
    console.log(`filters panel ${size.width}x${size.height}: scrollWidth ${fit.scrollWidth}, clientWidth ${fit.clientWidth}, rows past the right edge ${fit.outside}`);
    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
    expect(fit.outside).toBe(0);
  });
}
