import {expect, test} from '../fixtures.js';
import {enterText, openScreen, openSweepProject} from '../fixtures/dependentValues.js';

const signal = {name: 'Signal', tab: /^Signal$/};
const radiator = {name: 'Passive Radiator', tab: /^Passive Radiator$/};
const box = {name: 'Box', tab: /^Box$/};
for (const skin of ['phone', 'desktop'] as const) {
  test(`${skin}: radiator count warning follows the selected signal power`, async ({appPage: page}, testInfo) => {
    await openSweepProject(page, skin, 'box-passive-radiator');
    const openRadiator = () => openScreen(page, skin, skin === 'phone' ? box : radiator);
    await openRadiator();
    const chooser = skin === 'phone'
      ? page.getByRole('button', {name: 'Select PR'})
      : page.locator('.edit-btn[title^="Browse bundled"]');
    await chooser.click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'ASP190'}).first().click();
    await expect(page.locator('.pr-filter')).toHaveCount(0);
    await openScreen(page, skin, signal);
    const power = page.locator('[data-field="signal_Pin_W"] input:visible').first();
    await enterText(power, '0.1');
    await openRadiator();
    const count = page.locator(skin === 'phone' ? '#mob-pr-count' : '#og-pr-count');
    const row = count.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," ui-field ")][1]');
    await expect(row.locator('.ui-field-dq-btn')).toHaveCount(0);
    await count.scrollIntoViewIfNeeded();
    await page.screenshot({path: testInfo.outputPath('before.png')});
    await openScreen(page, skin, signal);
    await enterText(power, '1000');
    await openRadiator();
    await count.scrollIntoViewIfNeeded();
    const warning = row.locator('.ui-field-dq-btn');
    await expect(warning).toBeVisible();
    await warning.click();
    await expect(row.locator('.ui-field-note')).toContainText('signal and current filters');
    await expect(row.locator('.ui-field-note')).toContainText('exceeds Xmax');
    await page.screenshot({path: testInfo.outputPath('after.png')});
    await openScreen(page, skin, signal);
    await enterText(power, '0.1');
    await openRadiator();
    await expect(row.locator('.ui-field-dq-btn')).toHaveCount(0);
    await openScreen(page, skin, signal);
    const voltage = page.locator('[data-field="signal_DriveV_V"] input:visible').first();
    await enterText(voltage, '50');
    await openRadiator();
    await expect(warning).toBeVisible();
    await warning.click();
    await expect(row.locator('.ui-field-note')).toContainText('50.00 V signal');
  });
}
