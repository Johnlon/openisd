/**
 * Switching between open projects in the mobile app (menu → Open projects) must show the box type
 * of the project switched TO: the tab bar's enclosure tab and the Box tab's box type follow it.
 * John, 2026-10-04: "when I switch project to passive in the mobile app the tabs don't
 * reorganize to a pr type box or repaint for my box, shows last opened box".
 */
import {expect, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

const TEST_DRIVER = 'Tang Band W5-1138SMF';

async function startWizard(page: Page, first: boolean, driver: string): Promise<void> {
  if (first) {
    await page.addInitScript(() => {
      localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
    });
    await page.goto('/');
    await page.getByText('New project').click();
  } else {
    await page.locator('.mob-hamburger').click();
    await page.locator('.mob-menu-item', { hasText: 'New project' }).click();
  }
  await page.getByText(driver).click();
}

async function createProject(page: Page, first: boolean, boxType: string, name: string, driver = TEST_DRIVER): Promise<void> {
  await startWizard(page, first, driver);
  const okBtn = page.locator('.mob-np-footer .ok-btn');
  await okBtn.click();
  await okBtn.click();
  await page.locator('#np-box-type').selectOption(boxType);
  if (boxType === 'box-passive-radiator') {
    await okBtn.click();
    await page.locator('#np-pr-select').click();
    await page.locator('button', { hasText: 'Define new PR' }).click();
  }
  while ((await okBtn.first().textContent())?.includes('Next')) await okBtn.first().click();
  await page.locator('input[type=text]').first().fill(name);
  await okBtn.click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
}

async function switchTo(page: Page, name: string): Promise<void> {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-open-project-name', { hasText: name }).click();
}

test('switching between a vented and a passive radiator project repaints the tabs and the Box tab', async ({ page }) => {
  await createProject(page, true, 'vented', 'Vented one');
  await createProject(page, false, 'box-passive-radiator', 'Radiator one');
  const tabs = page.locator('.mob-tab');
  await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(1);

  await switchTo(page, 'Vented one');
  await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(0);
  await expect(tabs.filter({ hasText: 'Vented' })).toHaveCount(1);
  await tabs.filter({ hasText: 'Box' }).click();
  await expect(page.locator('#mob-box-type')).toHaveValue('vented');

  await switchTo(page, 'Radiator one');
  await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(1);
  await expect(page.locator('#mob-box-type')).toHaveValue('box-passive-radiator');
});

test('switching projects while the Box tab is showing repaints it and the tab bar', async ({ page }) => {
  await createProject(page, true, 'vented', 'Vented two');
  await createProject(page, false, 'box-passive-radiator', 'Radiator two');
  const tabs = page.locator('.mob-tab');
  await tabs.filter({ hasText: 'Box' }).click();
  await expect(page.locator('#mob-box-type')).toHaveValue('box-passive-radiator');

  await switchTo(page, 'Vented two');
  await expect(page.locator('#mob-box-type')).toHaveValue('vented');
  await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(0);

  await switchTo(page, 'Radiator two');
  await expect(page.locator('#mob-box-type')).toHaveValue('box-passive-radiator');
  await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(1);
});

test('switching projects while the Passive Radiator tab is showing leaves a tab that fits the new box', async ({ page }) => {
  await createProject(page, true, 'vented', 'Vented three');
  await createProject(page, false, 'box-passive-radiator', 'Radiator three');
  const tabs = page.locator('.mob-tab');
  await tabs.filter({ hasText: 'Passive Radiator' }).click();
  await expect(page.getByText('Select passive radiator')).toBeVisible();

  await switchTo(page, 'Vented three');
  await expect(page.getByText('Select passive radiator')).toHaveCount(0);
  await expect(tabs.filter({ hasText: 'Passive Radiator' })).toHaveCount(0);
});

test('switching from a vented project to a sealed one on the Box tab repaints it', async ({ page }) => {
  await createProject(page, true, 'sealed', 'w5 sealed');
  await createProject(page, false, 'vented', 'w5 vented');
  const tabs = page.locator('.mob-tab');
  await tabs.filter({ hasText: 'Box' }).click();
  await expect(page.locator('#mob-box-type')).toHaveValue('vented');

  await switchTo(page, 'w5 sealed');
  await expect(page.locator('#mob-box-type')).toHaveValue('sealed');
  await expect(tabs.filter({ hasText: 'Vented' })).toHaveCount(0);

  await switchTo(page, 'w5 vented');
  await expect(page.locator('#mob-box-type')).toHaveValue('vented');
  await expect(tabs.filter({ hasText: 'Vented' })).toHaveCount(1);
});
