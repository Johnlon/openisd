import type {Locator, Page} from '@playwright/test';
import {openTab, setFocusedBoxType} from '../fixtures.js';
import {numInputByLabel} from './numField.js';
import {mobileFieldRow} from './mobileSkin.js';

/** The passive radiator as its tab shows it, in the units the tab shows; null where a box is empty. */
export interface ShownPassiveRadiator {
  name: string;
  count: number;
  vas_L: number | null;
  qms: number | null;
  fs_hz: number | null;
  sd_cm2: number | null;
  xmax_mm: number | null;
}

async function numberIn(input: Locator): Promise<number | null> {
  const text = await input.inputValue();
  return text === '' ? null : Number(text);
}

/** Reads the Passive Radiator tab after the user leaves the passive-radiator box type and comes back, so
 *  what is shown is what the project holds and not what a box was last typed into. */
export async function shownPassiveRadiator(page: Page): Promise<ShownPassiveRadiator> {
  await setFocusedBoxType(page, 'sealed');
  await setFocusedBoxType(page, 'box-passive-radiator');
  const phone = await page.locator('.mobile-root').count() > 0;
  if (!phone) await openTab(page, 'Passive Radiator');
  if (phone) {
    const input = (label: string) => mobileFieldRow(page, label).locator('input').first();
    return {
      name: await page.locator('#mob-pr-name').inputValue(),
      count: Number(await page.locator('#mob-pr-count').inputValue()),
      vas_L: await numberIn(input('Vas')),
      qms: await numberIn(input('Qms')),
      fs_hz: await numberIn(mobileFieldRow(page, 'Fpr').filter({ hasNotText: 'with added mass' }).locator('input').first()),
      sd_cm2: await numberIn(input('Sd')),
      xmax_mm: await numberIn(input('Xmax')),
    };
  }
  const pane = page.locator('.two-col').filter({ has: page.locator('#og-pr-fs') });
  return {
    name: await page.locator('#og-pr-name').inputValue(),
    count: Number(await page.locator('#og-pr-count').inputValue()),
    vas_L: await numberIn(page.locator('#og-pr-vas')),
    qms: await numberIn(page.locator('#og-pr-qms')),
    fs_hz: await numberIn(page.locator('#og-pr-fs')),
    sd_cm2: await numberIn(numInputByLabel(page, 'Sd', pane).first()),
    xmax_mm: await numberIn(numInputByLabel(page, 'Xmax', pane).first()),
  };
}
