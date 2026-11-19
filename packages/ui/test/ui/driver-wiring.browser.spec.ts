import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, openTab, test} from '../fixtures.js';
import {numInputByLabel} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * "Driver wiring" and "Impedance of one driver" (ticket 519, plan sections 3.1, 3.2, 3.3), both skins. The row is drawn only with 2 or
 * more drivers. At 1 W entered, N drivers: Parallel reads V volts, Series N x V (the voltage is the amplifier's). The Advanced switch
 * is editable only with 2 or more drivers, and the Signal voltage help says "the voltage at your amplifier's output".
 */
interface Skin {
  readonly open: (page: Page) => Promise<void>;
  readonly count: string;
  readonly wiring: string;
  readonly volts: string;
  readonly driverTab: (page: Page) => Promise<void>;
  readonly advancedTab: (page: Page) => Promise<void>;
  readonly leaveAdvanced: (page: Page) => Promise<void>;
}

const DESKTOP: Skin = {
  open: async page => { await page.goto('/'); await openAProject(page); },
  count: '#og-ndrivers', wiring: '#og-driver-wiring', volts: 'input voltage',
  driverTab: page => page.locator('.project-nav li', {hasText: 'Driver'}).click(),
  advancedTab: page => page.locator('.project-nav li', {hasText: /^Advanced$/}).click(),
  leaveAdvanced: async () => undefined,
};
const PHONE: Skin = {
  open: async page => { await forceMobileSkin(page); await page.goto('/'); await openAMobileProject(page); },
  count: '#mob-n-drivers', wiring: '#mob-driver-wiring', volts: 'Volts',
  driverTab: page => page.locator('.mob-tab', {hasText: 'Driver'}).click(),
  advancedTab: async page => { await page.locator('.mob-hamburger').click(); await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click(); },
  leaveAdvanced: page => page.getByRole('button', {name: 'Close', exact: true}).last().click(),
};

for (const [skin, skinName] of [[DESKTOP, 'desktop'], [PHONE, 'phone']] as const) {
  test(`${skinName}: the Driver wiring row is absent with 1 driver and present with 2 or more, Parallel by default`, async ({page}) => {
    await skin.open(page);
    await skin.driverTab(page);
    await expect(page.locator(skin.count)).toHaveValue('1');
    await expect(page.locator(skin.wiring)).toHaveCount(0);
    await page.locator(skin.count).selectOption('4');
    await expect(page.locator(skin.wiring)).toBeVisible();
    await expect(page.locator(skin.wiring)).toHaveValue('parallel');
    await expect(page.locator(`label[for="${skin.wiring.slice(1)}"]`)).toHaveText('Driver wiring');
    await expect(page.locator(skin.wiring)).toHaveAttribute('title', /How the drivers are connected to the amplifier\. Parallel: each driver gets the full amplifier voltage/);
    await page.locator(skin.count).selectOption('1');
    await expect(page.locator(skin.wiring)).toHaveCount(0);
  });

  test(`${skinName}: Series makes the amplifier voltage 4 times higher for the same power; going back to 1 driver and to 4 keeps Series`, async ({page}) => {
    await skin.open(page);
    await skin.driverTab(page);
    await page.locator(skin.count).selectOption('4');
    await openTab(page, 'Signal');
    const volts = numInputByLabel(page, skin.volts);
    const parallelVolts = Number(await volts.inputValue());
    await openTab(page, 'Driver');
    await page.locator(skin.wiring).selectOption('series');
    await openTab(page, 'Signal');
    // The power is entered and stays: each driver draws the same power, the amplifier needs about N times the voltage (plan 3.3);
    // a little less than N x because the default Rg (0.1 ohm, at the amplifier) is 4 x 0.1 per driver in Parallel and 0.1 / 4 in Series.
    await expect.poll(async () => Number(await volts.inputValue())).toBeGreaterThan(3.5 * parallelVolts);
    expect(Number(await volts.inputValue())).toBeLessThan(4 * parallelVolts);
    await openTab(page, 'Driver');
    await page.locator(skin.count).selectOption('1');
    await page.locator(skin.count).selectOption('4');
    await expect(page.locator(skin.wiring)).toHaveValue('series');
  });

  test(`${skinName}: the Signal voltage help says it is the voltage at the amplifier's output`, async ({page}) => {
    await skin.open(page);
    await openTab(page, 'Signal');
    await expect(numInputByLabel(page, skin.volts)).toHaveAttribute('title', /the voltage at your amplifier's output/i);
  });

  test(`${skinName}: "Impedance of one driver" is off, editable with 4 drivers and greyed with 1`, async ({page}) => {
    await skin.open(page);
    await skin.advancedTab(page);
    const sw = page.locator('[data-field-key="winisdOneDriverImpedance"] input');
    await expect(sw).toBeVisible();
    await expect(sw).toBeDisabled();
    await expect(sw).not.toBeChecked();
    await skin.leaveAdvanced(page);
    await skin.driverTab(page);
    await page.locator(skin.count).selectOption('4');
    await skin.advancedTab(page);
    await expect(sw).toBeEnabled();
    await expect(sw).not.toBeChecked();
    await sw.check();
    await expect(sw).toBeChecked();
    await expect(page.locator('[data-field-key="winisdOneDriverImpedance"]')).toHaveAttribute('title', /Impedance of one driver: WinISD works out the sound as if the drivers were wired in parallel/);
  });
}
