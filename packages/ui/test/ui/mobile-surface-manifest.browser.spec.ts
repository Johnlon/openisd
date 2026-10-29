import {expect,test,openAMobileProject,COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {MOBILE_SURFACES,MobileRoute} from '../fixtures/mobileSurfaceManifest.js';
import {openMobileSurface,assertMobileSurface} from '../fixtures/mobileSurfaceNavigation.js';

for(const surface of MOBILE_SURFACES.filter(surface=>surface.route!==MobileRoute.Manual)){
  test('manifest visit: '+surface.id+' — '+surface.title,async({page},testInfo)=>{
    await page.setViewportSize({width:374,height:705});await forceMobileSkin(page);await page.goto('/');
    await openAMobileProject(page,COMPLETE_DRIVER_PROJECT_OWPR);
    const start=performance.now();await openMobileSurface(page,surface);await assertMobileSurface(page,surface);
    await expect(page.locator('.app-root-mobile')).toHaveCount(1);
    await testInfo.attach('mobile-surface-visit',{body:JSON.stringify({id:surface.id,visited:true,elapsedMs:performance.now()-start,viewport:page.viewportSize(),checks:['visible-root','mobile-skin'],conformance:false}),contentType:'application/json'});
  });
}
