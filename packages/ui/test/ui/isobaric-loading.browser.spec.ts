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
  if (PICTURES !== undefined) await page.screenshot({path: `${PICTURES}/${name}.png`, fullPage: false});
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
    await overlay.locator('input[name=placement][value=isobaric]').check();
    await expect(DESKTOP.wizardDiagram(page).locator('svg')).toBeVisible();
    await expect(DESKTOP.wizardDiagram(page)).toContainText('half the box volume');
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
    await page.locator('#np-placement').selectOption('isobaric');
    await expect(PHONE.wizardDiagram(page).locator('svg')).toBeVisible();
    await expect(PHONE.wizardDiagram(page)).toContainText('half the box volume');
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

      await openTab(page, 'Driver');
      await shell.expectStandardOffered(page);
      await expect(diagram(page)).toBeVisible();
      await expect(diagram(page)).toHaveAttribute('data-placement', 'standard');
      await expect(shell.placementArea(page)).not.toContainText('not modelled');
      await picture(page, `${shell.name}-2-before-driver-standard`);

      await shell.chooseIsobaric(page);
      await shell.expectIsobaricChosen(page);
      // The clamshell pair is drawn beside the choice (WinISD's Box tab drawing does not change, so the Box tab's stays one driver).
      await expect(diagram(page)).toBeVisible();
      await expect(diagram(page)).toHaveAttribute('data-placement', 'isobaric');
      await expect(diagram(page).locator('svg path')).toHaveCount(4);
      await picture(page, `${shell.name}-3-after-driver-isobaric`);

      await openTab(page, 'Box');
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
