import {MOBILE_BOX_VARIANTS,MobileRoute,type MobileSurface} from './mobileSurfaceManifest.js';
export enum MobileFlowChapter {Start='start',Driver='driver',Box='box',Signal='signal',Results='results',Settings='settings',Help='help',Shared='shared'}
export interface MobileFlowGroup {id:string;title:string;surfaces:MobileSurface[]}
export interface MobileFlowSection {id:MobileFlowChapter;title:string;description:string;groups:MobileFlowGroup[]}
const chapters:Record<MobileFlowChapter,{title:string;description:string}>={
 [MobileFlowChapter.Start]:{title:'Start and manage a project',description:'Launch, open or create a project, then name, save and export it.'},
 [MobileFlowChapter.Driver]:{title:'Choose and edit the driver',description:'Inspect the project driver, select a replacement, edit its parameters and manage the driver library.'},
 [MobileFlowChapter.Box]:{title:'Design the enclosure',description:'Each enclosure type is followed by its chamber-loss dialogs. Alignment and passive-radiator controls follow.'},
 [MobileFlowChapter.Signal]:{title:'Set the signal and filters',description:'Set the amplifier drive, then add and adjust each filter family.'},
 [MobileFlowChapter.Results]:{title:'View results, tune and compare',description:'Choose a chart, inspect its data, then use Tune or What-if for each enclosure type.'},
 [MobileFlowChapter.Settings]:{title:'Adjust settings and manage data',description:'Project environment, app preferences, storage and cloud sync, including conflicts.'},
 [MobileFlowChapter.Help]:{title:'Get help and recover',description:'About, announcements, compatibility explanations, diagnostics, startup and update recovery.'},
 [MobileFlowChapter.Shared]:{title:'Shared interactions',description:'Warnings, confirmations and browser-owned input controls used throughout the app.'},
};
const boxNames:Record<typeof MOBILE_BOX_VARIANTS[number],string>={sealed:'Closed box',vented:'Vented box','box-passive-radiator':'Passive radiator',bandpass4:'Fourth-order bandpass',bandpass6:'Sixth-order bandpass',abc:'ABC'};
/** Presentation order only: original IDs, navigation and evidence stay unchanged. */
export function mobileSurfaceFlow(surfaces:readonly MobileSurface[]):MobileFlowSection[]{
 const flow:MobileFlowSection[]=Object.values(MobileFlowChapter).map(id=>({id,...chapters[id],groups:[]}));
 const assigned=new Set<string>();
 function group(chapter:MobileFlowChapter,id:string,title:string,match:(surface:MobileSurface)=>boolean):void{
  const entries=surfaces.filter(match);
  for(const surface of entries){if(assigned.has(surface.id))throw new Error('Duplicate flow placement: '+surface.id);assigned.add(surface.id);}
  if(entries.length)flow.find(section=>section.id===chapter)?.groups.push({id,title,surfaces:entries});
 }
 function ids(chapter:MobileFlowChapter,id:string,title:string,keys:readonly string[]):void{
  group(chapter,id,title,surface=>keys.includes(surface.id));
 }
 ids(MobileFlowChapter.Start,'launch','Launch and navigation',['empty','menu']);
 ids(MobileFlowChapter.Start,'projects','Open, organise and describe projects',['menu-projects','bin','project-actions','menu-project-details']);
 for(const box of MOBILE_BOX_VARIANTS)ids(MobileFlowChapter.Start,'wizard-'+box,'New project — '+boxNames[box],[1,2,3,4,5].map(step=>'wizard-'+box+'-'+step));
 ids(MobileFlowChapter.Start,'wizard-information','Wizard information and driver summary',['driver-summary-pick','wizard-placement','wizard-ebp','wizard-help']);
 ids(MobileFlowChapter.Start,'project-export','Save and export',['project-import','exports']);
 ids(MobileFlowChapter.Driver,'project-driver','Current project driver',['tab-driver','driver-info']);
 ids(MobileFlowChapter.Driver,'choose-driver','Select and search for a driver',['driver-picker','driver-search-filters','driver-storage-error']);
 group(MobileFlowChapter.Driver,'driver-editor','Driver Editor tabs',surface=>surface.route===MobileRoute.Editor);
 ids(MobileFlowChapter.Driver,'driver-editor-actions','Driver Editor actions and explanations',['driver-more','driver-import','driver-export','driver-identity','driver-rename','driver-save','equations','driver-dq']);
 ids(MobileFlowChapter.Driver,'driver-library','Manage the driver library',['menu-manage-drivers','driver-summary-manage']);
 for(const box of MOBILE_BOX_VARIANTS)ids(MobileFlowChapter.Box,'enclosure-'+box,boxNames[box],['box-'+box,'losses-'+box+'-Rear','losses-'+box+'-Front']);
 ids(MobileFlowChapter.Box,'alignments','Choose an alignment',['sealed-alignment','vented-alignment']);
 ids(MobileFlowChapter.Box,'radiator-actions','Choose and save a passive radiator',['pr-picker','pr-save']);
 ids(MobileFlowChapter.Signal,'signal-input','Amplifier signal',['tab-signal']);
 ids(MobileFlowChapter.Signal,'filters','Filter list',['tab-filters']);
 group(MobileFlowChapter.Signal,'filter-types','Filter cards',surface=>surface.route===MobileRoute.Filter);
 ids(MobileFlowChapter.Results,'graph','Graph, chart selection and data',['tab-graph','chart-picker','chart-data']);
 group(MobileFlowChapter.Results,'charts','Chart families',surface=>surface.id.startsWith('chart-')&&!['chart-picker','chart-data'].includes(surface.id));
 for(const mode of ['Tune','What-if'])group(MobileFlowChapter.Results,mode.toLowerCase(),mode+' — enclosure variants',surface=>surface.route===MobileRoute.Sheet&&surface.parameter===mode);
 ids(MobileFlowChapter.Results,'port-editor','Tune and What-if port editor',['sheet-port']);
 ids(MobileFlowChapter.Settings,'project-settings','Project environment and simulation',['menu-advanced']);
 group(MobileFlowChapter.Settings,'options','App Options tabs',surface=>surface.route===MobileRoute.Options);
 ids(MobileFlowChapter.Settings,'limits','Design-limit explanation',['options-limits-help']);
 ids(MobileFlowChapter.Settings,'cloud','Cloud account, activity and conflicts',['cloud','cloud-confirm']);
 ids(MobileFlowChapter.Help,'help-popups','Section help and compatibility explanations',['section-help','menu-winisddifferencesmodal']);
 ids(MobileFlowChapter.Help,'about','About, change log and announcements',['menu-splashmodal','about-version','menu-announcementsmodal','announcements-current']);
 ids(MobileFlowChapter.Help,'diagnostics','Diagnostics and repairs',['menu-diagnosticsmodal','diagnostic-repairs']);
 ids(MobileFlowChapter.Help,'recovery','Startup, storage, updates and recovery',['startup-failure','crash','storage-usage','update','cross-tab','refresh']);
 ids(MobileFlowChapter.Shared,'messages','Field warnings and confirmation dialogs',['field-dq','confirmation']);
 ids(MobileFlowChapter.Shared,'browser-controls','Browser and OS controls',['native-files','native-select','native-colour','native-keyboard','native-title']);
 const missing=surfaces.filter(surface=>!assigned.has(surface.id));
 if(missing.length)throw new Error('Missing flow placement: '+missing.map(surface=>surface.id).join(', '));
 return flow;
}
