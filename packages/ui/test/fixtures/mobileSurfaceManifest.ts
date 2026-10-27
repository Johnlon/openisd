import {PHONE_FILTER_CHIPS} from '@openisd/design/fields';
import {TABS} from '@openisd/design/chart';
/** One declared mobile-surface list for inspection, navigation and conformance checks. */
export enum MobileSurfaceKind {Page='page', Popup='popup', Sheet='sheet', Menu='menu', Wizard='wizard', Help='help', System='system'}
export enum MobileRoute {Tab='tab', Menu='menu', Editor='editor', Options='options', Losses='losses', Sheet='sheet', Filter='filter', DriverInfo='driver-info', DriverBrowser='driver-browser', Manual='manual'}
export interface MobileSurface {
  readonly id:string;
  readonly title:string;
  readonly kind:MobileSurfaceKind;
  readonly owner:string;
  readonly instructions:string;
  readonly root:string;
  readonly route:MobileRoute;
  readonly parameter?:string;
  readonly box?:string;
  readonly chamber?:string;
  readonly numericAppearance?:boolean;
  readonly notes?:string;
}
const mobile='packages/ui/src/ui/shells/mobile/';
const shared='packages/ui/src/ui/components/';
export const MOBILE_BOX_VARIANTS=['sealed','vented','box-passive-radiator','bandpass4','bandpass6','abc'] as const;
const rows:MobileSurface[]=[];
function add(id:string,title:string,kind:MobileSurfaceKind,owner:string,instructions:string,root:string,route=MobileRoute.Manual,extra:Partial<MobileSurface>={}):void{
  rows.push({id,title,kind,owner,instructions,root,route,...extra});
}
for(const box of MOBILE_BOX_VARIANTS){
  add('box-'+box,'Box — '+box,MobileSurfaceKind.Page,mobile+'MobileBoxTab.vue','Open Box and choose '+box,'.mob-content',MobileRoute.Tab,{parameter:'Box',box,numericAppearance:true});
  for(const chamber of ['bandpass4','bandpass6','abc'].includes(box)?['Rear','Front']:['Rear'])add('losses-'+box+'-'+chamber,'Box losses — '+box+' '+chamber,MobileSurfaceKind.Popup,mobile+'MobileBoxTab.vue','Box → '+box+' → '+chamber+' chamber → Box losses','.mob-align-sheet',MobileRoute.Losses,{box,chamber,numericAppearance:true});
  for(const parameter of ['Tune','What-if'])add(parameter.toLowerCase()+'-'+box,parameter+' — '+box,MobileSurfaceKind.Sheet,mobile+'MobileSheet.vue','Choose '+box+' on Box; Graph → '+parameter,'.mob-sheet',MobileRoute.Sheet,{box,parameter,numericAppearance:true});
  for(let step=1;step<=5;step++)add('wizard-'+box+'-'+step,'New project — '+box+' — step '+step,MobileSurfaceKind.Wizard,mobile+'MobileNewProject.vue','New project → step '+step+'; select '+box+' at enclosure step','.mob-np-overlay',MobileRoute.Manual,{box,parameter:String(step),notes:'PR path must include valid radiator selection before finishing.'});
}
for(const parameter of ['Driver','Signal','Filters','Graph'])add('tab-'+parameter.toLowerCase(),parameter,MobileSurfaceKind.Page,mobile+'Mobile'+(parameter==='Graph'?'ChartView':parameter+'Tab')+'.vue','Tap '+parameter,'.mob-content',MobileRoute.Tab,{parameter});
for(const parameter of ['General','Parameters','Advanced','Dimensions'])add('editor-'+parameter.toLowerCase(),'Driver Editor — '+parameter,MobileSurfaceKind.Popup,shared+'DriverEditorModal.vue','Driver → Edit → '+parameter,'.de-modal',MobileRoute.Editor,{parameter,numericAppearance:parameter!=='General'});
for(const parameter of ['General','Plot Window','Your data'])add('options-'+parameter.toLowerCase().replaceAll(' ','-'),'Options — '+parameter,MobileSurfaceKind.Popup,shared+'OptionsModal.vue','Menu → Options → '+parameter,'.opt-phone',MobileRoute.Options,{parameter,numericAppearance:parameter==='General'});
for(const [parameter,title,owner] of [['Project details','Project details','MobileProjectTab.vue'],['Advanced','Advanced','MobileAdvancedTab.vue'],['Manage Drivers','Manage Drivers','MobileManageDriversTab.vue'],['Projects','Projects','MobileProjectsPane.vue']])add('menu-'+parameter.toLowerCase().replaceAll(' ','-'),title,MobileSurfaceKind.Popup,mobile+owner,'Menu → '+parameter,'.mob-dlg',MobileRoute.Menu,{parameter});
for(const [parameter,title,owner,root] of [['Diagnostics','Diagnostics','DiagnosticsModal.vue','.mob-dlg'],['About OpenISD','About OpenISD','SplashModal.vue','.sp'],['Announcements','Announcements list','AnnouncementsModal.vue','.ann-modal'],['OpenISD and WinISD differences','WinISD differences','WinisdDifferencesModal.vue','.mob-dlg']])add('menu-'+owner.replace('.vue','').toLowerCase(),title,MobileSurfaceKind.Popup,shared+owner,'Menu → '+parameter,root,MobileRoute.Menu,{parameter});
add('driver-info','Current project driver information',MobileSurfaceKind.Popup,shared+'DriverBrowser.vue','Driver → Info','.wb-modal .preview',MobileRoute.DriverInfo);
add('driver-picker','Select driver for project',MobileSurfaceKind.Popup,shared+'DriverBrowser.vue','Driver → Select driver','.wb-modal',MobileRoute.DriverBrowser);
const minor:[string,string,string,string][]=[
 ['empty','No project open','MobileShell.vue','Close the last open project'],['menu','Main menu','MobileShell.vue','Tap Menu'],
 ['bin','Project Bin','MobileProjectsPane.vue','Projects → Bin'],['project-actions','Project action sheet','MobileProjectsPane.vue','Projects → row menu'],
 ['sealed-alignment','Closed-box alignment','MobileBoxTab.vue','Box → Closed → Choose alignment'],['vented-alignment','Vented alignment','MobileBoxTab.vue','Box → Vented → Choose alignment'],
 ['pr-picker','Passive radiator picker','MobileBoxTab.vue','Box → Passive radiator → Select PR'],['pr-save','Save passive radiator','MobileBoxTab.vue','Passive radiator → Save to library'],
 ['chart-picker','Chart picker','MobileChartView.vue','Graph → chart selector'],['chart-data','Chart data table','ChartDataDialog.vue','Graph → Data'],
 ['sheet-port','Tune/What-if port editor','MobileSheet.vue','Graph → Tune or What-if → port value'],
 ['driver-summary-manage','Driver library summary — Manage','DriverLibrary.vue','Manage Drivers → driver row'],['driver-summary-pick','Wizard driver summary — Pick','DriverLibrary.vue','New project → driver row'],
 ['driver-search-filters','Driver search filters','DriverLibrary.vue','Driver picker → Filters'],['driver-storage-error','Unreadable saved drivers blocker','DriverBrowser.vue','Open driver browser with unreadable saved-driver storage'],
 ['driver-more','Driver Editor More menu','DriverEditorModal.vue','Driver → Edit → More'],['driver-export','Choose driver export format','DriverEditorModal.vue','Driver Editor → More → Export'],
 ['driver-identity','Driver identity message','DriverEditorModal.vue','Save a driver with incomplete identity'],['driver-rename','Rename or copy driver','DriverEditorModal.vue','Rename an existing driver while saving'],
 ['driver-save','Save to My Drivers','SaveToLibraryDialog.vue','Driver Editor → Save to My Drivers'],['equations','Equation/provenance inspector','EquationInspectorModal.vue','Driver Editor → provenance inspection → field'],
 ['driver-dq','Driver disagreement list','DriverEditorModal.vue','Driver Editor → disagreements'],['field-dq','Field DQ/refusal explanation','UIFieldBody.vue','Tap a field warning or enter a refused value'],
 ['options-limits-help','Vented design limits explanation','OptionsModal.vue','Options → General → limits explanation'],['exports','Project export menu','ExportMenu.vue','Menu → Save As / Export'],
 ['wizard-placement','Wizard placement information','MobileNewProject.vue','New project → Driver Array → placement info'],['wizard-ebp','Wizard EBP information','MobileNewProject.vue','New project → Enclosure → EBP info'],
 ['wizard-help','Wizard step help','WizardHelpSheet.vue','New project → any step → Help'],['section-help','Section help popup','PhoneHelpSheet.vue','Tap any section-band ?'],
 ['cloud','Cloud sync/account/activity/conflicts','CloudSyncDialog.vue','Menu → Cloud sync; configured account required'],['cloud-confirm','Cloud conflict confirmation','CloudSyncDialog.vue','Cloud sync → conflict → choose action'],
 ['confirmation','Shared confirmation dialog','ConfirmDialog.vue','Perform an action requiring confirmation'],['announcements-current','Current announcement','AnnouncementsModal.vue','Launch with a new announcement version'],
 ['diagnostic-repairs','Diagnostics repair outcomes','DiagnosticsModal.vue','Diagnostics → repair action'],['crash','Crash/report screen','CrashScreen.vue','A captured runtime error opens this view'],
 ['startup-failure','Startup loading failure','App.vue','A bundle/module fails before app start'],['storage-usage','Storage usage warning and data download','App.vue','Startup storage usage warning'],
 ['update','App update offer/recovery','App.vue','Receive a new installed app version'],['cross-tab','Project changed in another tab','App.vue','Another browser tab modifies an open project'],
 ['about-version','About version/change log','SplashModal.vue','About OpenISD → Change log'],['refresh','Installed-app refresh/recovery','App.vue','Open /about/refresh/'],
 ['native-files','Native file picker/download UI','MobileShell.vue','Import/open/export a file; browser/OS owned'],['native-select','Native select menu','MobileShell.vue','Open a dropdown; browser/OS owned'],['native-colour','Native colour picker','OptionsModal.vue','Options → Plot Window → colour; browser/OS owned'],
 ['native-keyboard','Numeric/text keyboard, caret and selection menu','MobileShell.vue','Tap an editable field; browser/OS owned'],['native-title','Native tooltip/title','UIFieldBody.vue','Hover a titled control; browser/OS owned'],
 ];
