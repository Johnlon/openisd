import type {Page} from '@playwright/test';
import {expect} from '../fixtures.js';
import {PhoneBoxText} from '@openisd/design/fields';
import {tapMobileMenuItem} from './mobileSkin.js';
import {MobileRoute,type MobileSurface} from './mobileSurfaceManifest.js';
/** Real UI navigation only. Each caller supplies a freshly imported project. */
export async function openMobileSurface(page:Page,surface:MobileSurface):Promise<void>{
  const tab=async(label:string)=>page.locator('.mob-tab').filter({hasText:new RegExp('^'+label+'$')}).click();
  const box=async()=>{await tab('Box');await page.locator('#mob-box-type').selectOption(surface.box??'sealed');};
  switch(surface.route){
    case MobileRoute.Tab:
      await tab(surface.parameter??'Box');
      if(surface.box)await page.locator('#mob-box-type').selectOption(surface.box);
      return;
    case MobileRoute.Editor:
      await tab('Driver');await page.getByRole('button',{name:'Edit',exact:true}).click();
      await page.locator('.de-tabs').getByRole('button',{name:surface.parameter,exact:true}).click();return;
    case MobileRoute.Options:
      await tapMobileMenuItem(page,'Options');await page.locator('.opt-phone-tabs').getByRole('tab',{name:surface.parameter,exact:true}).click();return;
    case MobileRoute.Menu:
      await tapMobileMenuItem(page,surface.parameter??'');return;
    case MobileRoute.Losses:{
      await box();
      const group=page.locator('.mob-csection').filter({has:page.locator('.mob-band-title',{hasText:surface.chamber==='Front'?'Front chamber':'Rear chamber'})});
      await group.getByRole('button',{name:PhoneBoxText.BOX_LOSSES_LINK,exact:true}).click();return;
    }
    case MobileRoute.Sheet:
      await box();await tab('Graph');await page.getByRole('button',{name:'Open '+surface.parameter,exact:true}).click();return;
    case MobileRoute.DriverInfo:
      await tab('Driver');await page.getByRole('button',{name:'Info',exact:true}).click();return;
    case MobileRoute.DriverBrowser:
      await tab('Driver');await page.getByRole('button',{name:'Select driver',exact:true}).click();return;
    case MobileRoute.Filter:
      await tab('Filters');await page.getByRole('button',{name:surface.parameter,exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:surface.parameter,exact:true}).click();return;
    case MobileRoute.Manual:throw new Error('No automated navigation registered for '+surface.id);
  }
}
export async function assertMobileSurface(page:Page,surface:MobileSurface):Promise<void>{
  await expect(page.locator(surface.root)).toBeVisible();
}
