/**
 * Iso-Barik loading is on, on each shell (T919, QO953.c38 "A: turn on isobaric"). A user's actions only.
 *  - Driver tab: pick Iso-Barik; the Box tab's closed box then gives, in half the volume, the Qtc it gave in the whole volume.
 *  - New project: pick Iso-Barik on the driver count step; the new project's Driver tab shows it chosen.
 * The pictures it takes (before and after) go to the folder named by ISOBARIC_PICTURES when that is set.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, expectChartDrawn, openAMobileProject, openAProject, openTab, setFocusedBoxType, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const TEST_DRIVER = 'Tang Band W5-1138SMF';
const PICTURES = process.env['ISOBARIC_PICTURES'];

async function picture(page: Page, name: string): Promise<void> {
  // Nothing in the way and nothing mid-fade: the "Project imported" toast gone, the desktop nav's 0.2 s highlight fade finished
  // (a picture taken inside that fade shows the old tab lit beside the new tab's content).
  await expect(page.locator('.flash, [data-testid=flash-strip]')).toHaveCount(0, {timeout: 20000});
  const nav = page.locator('.project-nav li.active');
  if (await nav.count() > 0) {
    await expect(nav).toHaveCSS('background-color', 'rgb(207, 228, 247)');
    await expect(page.locator('.project-nav li:not(.active)').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  if (PICTURES !== undefined) await page.screenshot({path: `${PICTURES}/${name}.png`, fullPage: false});
}


/** The note under the placement drawings starts where the labels above it start, and the drawings sit below the row above with a gap. */
async function expectWizardMargins(page: Page, label: Locator, row: Locator, drawings: Locator, note: Locator): Promise<void> {
  const l = (await label.boundingBox())!, r = (await row.boundingBox())!, d = (await drawings.locator('svg').first().boundingBox())!;
  // Where the note's text starts (its box may be wider than its text).
  const n = await note.evaluate((el) => { const range = document.createRange(); range.selectNodeContents(el); const b = range.getBoundingClientRect(); return {x: b.x, width: b.width}; });
  expect(Math.abs(n.x - l.x), `note left ${n.x} against label left ${l.x}`).toBeLessThanOrEqual(1);
  expect(d.y - (r.y + r.height), 'gap between the row above and the drawings').toBeGreaterThanOrEqual(8);
  expect(n.x + n.width, 'note inside the viewport').toBeLessThanOrEqual(page.viewportSize()!.width);
}

const diagram = (page: Page): Locator => page.getByTestId('placement-diagram');

const field = (page: Page, label: string): Locator => page.locator('.ui-field', {has: page.locator('label', {hasText: new RegExp(`^${label}$`)})}).locator('input').first();

/** What differs between the shells: where the Placement choice is and how a new project is made. */
interface Shell {
  readonly name: string;
  readonly volume: string;
  readonly open: (page: Page) => Promise<void>;
  /** The Placement control's text must not call Iso-Barik "not modelled". */
  readonly placementArea: (page: Page) => Locator;
  readonly expectStandardOffered: (page: Page) => Promise<void>;
  readonly chooseIsobaric: (page: Page) => Promise<void>;
  readonly expectIsobaricChosen: (page: Page) => Promise<void>;
  readonly openChart: (page: Page) => Promise<void>;
  /** The clamshell drawing in the wizard's count step. */
  readonly wizardDiagram: (page: Page) => Locator;
  readonly newProjectChoosingIsobaric: (page: Page) => Promise<void>;
}

const radios = (page: Page): Locator => page.locator('input[name=og-placement][type=radio]');

