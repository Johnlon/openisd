import type {Locator} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

/** The `.filter-edit-body` field whose `<label>` starts with `label` — the tab nests the
 *  `<input>`/`<select>` inside the `<label>` itself, so there is exactly one input/select per
 *  matched label. Anchored so "Q" never matches "Qp" and "fc" never matches nothing else. */
function editorField(panel: Locator, label: string): Locator {
  return panel.locator('.filter-edit-body label')
    .filter({hasText: new RegExp(`^${label}\\b`)})
    .locator('input, select');
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

// BUG_20261001_filter-spinners-do-not-update-charts-live: holding a spinner arrow fires `input` on
// every step but `change` only on release; the filter must take each step while the arrow is held.
// Headless Chromium runs no spin arrows on a mouse hold, so the step is what Chromium sends during
// one: a new value and an `input` event, no `change`.
for (const c of CASES) {
  test(`${c.badge}: a held ${c.editLabel} spinner applies each step before release`, async ({page}) => {
    const panel = page.locator('.content-panel');
    await panel.locator('.action-btn', {hasText: c.addLabel}).click();
    await expect(panel.locator('.filter-summary')).toContainText(c.initialCaption);

    await editorField(panel, c.editLabel).evaluate((el: HTMLInputElement) => {
      const v = Number(el.value);
      el.value = String(v === 0 ? 1 : v * 2);
      el.dispatchEvent(new Event('input', {bubbles: true}));
    });
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
