import type {Page} from '@playwright/test';
import {WalkSkin} from './viewOpenTypes.js';

/** Shared phone/desktop navigation the open steps use: tabs, the phone wizard, the driver editor. */
export const phoneTab = (page: Page, label: string) => page.locator('.mob-tab').filter({hasText: new RegExp('^' + label + '$')}).click();

/** Phone wizard: walks Next until the wanted step shows (a radiator project picks its radiator on the way). */
export async function openPhoneWizardStep(page: Page, box: string, step: number): Promise<void> {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', {hasText: 'New project'}).click();
  if (step === 1) return;
  await page.locator('.driver-library input.filter').fill('W5-1138SMF');
  await page.locator('.mob-np-body').getByText('Tang Band W5-1138SMF').first().click();
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  await next.click();
  if (step === 2) return;
  await next.click();
  await page.locator('#np-box-type').selectOption(box);
  if (step === 3) return;
  // Each further step is one Next; a radiator project picks its radiator before Next is enabled.
  for (let at = 3; at < step; at++) {
    if (box === 'box-passive-radiator' && await page.locator('#np-pr-select').count() > 0 && await next.isDisabled()) { await page.locator('#np-pr-select').click(); await page.locator('.pr-lib-name').first().click(); }
    await next.click();
  }
}

export const driverEditor = async (page: Page, skin: WalkSkin) => {
  if (skin === WalkSkin.Phone) { await phoneTab(page, 'Driver'); await page.getByRole('button', {name: 'Edit', exact: true}).click(); return; }
  await page.locator('.project-nav li').filter({hasText: /^Driver$/}).click();
  await page.locator('.driver-id-row').getByRole('button', {name: /^(✎ )?Edit$/}).click();
};

