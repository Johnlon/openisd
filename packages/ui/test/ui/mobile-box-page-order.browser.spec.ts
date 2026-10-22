/**
 * The phone Box page, one per box type, in the order of the accepted mock (QO267 box-combined-live):
 * chambers hold volume and readouts only, each tuning row heads its own vent or radiator section,
 * the links read "Choose alignment…" and "Box losses (Qa, Ql, Qp)…", the Intra vent says what it is.
 * Measured at every phone size: nothing clipped, no sideways scroll.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import type {Page} from '@playwright/test';

type BoxOption = 'sealed' | 'vented' | 'box-passive-radiator' | 'bandpass4' | 'bandpass6' | 'abc';

const LOSSES = 'Box losses (Qa, Ql, Qp)…';
const ALIGN = 'Choose alignment…';
const VENT_ROWS = ['Number of Vents', 'Shape', 'End Correction', 'Vent diameter', 'Vent length', 'Cross area', '1st port resonance'];

const EXPECTED: readonly {readonly option: BoxOption; readonly sections: readonly (readonly string[])[]}[] = [
  {option: 'sealed', sections: [['Box', 'Box type'], ['Rear chamber', 'Vb', 'Fsc', 'Qtc', ALIGN, LOSSES]]},
  {option: 'vented', sections: [['Box', 'Box type'], ['Rear chamber', 'Vb', ALIGN, LOSSES], ['Vents', 'Fb', ...VENT_ROWS], ['Chart', 'Velocity limit']]},
  {option: 'box-passive-radiator', sections: [['Box', 'Box type'], ['Rear chamber', 'Vb', 'Fh', LOSSES],
    ['Passive radiator', 'Fp', 'Vas', 'Qms', 'Fpr', 'Sd', 'Mms', 'Cms', 'Xmax'],
    ['User options', 'Num. of PRs', 'Added mass to cone', 'Fpr (with added mass)']]},
  {option: 'bandpass4', sections: [['Box', 'Box type'], ['Rear chamber', 'Vb', 'Fsc', LOSSES], ['Front chamber', 'Vf', LOSSES],
    ['Front vent', 'Ffc', ...VENT_ROWS], ['Chart', 'Velocity limit']]},
  {option: 'bandpass6', sections: [['Box', 'Box type'], ['Rear chamber', 'Vb', LOSSES], ['Front chamber', 'Vf', LOSSES],
    ['Rear vent', 'Frc', ...VENT_ROWS], ['Front vent', 'Ffc', ...VENT_ROWS], ['Chart', 'Velocity limit']]},
  {option: 'abc', sections: [['Box', 'Box type'], ['Rear chamber', 'Vb', LOSSES], ['Front chamber', 'Vf', LOSSES],
    ['Rear vent', 'Frc', ...VENT_ROWS], ['Front vent', 'Ffc', ...VENT_ROWS],
    ['Intra vent', 'Connects chambers; not open to outside', ...VENT_ROWS], ['Chart', 'Velocity limit']]},
];

/** Each section's band title, then its row labels, links and notes, as the user reads them top to bottom. */
async function shownSections(page: Page): Promise<string[][]> {
  return page.locator('.mob-classic .mob-csection').evaluateAll(sections => sections.map(section =>
    [...section.querySelectorAll('.mob-band-title, .mob-crow-label, .ui-field > label, .mob-clink, .mob-cnote')]
      .map(el => (el.textContent ?? '').trim())));
}

test.describe('Box page order, per box type', () => {
  for (const size of PHONE_SIZES) {
    test.describe(size.name, () => {
      test.use({viewport: {width: size.width, height: size.height}});

      test.beforeEach(async ({page}) => {
        await forceMobileSkin(page);
        await page.goto('/');
        await openAMobileProject(page);
        await page.locator('.mob-tab', {hasText: 'Box'}).click();
      });

      for (const {option, sections} of EXPECTED) {
        test(`${option}: sections and rows follow the mock, nothing clipped`, async ({page}) => {
          await page.locator('#mob-box-type').selectOption(option);
          expect(await shownSections(page)).toEqual(sections.map(s => [...s]));
          const sideways = await page.evaluate(() => {
            const root = document.querySelector('.mob-classic');
            return root === null ? -1 : root.scrollWidth - root.clientWidth;
          });
          expect(sideways, 'sideways scroll on the Box page').toBeLessThanOrEqual(0);
          const clipped = await page.locator('.mob-classic .mob-crow-label, .mob-classic .mob-clink, .mob-classic .ui-field > label')
            .evaluateAll(els => els.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
          expect(clipped, 'cut labels or links').toEqual([]);
        });
      }
    });
  }
});
