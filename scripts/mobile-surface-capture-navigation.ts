import type {Page} from '@playwright/test';
import {TABS,CHART_LABELS} from '@openisd/design/chart';
import {MobileRoute,type MobileSurface} from '../packages/ui/test/fixtures/mobileSurfaceManifest.js';
import {openMobileSurface} from '../packages/ui/test/fixtures/mobileSurfaceNavigation.js';
import {tapMobileMenuItem,openMobileMenu} from '../packages/ui/test/fixtures/mobileSkin.js';
const extra=new Set(['menu','project-import','driver-import','exports','bin','project-actions','sealed-alignment','vented-alignment','sheet-port','driver-more','driver-export','driver-save','driver-identity','driver-search-filters','driver-summary-manage','driver-summary-pick','wizard-placement','wizard-ebp','wizard-help','section-help','chart-picker','chart-data','confirmation','refresh','empty','pr-picker','pr-save','equations','options-limits-help','cloud']);
export function hasCaptureNavigation(surface:MobileSurface):boolean{return surface.route!==MobileRoute.Manual||extra.has(surface.id)||/^wizard-.+-[1-5]$/.test(surface.id)||!!surface.parameter&&surface.id.startsWith('chart-');}
async function tab(page:Page,name:string):Promise<void>{await page.locator('.mob-tab').filter({hasText:new RegExp('^'+name+'$')}).click();}
async function editor(page:Page):Promise<void>{await tab(page,'Driver');await page.getByRole('button',{name:'Edit',exact:true}).click();}
async function wizard(page:Page,step:number,box='sealed'):Promise<void>{
 await tapMobileMenuItem(page,'New project');await page.locator('.mob-np-overlay').waitFor();
 if(step===1)return;
 await page.locator('.driver-library input.filter').first().fill('Tang Band W5-1138SMF');
 await page.getByText('Tang Band W5-1138SMF',{exact:true}).first().click();
 const next=page.locator('.mob-np-footer').getByRole('button',{name:'Next ▸',exact:true});
 await next.click();if(step===2)return;await next.click();
 await page.locator('#np-box-type').selectOption(box);if(step===3)return;
 await next.click();if(step===4)return;
 if(box==='box-passive-radiator'&&await next.isDisabled()){await page.locator('#np-pr-select').click();await page.locator('.pr-lib-name').first().click();}
 await next.click();
}
export async function openCaptureSurface(page:Page,surface:MobileSurface):Promise<string>{
 if(surface.route!==MobileRoute.Manual){if(surface.id==='menu-announcementsmodal'){await openMobileMenu(page);const item=page.locator('.mob-menu-item').filter({hasText:'Announcements'});if(await item.count()===0)throw new Error('VIEW UNAVAILABLE: Announcements is absent in this build');await item.click();return surface.root;}if(surface.route===MobileRoute.DriverInfo){await tab(page,'Driver');if(await page.getByRole('button',{name:'Info',exact:true}).count()===0)throw new Error('VIEW UNAVAILABLE: the Info action is absent in this build');}await openMobileSurface(page,surface);return surface.root;}
 if(surface.id.startsWith('wizard-')&&surface.parameter){await wizard(page,Number(surface.parameter),surface.box);return '.mob-np-overlay';}
 if(surface.id.startsWith('chart-')&&surface.parameter){
  await tab(page,'Box');const key=surface.parameter;
  await page.locator('#mob-box-type').selectOption(key.startsWith('PR')?'box-passive-radiator':key.startsWith('Intra')?'abc':key.startsWith('Front')?'bandpass6':key.startsWith('Rear')?'vented':'sealed');
  await tab(page,'Graph');await page.locator('.mob-chart-pick').click();
  const chart=TABS.find(chart=>chart.id===key);if(!chart)throw new Error('Unknown chart '+key);
  await page.locator('.mob-chart-list').getByRole('button',{name:CHART_LABELS[chart.id],exact:true}).click();return '.mob-chart-view';
 }
 switch(surface.id){
  case 'empty':await openMobileMenu(page);await page.locator('.mob-open-project-close').first().click();return '.mobile-root';
  case 'pr-picker':case 'pr-save':await tab(page,'Box');await page.locator('#mob-box-type').selectOption('box-passive-radiator');await page.getByRole('button',{name:surface.id==='pr-picker'?'Select PR':'Save to library',exact:true}).click();return surface.id==='pr-picker'?'.pr-phone':'.save-lib-panel';
  case 'equations':await editor(page);await page.locator('.de-provenance-chk').filter({hasText:'Inspect Provenance'}).locator('input').click();return '.eq-inspector-card';
  case 'options-limits-help':await tapMobileMenuItem(page,'Options');await page.getByTestId('limits-more').click();return '[data-testid=limits-more-popup]';
  case 'cloud':if(await page.locator('.cloud-sync-badge').count()===0)throw new Error('VIEW UNAVAILABLE: cloud entry is not enabled in this build');await page.locator('.cloud-sync-badge').click();return '.cloud-sync-dialog';
  case 'menu':case 'project-import':await openMobileMenu(page);return '.mob-menu-overlay';
  case 'exports':await openMobileMenu(page);await page.locator('#btnExportMenu').click();return '.export-menu-list';
  case 'bin':await tapMobileMenuItem(page,'Projects');await page.locator('.mob-bin-toggle').click();return '.mob-projects-pane';
  case 'project-actions':await tapMobileMenuItem(page,'Projects');await page.locator('.mob-project-menu-btn').first().click();return '.mob-action-sheet';
  case 'sealed-alignment':case 'vented-alignment':await tab(page,'Box');await page.locator('#mob-box-type').selectOption(surface.id==='sealed-alignment'?'sealed':'vented');await page.locator('.mob-clink').filter({hasText:'Choose alignment'}).click();return '.mob-align-sheet';
  case 'sheet-port':await tab(page,'Box');await page.locator('#mob-box-type').selectOption('vented');await tab(page,'Graph');await page.getByRole('button',{name:'Open Tune',exact:true}).click();await page.locator('.mob-sheet-cell').filter({has:page.locator('.mob-sheet-label',{hasText:/^Port area$/})}).locator('input').click();return '.mob-sheet-port';
  case 'driver-more':case 'driver-import':case 'driver-export':case 'driver-save':case 'driver-identity':{
   await editor(page);
   if(surface.id==='driver-identity'){await page.locator('.de-tabs').getByRole('button',{name:'General',exact:true}).click();await page.locator('#de-text-brand').fill('');}
   await page.locator('.de-more').click();
   if(['driver-more','driver-import'].includes(surface.id))return '.de-more-menu';
   await page.getByRole('menuitem',{name:surface.id==='driver-save'?'Copy to My Drivers':'Export',exact:true}).click();
   return surface.id==='driver-export'?'.fmt-panel':surface.id==='driver-save'?'.save-lib-panel':'.de-id-panel';
  }
  case 'driver-search-filters':await tab(page,'Driver');await page.getByRole('button',{name:'Select driver',exact:true}).click();await page.locator('.dl-filters-toggle').click();return '.driver-library';
  case 'driver-summary-manage':await tapMobileMenuItem(page,'Manage Drivers');await page.locator('.driver-library input.filter').first().fill('Tang Band W5-1138SMF');await page.getByText('Tang Band W5-1138SMF',{exact:true}).first().click();return '.preview';
  case 'driver-summary-pick':await wizard(page,1);await page.locator('.driver-library input.filter').first().fill('Tang Band W5-1138SMF');await page.getByText('Tang Band W5-1138SMF',{exact:true}).first().click();return '.preview';
  case 'wizard-placement':await wizard(page,2);await page.getByRole('button',{name:'About driver placement',exact:true}).click();return '.mob-np-icard';
  case 'wizard-ebp':await wizard(page,3);await page.getByRole('button',{name:/About.*EBP/i}).click();return '.mob-np-icard';
  case 'wizard-help':await wizard(page,2);await page.getByRole('button',{name:'Help for this step',exact:true}).click();return '.mob-help-sheet';
  case 'section-help':await tab(page,'Driver');await page.locator('.mob-band button').first().click();return '.mob-help-sheet';
  case 'chart-picker':await tab(page,'Graph');await page.locator('.mob-chart-pick').click();return '.mob-chart-list';
  case 'chart-data':await tab(page,'Graph');await page.locator('.mob-chart-data').first().click();return '[role=dialog]';
  case 'confirmation':await tapMobileMenuItem(page,'Projects');await page.getByRole('button',{name:/Export all projects/}).click();return '.confirm-modal';
  case 'refresh':await page.goto(new URL('/about/refresh/',page.url()).href);return 'body';
  default:throw new Error('No capture navigation for '+surface.id);
 }
}