for(const [id,title,owner,instructions] of minor)add(id,title,MobileSurfaceKind.Popup,(owner==='App.vue'?'packages/ui/src/ui/':owner.startsWith('Mobile')||owner==='PhoneHelpSheet.vue'?mobile:shared)+owner,instructions,'',MobileRoute.Manual,{notes:'Declared source family; not a claim of runtime visit or conformance.'});
add('project-import','Project Import',MobileSurfaceKind.Menu,mobile+'MobileShell.vue','Menu → Open a file. The following file picker belongs to the browser/OS.','.mob-menu-overlay');
add('driver-import','Driver Import',MobileSurfaceKind.Menu,shared+'DriverEditorModal.vue','Driver Editor → More → Import. The following file picker belongs to the browser/OS.','.de-more-menu');
for(const filter of PHONE_FILTER_CHIPS)add('filter-'+filter.type,'Filter card — '+filter.short,MobileSurfaceKind.Page,mobile+'MobileFilterCard.vue','Filters → + '+filter.short,'.mob-fcard',MobileRoute.Filter,{parameter:'+ '+filter.short,numericAppearance:true});
for(const chart of TABS)add('chart-'+chart.id,'Chart — '+chart.name,MobileSurfaceKind.Page,mobile+'MobileChartView.vue','Graph → chart picker → '+chart.name,'.mob-chart-view',MobileRoute.Manual,{parameter:chart.id,notes:'Availability depends on enclosure and engine capabilities; chart data/selection/help are separate surfaces.'});
export const MOBILE_SURFACES:readonly MobileSurface[]=Object.freeze(rows);

