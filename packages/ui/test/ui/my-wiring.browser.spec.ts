import {readFileSync} from 'node:fs';
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, openTab, test} from '../fixtures.js';
import {numInputByLabel} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * "Coil wiring" (QO907, issue 512), both skins. Dayton MX6-22 states "all specifications measured
 * with voice coils wired in series": Re 4.7 Ω, BL 12.3 T·m (published). Wired in parallel that is
 * Re 4.7 / 4 = 1.175 Ω and BL 12.3 / 2 = 6.15 T·m, and the 1 W drive voltage V = √(1 W · (Re + Rs))
 * with Rs 0.1 Ω falls from √4.8 = 2.19 V to √1.275 = 1.13 V. The Dayton SD215A-88 (2 coils)
 * states no wiring, so the choice is disabled with the reason.
 */
const MX6_22 = readFileSync('packages/ui/public/drivers/dayton-audio/mx6-22.json');
const UNSTATED = readFileSync('packages/ui/public/drivers/dayton-audio/sd215a-88.json');
const RSS265HO = readFileSync('packages/ui/public/drivers/dayton-audio/rss265ho-44.json');
const RSS315HO = readFileSync('packages/ui/public/drivers/dayton-audio/rss315ho-44.json');
const CE28M = readFileSync('packages/ui/public/drivers/dayton-audio/ce28m-4.json');

async function selectDriver(page: Page, file: Buffer): Promise<void> {
  await page.locator('.driver-library input[type="file"]').setInputFiles({name: 'driver.owdr', mimeType: 'application/json', buffer: file});
  await expect(page.locator('.driver-library .preview')).toBeVisible();
  await page.locator('.driver-library .use-btn').click();
  await expect(page.locator('.wb-modal')).toHaveCount(0);
}

