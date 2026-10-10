import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set localStorage to bypass splash if needed
  await page.goto('http://localhost:4000/');
  await page.evaluate(() => {
    localStorage.setItem('openisd-splash-v1', 'true');
    localStorage.setItem('openisd-seen-splash', 'true');
    localStorage.setItem('splashSeen', 'true');
  });
  
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(1000);
  
  // Click "New project"
  const newProjBtn = await page.$('text="New project"');
  if (newProjBtn) {
    await newProjBtn.click();
    await page.waitForTimeout(500);
  }
  
  // Click first driver
  const firstDriver = await page.$('.driver-list-row');
  if (firstDriver) {
    await firstDriver.click();
    await page.waitForTimeout(500);
    const nextBtn = await page.$('text="Next"');
    if (nextBtn) await nextBtn.click();
    await page.waitForTimeout(500);
    const acceptBtn = await page.$('text="Accept"');
    if (acceptBtn) await acceptBtn.click();
    await page.waitForTimeout(500);
  }

  // Click Advanced tab
  const advTab = await page.$('li:has-text("Advanced")');
  if (advTab) await advTab.click();
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: 'screenshot_adv.png' });
  
  // Dump some HTML
  const advHtml = await page.evaluate(() => {
    const el = document.querySelector('.adv-two-col');
    return el ? el.outerHTML : 'no adv';
  });
  fs.writeFileSync('adv.html', advHtml);

  await browser.close();
})();