const DESKTOP: Shell = {
  name: 'desktop',
  volume: 'Volume',
  open: async (page) => { await page.goto('/'); await openAProject(page); },
  placementArea: (page) => page.locator('.radio-group').filter({hasText: 'Iso-Barik'}),
  expectStandardOffered: async (page) => {
    await expect(radios(page).nth(1)).toBeEnabled();
    await expect(radios(page).nth(0)).toBeChecked();
  },
  chooseIsobaric: async (page) => { await radios(page).nth(1).check(); },
  expectIsobaricChosen: async (page) => { await expect(radios(page).nth(1)).toBeChecked(); },
  openChart: async () => undefined,
  wizardDiagram: (page) => page.locator('.overlay.open .np-placement-pic'),
  newProjectChoosingIsobaric: async (page) => {
    await page.goto('/');
    await page.locator('.tb-btn[title*="New project"]').click();
    const overlay = page.locator('.overlay.open');
    await overlay.locator('.dlist .ditem', {hasText: 'W5-1138SMF'}).first().click();
    const next = overlay.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true});
    await next.click();
    await expect(overlay.locator('input[name=placement][value=isobaric]')).toBeEnabled();
    const footerStandard = (await overlay.locator('.modal-footer').boundingBox())!;
    await picture(page, 'desktop-6a-new-project-standard');
    await overlay.locator('input[name=placement][value=isobaric]').check();
    await expect(DESKTOP.wizardDiagram(page).getByTestId('placement-clamshell')).toBeVisible();
    await expect(DESKTOP.wizardDiagram(page).getByTestId('placement-tandem')).toBeVisible();
    await expect(DESKTOP.wizardDiagram(page)).toContainText('half the box volume');
    // The dialog keeps its size when Placement changes.
    expect((await overlay.locator('.modal-footer').boundingBox())!.y, 'footer does not move').toBe(footerStandard.y);
    await expectWizardMargins(page, page.locator('#np-placement-label'), page.locator('.overlay.open .ui-pick-field.radio-group'), DESKTOP.wizardDiagram(page), page.locator('.np-placement-caption'));
    await picture(page, 'desktop-6-new-project-isobaric');
    await next.click();
    await next.click();
    await next.click();
    await overlay.locator('.modal-footer').getByRole('button', {name: 'Create', exact: true}).click();
    await expect(overlay).toBeHidden();
  },
};

const select = (page: Page): Locator => page.locator('#mob-driver-placement');

const PHONE: Shell = {
  name: 'phone',
  volume: 'Vb',
  open: async (page) => {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
  },
  placementArea: (page) => page.locator('.mob-crow').filter({hasText: 'Iso-Barik'}),
  expectStandardOffered: async (page) => {
    await expect(select(page)).toBeEnabled();
    await expect(select(page)).toHaveValue('standard');
  },
  chooseIsobaric: async (page) => { await select(page).selectOption('isobaric'); },
  expectIsobaricChosen: async (page) => { await expect(select(page)).toHaveValue('isobaric'); },
  openChart: async (page) => { await page.locator('.mob-tab', {hasText: 'Graph'}).click(); },
  wizardDiagram: (page) => page.locator('.mob-np-pic'),
  newProjectChoosingIsobaric: async (page) => {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await page.locator('.mob-hamburger').click();
    await page.locator('.mob-menu-item', {hasText: 'New project'}).click();
    await page.getByText(TEST_DRIVER).click();
    const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
    await next.click();
    await expect(page.locator('#np-placement')).toBeEnabled();
    await picture(page, 'phone-6a-new-project-standard');
    await page.locator('#np-placement').selectOption('isobaric');
    await expect(PHONE.wizardDiagram(page).getByTestId('placement-clamshell')).toBeVisible();
    await expect(PHONE.wizardDiagram(page).getByTestId('placement-tandem')).toBeVisible();
    await expect(PHONE.wizardDiagram(page)).toContainText('half the box volume');
    await expectWizardMargins(page, page.locator('label[for=np-placement]'), page.locator('#np-placement').locator('xpath=ancestor::div[contains(@class,"mob-crow")]'), PHONE.wizardDiagram(page), page.locator('.mob-np-pic-caption'));
    await picture(page, 'phone-6-new-project-isobaric');
    await next.click();
    await page.locator('#np-box-type').selectOption({label: 'Closed'});
    await next.click();
    await next.click();
    await page.locator('.mob-np-footer').getByText('Create Project', {exact: true}).click();
    await expect(page.locator('.mob-np-overlay')).toBeHidden();
  },
};

