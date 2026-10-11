import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(2000);
  
  // Remove splash screen DOM elements
  await page.evaluate(() => {
    document.querySelectorAll('.sp-backdrop, .modal, .modal-backdrop, .dialog-backdrop, .splash').forEach(e => e.remove());
  });
  await page.waitForTimeout(1000);

  // Click New Project
  await page.click('text="New project"', { force: true });
  await page.waitForTimeout(1000);

  // Click first driver
  await page.click('.driver-list-row', { force: true });
  await page.waitForTimeout(1000);

  // Click Next
  await page.click('button:has-text("Next")', { force: true });
  await page.waitForTimeout(1000);

  // Click Accept
  await page.click('button:has-text("Accept")', { force: true });
  await page.waitForTimeout(1000);

  // Switch to PR tab if available
  await page.evaluate(() => {
    const boxSelect = document.querySelector('select'); // The box type select
    if (boxSelect) {
       boxSelect.value = 'passiveRadiator';
       boxSelect.dispatchEvent(new Event('change'));
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshot.png' });

  // Switch to Advanced tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('li'));
    const adv = tabs.find(t => t.textContent.includes('Advanced'));
    if (adv) adv.click();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshot_adv.png' });

  // Switch to Signal tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('li'));
    const sig = tabs.find(t => t.textContent.includes('Signal'));
    if (sig) sig.click();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshot_sig.png' });

  await browser.close();
})();
