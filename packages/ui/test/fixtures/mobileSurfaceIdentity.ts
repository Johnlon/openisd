import {MobileRoute,type MobileSurface} from './mobileSurfaceManifest.js';
export interface MobileViewIdentity {path:string;title:string;legacyId:string;notes?:string}
const boxNames:Record<string,{key:string;title:string}>={
 sealed:{key:'closed-box',title:'Closed box'},vented:{key:'vented',title:'Vented box'},'box-passive-radiator':{key:'passive-radiator',title:'Passive radiator'},bandpass4:{key:'bandpass-4th-order',title:'Fourth-order bandpass'},bandpass6:{key:'bandpass-6th-order',title:'Sixth-order bandpass'},abc:{key:'abc',title:'ABC'},
};
const steps:Record<string,{key:string;title:string}>={'1':{key:'choose-driver',title:'Select driver'},'2':{key:'driver-array',title:'Driver count and placement'},'3':{key:'enclosure-type',title:'Enclosure type'},'4':{key:'enclosure-details',title:'Enclosure details'},'5':{key:'project-details',title:'Project details'}};
const named:Record<string,string>={
 'project-import':'projects/import/file','driver-import':'driver/import/file','tab-driver':'driver/overview','tab-signal':'signal/overview','tab-filters':'signal/filters/overview','tab-graph':'results/charts/overview',
 'menu-project-details':'projects/details','menu-advanced':'settings/project/environment-and-simulation','menu-manage-drivers':'driver/library/overview','menu-projects':'projects/library/overview',
 'menu-diagnosticsmodal':'help/diagnostics/overview','menu-splashmodal':'help/about/overview','menu-announcementsmodal':'help/announcements/archive','menu-winisddifferencesmodal':'help/compatibility/differences',
 'driver-info':'driver/project/information','driver-picker':'driver/project/select','empty':'projects/empty-state','menu':'navigation/main-menu',
 'bin':'projects/library/bin','project-actions':'projects/library/actions','sealed-alignment':'enclosure/closed-box/alignment','vented-alignment':'enclosure/vented/alignment',
 'pr-picker':'enclosure/passive-radiator/select','pr-save':'enclosure/passive-radiator/save-to-library','chart-picker':'results/charts/choose','chart-data':'results/charts/data-table','sheet-port':'results/tuning/port-editor',
 'driver-summary-manage':'driver/library/information','driver-summary-pick':'projects/new/driver-information','driver-search-filters':'driver/search/filters','driver-storage-error':'driver/library/unreadable-storage',
 'driver-more':'driver/editor/actions','driver-export':'driver/export/format','driver-identity':'driver/editor/missing-identity','driver-rename':'driver/editor/rename-or-copy','driver-save':'driver/library/save','equations':'driver/editor/provenance','driver-dq':'driver/editor/disagreements',
 'field-dq':'shared/fields/warning-details','options-limits-help':'settings/options/design-limits/help','exports':'projects/export/formats',
 'wizard-placement':'projects/new/placement-information','wizard-ebp':'projects/new/ebp-information','wizard-help':'projects/new/step-help','section-help':'help/sections/popup',
 'cloud':'settings/cloud/account-and-activity','cloud-confirm':'settings/cloud/conflict-resolution','confirmation':'shared/messages/confirmation','announcements-current':'help/announcements/current',
 'diagnostic-repairs':'help/diagnostics/repair-results','crash':'help/recovery/runtime-error','startup-failure':'help/recovery/startup-error','storage-usage':'help/recovery/storage-warning','update':'help/updates/available','cross-tab':'projects/conflicts/another-tab',
 'about-version':'help/about/version-and-change-log','refresh':'help/recovery/refresh',
 'native-files':'shared/browser/file-picker-and-download','native-select':'shared/browser/select-menu','native-colour':'shared/browser/colour-picker','native-keyboard':'shared/browser/keyboard-and-selection','native-title':'shared/browser/tooltip',
};
const slug=(value:string)=>value.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase().replace(/[^a-z0-9-]+/g,'-');
/** Stable task/parent/state identity; legacy IDs remain the evidence/comment boundary. */
export function mobileSurfaceIdentity(surface:MobileSurface):MobileViewIdentity{
 let path=named[surface.id],title=surface.title,notes:string|undefined;
 const box=surface.box?boxNames[surface.box]:undefined;
 if(surface.box&&!box)throw new Error('Unknown enclosure identity: '+surface.box);
 if(box&&surface.id.startsWith('wizard-')){
  const step=steps[surface.parameter??''];if(!step)throw new Error('Unknown wizard step: '+surface.id);
  path='projects/new/'+box.key+'/'+step.key;title='New '+box.title+' project — '+step.title;
  if(['1','2'].includes(surface.parameter??''))notes='The enclosure has not been chosen yet. This image represents the '+box.title+' creation path; early steps are shared across enclosure types.';
 }else if(box&&surface.route===MobileRoute.Losses){path='enclosure/'+box.key+'/losses/'+slug(surface.chamber??'rear');title=box.title+' — '+surface.chamber+' chamber losses';}
 else if(box&&surface.route===MobileRoute.Tab){path='enclosure/'+box.key+'/overview';title=box.title;}
 else if(box&&surface.route===MobileRoute.Sheet)path='results/'+slug(surface.parameter??'')+'/'+box.key;
 else if(surface.route===MobileRoute.Editor)path='driver/editor/'+slug(surface.parameter??'');
 else if(surface.route===MobileRoute.Options)path='settings/options/'+slug(surface.parameter??'');
 else if(surface.route===MobileRoute.Filter)path='signal/filters/'+slug(surface.id.slice('filter-'.length));
 else if(!path&&surface.id.startsWith('chart-'))path='results/charts/'+slug(surface.parameter??surface.id.slice('chart-'.length));
 if(!path)throw new Error('Missing logical view identity: '+surface.id);
 return {path,title,legacyId:surface.id,...(notes?{notes}:{})};
}
