import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 768 });
  
  await page.goto('http://localhost:4000/');
  await page.waitForTimeout(2000);
  
  await page.waitForTimeout(1000);
  
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.waitForTimeout(500);
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await page.waitForTimeout(1000);
  
  await page.locator('.de-tab', { hasText: 'Parameters' }).first().click();
  await page.waitForTimeout(1000);
  
  const styles = await page.evaluate(() => {
    const cols = document.querySelector('.de-cols');
    const fld = document.querySelector('.de-fld');
    
    return {
      cols: cols ? {
        display: window.getComputedStyle(cols).display,
        gridTemplateColumns: window.getComputedStyle(cols).gridTemplateColumns,
        gap: window.getComputedStyle(cols).gap
      } : 'not found',
      fld: fld ? {
        display: window.getComputedStyle(fld).display,
        flexDirection: window.getComputedStyle(fld).flexDirection,
        alignItems: window.getComputedStyle(fld).alignItems
      } : 'not found'
    };
  });
  
  console.log('COMPUTED STYLES:', JSON.stringify(styles, null, 2));
  
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
