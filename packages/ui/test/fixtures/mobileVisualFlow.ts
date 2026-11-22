import type {MobileSurface} from './mobileSurfaceManifest.js';
import {mobileSurfaceIdentity} from './mobileSurfaceIdentity.js';
export enum VisualChapter {Wizard='wizard',Projects='projects',Views='views',Drivers='drivers',Settings='settings',Help='help',Shared='shared'}
export interface VisualGroup {id:string;title:string;surfaces:MobileSurface[]}
export interface VisualSection {id:VisualChapter;title:string;groups:VisualGroup[]}
const titles:Record<VisualChapter,string>={
 [VisualChapter.Wizard]:'Project Creation Wizard',[VisualChapter.Projects]:'Manage Projects',[VisualChapter.Views]:'Project Views',[VisualChapter.Drivers]:'Manage Drivers',[VisualChapter.Settings]:'Settings and Cloud',[VisualChapter.Help]:'Help and Recovery',[VisualChapter.Shared]:'Shared Interactions',
};
const groupNames:Record<string,string>={
 'projects/new/closed-box':'Closed box project','projects/new/vented':'Vented project','projects/new/passive-radiator':'Passive radiator project','projects/new/bandpass-4th-order':'Fourth-order bandpass project','projects/new/bandpass-6th-order':'Sixth-order bandpass project','projects/new/abc':'ABC project','projects/new/help':'Wizard help and information',
 'projects/library':'Project library and Bin','projects/import':'Project Import','projects/export':'Project Export','projects/conflicts':'Project conflicts','projects/details':'Project details','projects/empty-state':'No project open',
 'driver/overview':'Driver tab','driver/project':'Project driver information and selection','driver/library':'Driver library','driver/search':'Driver search and filters','driver/editor':'Driver Editor','driver/import':'Driver Import','driver/export':'Driver Export',
 'enclosure/closed-box':'Closed box and chamber losses','enclosure/vented':'Vented box and chamber losses','enclosure/passive-radiator':'Passive radiator and chamber losses','enclosure/bandpass-4th-order':'Fourth-order bandpass and chamber losses','enclosure/bandpass-6th-order':'Sixth-order bandpass and chamber losses','enclosure/abc':'ABC and chamber losses',
 'signal/overview':'Signal tab','signal/filters':'Filters tab and filter types','results/charts':'Graph and chart types','results/tune':'Tune','results/what-if':'What-if','results/tuning':'Port editor',
 'settings/project':'Project environment and simulation','settings/options':'App Options','settings/cloud':'Cloud account, activity and conflicts','help/sections':'Section help','help/compatibility':'OpenISD and WinISD differences','help/about':'About and change log','help/announcements':'Announcements','help/diagnostics':'Diagnostics','help/recovery':'Recovery','help/updates':'Updates','shared/fields':'Field warnings','shared/messages':'Confirmation messages','shared/browser':'Browser and OS controls','navigation/main-menu':'Main menu',
};
const wizardBoxes=new Set(['closed-box','vented','passive-radiator','bandpass-4th-order','bandpass-6th-order','abc']);
export function mobileVisualFlow(surfaces:readonly MobileSurface[]):VisualSection[]{
 const sections:VisualSection[]=Object.values(VisualChapter).map(id=>({id,title:titles[id],groups:[]}));
 for(const surface of surfaces){
  const identity=mobileSurfaceIdentity(surface),parts=identity.path.split('/');
  let chapter:VisualChapter;
  if(parts[0]==='projects')chapter=parts[1]==='new'?VisualChapter.Wizard:VisualChapter.Projects;
  else if(parts[0]==='driver')chapter=['editor','library','search','import','export'].includes(parts[1])?VisualChapter.Drivers:VisualChapter.Views;
  else if(['enclosure','signal','results'].includes(parts[0]))chapter=VisualChapter.Views;
  else if(parts[0]==='settings')chapter=VisualChapter.Settings;
  else if(parts[0]==='help')chapter=VisualChapter.Help;
  else chapter=VisualChapter.Shared;
  const key=chapter===VisualChapter.Wizard?'projects/new/'+(wizardBoxes.has(parts[2])?parts[2]:'help'):parts.slice(0,2).join('/');
  const section=sections.find(section=>section.id===chapter);if(!section)throw new Error('Missing catalogue chapter '+chapter);
  let group=section.groups.find(group=>group.id===key);
  if(!group){const title=groupNames[key];if(!title)throw new Error('Missing catalogue group '+key);group={id:key,title,surfaces:[]};section.groups.push(group);}
  group.surfaces.push(surface);
 }
 // Functional entry points are shown before their subsidiary dialogs, independent of declaration order.
 const priorities=['projects/empty-state','projects/library','projects/import','projects/export','projects/details','projects/conflicts','driver/overview','driver/project','driver/library','driver/search','driver/import','driver/editor','driver/export'];
 for(const section of sections)section.groups.sort((a,b)=>{const rank=(key:string)=>{const index=priorities.indexOf(key);return index<0?priorities.length:index;};return rank(a.id)-rank(b.id);});
 return sections;
}