/** A real mouse click at the control's centre, as a user clicks the greyed (disabled) control; Playwright's own click refuses a disabled element. */
async function clickAt(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('the control has no box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

const DESKTOP = {open: async (page: Page) => { await page.goto('/'); await openAProject(page); await page.locator('.project-nav li', {hasText: 'Driver'}).click(); await page.getByRole('button', {name: 'Select Driver'}).click(); }, select: '#og-coil-wiring', volts: 'input voltage'};
const PHONE = {open: async (page: Page) => { await forceMobileSkin(page); await page.goto('/'); await openAMobileProject(page); await page.locator('.mob-tab', {hasText: 'Driver'}).click(); await page.getByText('Select driver').click(); }, select: '#mob-coil-wiring', volts: 'Volts'};

for (const [skin, skinName] of [[DESKTOP, 'desktop'], [PHONE, 'phone']] as const) {
  test(`${skinName}: the measured wiring shows, Coil wiring defaults to it, and parallel converts the figures the amplifier side uses`, async ({page}) => {
    await skin.open(page);
    await selectDriver(page, MX6_22);
    await expect(page.getByText('Measured wiring')).toHaveCount(0);
    await expect(page.locator(skin.select)).toHaveValue('series');
    // John, QO942.c12 and QO943.c4: the control is "Coil wiring" on both skins; "Connection" is WinISD's own word and is no OpenISD label.
    await expect(page.locator(skinName === 'phone' ? 'label[for="mob-coil-wiring"]' : 'label[for="og-coil-wiring"]')).toHaveText('Coil wiring');
    await openTab(page, 'Signal');
    const volts = numInputByLabel(page, skin.volts);
    await expect(volts).toHaveValue(/^2\.19/);

    await openTab(page, 'Driver');
    await page.locator(skin.select).selectOption('parallel');
    // A5 (QO946.c35): no figures line ("As published: Re ... · BL ...") on the Driver tab; the figures show only in the charts.
    await expect(page.getByText(/As published|My wiring:|Re 1\.175/)).toHaveCount(0);
    await openTab(page, 'Signal');
    await expect(volts).toHaveValue(/^1\.1[23]/);
  });

  test(`${skinName}: a parallel-measured driver (RSS265HO-44, 1.6 Ω, 9.39 Tm, wiring stated on the maker's product page) rewired in series: Re x 4 = 6.4 Ω, BL x 2 = 18.78 Tm`, async ({page}) => {
    await skin.open(page);
    await selectDriver(page, RSS265HO);
    await expect(page.getByText('Measured wiring')).toHaveCount(0);
    await page.locator(skin.select).selectOption('series');
    // 1 W into Re x 4 + Rs: sqrt(6.4 + 0.1) = 2.55 V (the stored 1.6 ohm is not overwritten)
    await openTab(page, 'Signal');
    await expect(numInputByLabel(page, skin.volts)).toHaveValue(/^2\.5/);
  });

  // John, QO942.c9: "don't show datasheet setting outside the driver editor". The Driver tab names no datasheet wiring word
  // for a driver whose wiring is stated (MX6-22, RSS265HO-44) or inferred (RSS315HO-44), before or after a change.
  test(`${skinName}: the Driver tab holds no datasheet-wiring word, before and after a change of wiring`, async ({page}) => {
    const NO_DATASHEET_WORD = /as published|stated|inferred|measured|datasheet/i;
    for (const [file, other] of [[MX6_22, 'parallel'], [RSS315HO, 'parallel'], [RSS265HO, 'series']] as const) {
      await skin.open(page);
      await selectDriver(page, file);
      const tab = page.locator(skinName === 'phone' ? '.mob-classic' : '.tab-section.active');
      await expect(page.locator(skin.select)).toBeVisible();
      expect(await tab.innerText()).not.toMatch(NO_DATASHEET_WORD);
      await page.locator(skin.select).selectOption(other);
      expect(await tab.innerText()).not.toMatch(NO_DATASHEET_WORD);
    }
  });


}

// John, QO942.c91: the phone may omit the field when it cannot be used; only the desktop matches WinISD's screen.
test('phone: a driver that does not state its wiring: no wiring block', async ({page}) => {
  await PHONE.open(page);
  await selectDriver(page, UNSTATED);
  await expect(page.getByText('Measured wiring')).toHaveCount(0);
  await expect(page.locator(PHONE.select)).toHaveCount(0);
});

test('desktop: a driver that does not state its wiring: the control greyed, a click says why, no change', async ({page}) => {
  await DESKTOP.open(page);
  await selectDriver(page, UNSTATED);
  const select = page.locator(DESKTOP.select);
  await expect(select).toHaveJSProperty('disabled', true);
  await expect(page.getByTestId('coil-wiring-message')).toHaveCount(0);
  const beside = page.getByText('Voice coil temp rise', {exact: true});
  const before = await beside.boundingBox();
  await clickAt(page, select);
  await expect(page.getByTestId('coil-wiring-message')).toHaveText('The datasheet does not say how the coils were wired when measured, so the wiring cannot be changed. The figures are used as published.');
  // The message wraps in the Placement column: nothing beside it moves (field-layout rule 8).
  expect(await beside.boundingBox()).toEqual(before);
  await expect(select).toHaveValue('parallel');
});

// WinISD greys its coil-wiring box with one coil (observed, winisd_research runs/nd-1; read in the code: enabled only when
// numVC > 1). The desktop skin replicates that screen; the phone shows nothing. QO941.
test('desktop: a driver with no coil count: the control is there, greyed, reading Parallel', async ({page}) => {
  await DESKTOP.open(page);
  await selectDriver(page, CE28M);
  await expect(page.locator(DESKTOP.select)).toHaveJSProperty('disabled', true);
  await expect(page.locator(DESKTOP.select)).toHaveValue('parallel');
  await clickAt(page, page.locator(DESKTOP.select));
  await expect(page.getByTestId('coil-wiring-message')).toHaveText('Coil wiring applies only to drivers with 2 or more voice coils.');
  await expect(page.locator(DESKTOP.select)).toHaveValue('parallel');
});

test('phone: a driver with no coil count: no control', async ({page}) => {
  await PHONE.open(page);
  await selectDriver(page, CE28M);
  await expect(page.locator(PHONE.select)).toHaveCount(0);
});