for (const shell of [DESKTOP, PHONE]) {
  test.describe(`${shell.name}: Iso-Barik`, () => {
    test('Driver tab: Iso-Barik is offered, not greyed, and the closed box reads the same Qtc in half the volume', async ({appPage: page}) => {
      await shell.open(page);
      await setFocusedBoxType(page, 'sealed');
      const vb = Number(await field(page, shell.volume).inputValue());
      const standardQtc = await field(page, 'Qtc').inputValue();
      await picture(page, `${shell.name}-1-before-box-standard`);
      await setFocusedBoxType(page, 'vented');
      await picture(page, `${shell.name}-1b-before-box-vented-standard`);
      await setFocusedBoxType(page, 'sealed');

      await openTab(page, 'Driver');
      await shell.expectStandardOffered(page);
      await expect(diagram(page)).toBeVisible();
      await expect(diagram(page)).toHaveAttribute('data-placement', 'standard');
      const standardArea = (await diagram(page).boundingBox())!;
      const standardSvg = (await diagram(page).locator('svg').first().boundingBox())!;
      await expect(diagram(page).getByTestId('placement-clamshell')).toHaveCount(0);
      await expect(shell.placementArea(page)).not.toContainText('not modelled');
      await picture(page, `${shell.name}-2-before-driver-standard`);

      await shell.chooseIsobaric(page);
      await shell.expectIsobaricChosen(page);
      // The clamshell pair is drawn beside the choice (WinISD's Box tab drawing does not change, so the Box tab's stays one driver).
      await expect(diagram(page)).toBeVisible();
      await expect(diagram(page)).toHaveAttribute('data-placement', 'isobaric');
      // Nothing jumps or shrinks when Placement changes: the drawing area and each drawing keep their size.
      expect((await diagram(page).boundingBox())!.height, 'Driver tab drawing area height').toBe(standardArea.height);
      for (const svg of await diagram(page).locator('svg').all()) expect(await svg.boundingBox(), 'each pair drawing is the Standard drawing size').toMatchObject({width: standardSvg.width, height: standardSvg.height});
      await expect(diagram(page).getByTestId('placement-clamshell')).toBeVisible();
      await expect(diagram(page).getByTestId('placement-tandem')).toBeVisible();
      await picture(page, `${shell.name}-3-after-driver-isobaric`);

      await openTab(page, 'Box');
      await expect(page.locator('.project-nav li.active, .mob-tab.active')).toHaveText('Box');
      // The Box tab draws the box with the pair in it, both ways.
      await expect(page.getByTestId('box-clamshell')).toBeVisible();
      await expect(page.getByTestId('box-tandem')).toBeVisible();
      // Two drawings of the same box never repeat an id in the page.
      const repeated = await page.evaluate(() => {
        const seen = new Set<string>(); const dup: string[] = [];
        for (const el of document.querySelectorAll('[id]')) { if (seen.has(el.id)) dup.push(el.id); seen.add(el.id); }
        return dup;
      });
      expect(repeated).toEqual([]);
      // The same box volume now reads a lower Qtc (the pair has half the Vas) ...
      expect(Number(await field(page, 'Qtc').inputValue())).toBeLessThan(Number(standardQtc));
      await picture(page, `${shell.name}-4-after-box-isobaric-same-volume`);
      // ... and half the volume gives the Qtc the standard driver gave in the whole.
      await fillAndBlur(field(page, shell.volume), String(vb / 2));
      await expect(field(page, 'Qtc')).toHaveValue(standardQtc);
      await picture(page, `${shell.name}-5-after-box-isobaric-half-volume`);
      await shell.openChart(page);
      await expectChartDrawn(page);
      await picture(page, `${shell.name}-5b-chart-isobaric`);
      await openTab(page, 'Box');
      await setFocusedBoxType(page, 'vented');
      await expect(page.getByTestId('box-tandem')).toBeVisible();
      await picture(page, `${shell.name}-5c-box-vented-isobaric`);
    });

    test('New project: Iso-Barik chosen on the count step is what the new project has', async ({appPage: page}) => {
      await shell.newProjectChoosingIsobaric(page);
      await openTab(page, 'Driver');
      await expect(shell.placementArea(page)).toContainText('Iso-Barik');
      await shell.expectIsobaricChosen(page);
      await picture(page, `${shell.name}-7-new-project-driver-tab`);
    });
  });
}

const BOX_TYPES = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'] as const;

/** The size of every drawing on the Box tab and of the area that holds them. */
async function drawingSizes(page: Page, area: string): Promise<{svgs: {w: number; h: number}[]; area: {w: number; h: number}}> {
  const svgs: {w: number; h: number}[] = [];
  for (const svg of await page.locator(`${area} figure svg:visible`).all()) {
    const b = (await svg.boundingBox())!;
    svgs.push({w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10});
  }
  const a = (await page.locator(area).boundingBox())!;
  return {svgs, area: {w: Math.round(a.width), h: Math.round(a.height)}};
}

for (const [shell, area, widths] of [[DESKTOP, '.box-diagram-col', [1280]], [PHONE, '.mob-cpic', [360, 412]]] as const) {
  for (const width of widths) {
    test(`${shell.name} ${width} px: every Box tab drawing is the same size in Standard and Iso-Barik, in the same area, nothing clipped`, async ({appPage: page}) => {
      await shell.open(page);
      if (shell === PHONE) await page.setViewportSize({width, height: 780});
      for (const boxType of BOX_TYPES) {
        await setFocusedBoxType(page, boxType);
        await openTab(page, 'Driver');
        await shell.expectStandardOffered(page);
        await openTab(page, 'Box');
        await expect(page.getByTestId('box-standard')).toBeVisible();
        const standard = await drawingSizes(page, area);
        expect(standard.svgs, `${boxType} standard: one drawing`).toHaveLength(1);
        await openTab(page, 'Driver');
        await shell.chooseIsobaric(page);
        await openTab(page, 'Box');
        await expect(page.getByTestId('box-tandem')).toBeVisible();
        const iso = await drawingSizes(page, area);
        expect(iso.svgs, `${boxType} iso: two drawings`).toHaveLength(2);
        for (const d of iso.svgs) expect(d, `${boxType}: each Iso-Barik drawing is the Standard drawing's size`).toEqual(standard.svgs[0]);
        expect(iso.area.h, `${boxType}: the drawing area keeps its height`).toBe(standard.area.h);
        if (shell === PHONE) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${boxType} at ${width}: no sideways scroll`).toBe(true);
          for (const svg of await page.locator(`${area} figure svg:visible`).all()) {
            const b = (await svg.boundingBox())!;
            expect(b.x, `${boxType}: inside the left edge`).toBeGreaterThanOrEqual(0);
            expect(b.x + b.width, `${boxType}: inside the right edge`).toBeLessThanOrEqual(width);
          }
        }
        console.log(`SIZES ${shell.name} ${width} ${boxType} standard ${JSON.stringify(standard.svgs[0])} area ${JSON.stringify(standard.area)} | iso ${JSON.stringify(iso.svgs)} area ${JSON.stringify(iso.area)}`);
        if (boxType === 'sealed' || boxType === 'vented') await picture(page, `${shell.name}-${width}-same-size-${boxType}-iso`);
        await openTab(page, 'Driver');
        if (shell === PHONE) await select(page).selectOption('standard'); else await radios(page).nth(0).check();
      }
    });
  }
}

/** Paired pictures: every view in both placements, same project, same size, same scroll position, names that pair up. */
for (const shell of [DESKTOP, PHONE]) {
  test(`${shell.name}: pictures of every view in both placements, paired`, async ({appPage: page}) => {
    await shell.open(page);
    const top = async (): Promise<void> => { await page.locator('.mob-content, .tab-section.active').first().evaluate((el) => { el.scrollTop = 0; }); };
    for (const [placement, choose] of [['standard', async () => { await openTab(page, 'Driver'); if (shell === PHONE) await select(page).selectOption('standard'); else await radios(page).nth(0).check(); }], ['isobarik', async () => { await openTab(page, 'Driver'); await shell.chooseIsobaric(page); }]] as const) {
      await choose();
      await top();
      await picture(page, `pair-${shell.name}-driver-tab-${placement}`);
      await setFocusedBoxType(page, 'sealed');
      await top();
      await picture(page, `pair-${shell.name}-box-closed-${placement}`);
      await setFocusedBoxType(page, 'vented');
      await top();
      await picture(page, `pair-${shell.name}-box-vented-${placement}`);
    }
  });

  test(`${shell.name}: New Project step 2 pictures in both placements, paired`, async ({appPage: page}) => {
    if (shell === PHONE) {
      await page.setViewportSize(PIXEL_9);
      await forceMobileSkin(page);
      await page.goto('/');
      await page.locator('.mob-hamburger').click();
      await page.locator('.mob-menu-item', {hasText: 'New project'}).click();
      await page.getByText(TEST_DRIVER).click();
      await page.locator('.mob-np-footer').getByText('Next ▸', {exact: true}).click();
      await picture(page, 'pair-phone-new-project-standard');
      await page.locator('#np-placement').selectOption('isobaric');
      await picture(page, 'pair-phone-new-project-isobarik');
    } else {
      await page.goto('/');
      await page.locator('.tb-btn[title*="New project"]').click();
      const overlay = page.locator('.overlay.open');
      await overlay.locator('.dlist .ditem', {hasText: 'W5-1138SMF'}).first().click();
      await overlay.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true}).click();
      await picture(page, 'pair-desktop-new-project-standard');
      await overlay.locator('input[name=placement][value=isobaric]').check();
      await picture(page, 'pair-desktop-new-project-isobarik');
    }
    await expect(page.locator('.overlay.open, .mob-np-overlay').first()).toBeVisible();
  });
}
