import {MOBILE_SURFACES,MobileSurfaceKind} from './mobileSurfaceManifest.js';
import type {MobileSurface} from './mobileSurfaceManifest.js';
import {DESKTOP_SURFACES,DesktopRoute} from './desktopSurfaceManifest.js';
import type {DesktopSurface} from './desktopSurfaceManifest.js';
/**
 * The one typed index of every view and popup, both skins. Step 1 of T739: every row of the two
 * older manifests is carried over as a baseline. Those two files stay the source of the extra
 * fields (route, root selector, parameters); this index imports them and adds skin, kind, reach
 * and the design decision.
 */
export enum ViewSkin {Phone='phone', Desktop='desktop', Both='both'}
export enum ViewKind {Page='page', Tab='tab', Dialog='dialog', Menu='menu', Sheet='sheet', Wizard='wizard', WarningPopup='warning-popup', ErrorPopup='error-popup', FieldNote='field-note', InlineExpansion='inline-expansion', Help='help', Browser='browser', System='system'}
export type ViewDecision =
  | {readonly kind:'baseline'}
  | {readonly kind:'ruling'; readonly by:string; readonly date:string; readonly ref:string};
export interface ViewEntry {
  readonly id:string;
  readonly skin:ViewSkin;
  readonly kind:ViewKind;
  readonly owner:string;
  readonly reach:string;
  readonly decision:ViewDecision;
}
const BASELINE:ViewDecision={kind:'baseline'};
function mobileKind(kind:MobileSurfaceKind):ViewKind {
  switch(kind){
    case MobileSurfaceKind.Page: return ViewKind.Page;
    case MobileSurfaceKind.Popup: return ViewKind.Dialog;
    case MobileSurfaceKind.Sheet: return ViewKind.Sheet;
    case MobileSurfaceKind.Menu: return ViewKind.Menu;
    case MobileSurfaceKind.Wizard: return ViewKind.Wizard;
    case MobileSurfaceKind.Help: return ViewKind.Help;
    case MobileSurfaceKind.System: return ViewKind.System;
  }
}
function desktopKind(route:DesktopRoute):ViewKind {
  switch(route){
    case DesktopRoute.Bin: case DesktopRoute.Projects: return ViewKind.Page;
    case DesktopRoute.Chart: case DesktopRoute.Box: case DesktopRoute.Enclosure: case DesktopRoute.Tab: case DesktopRoute.Filter: case DesktopRoute.WhatIf: return ViewKind.Tab;
    case DesktopRoute.ProjectActions: case DesktopRoute.InfoMenu: case DesktopRoute.ChartPicker: case DesktopRoute.ProjectExport: case DesktopRoute.DriverExport: return ViewKind.Menu;
    case DesktopRoute.Wizard: return ViewKind.Wizard;
    case DesktopRoute.EditorHelp: return ViewKind.Help;
    case DesktopRoute.DataQuality: return ViewKind.FieldNote;
    case DesktopRoute.Library: case DesktopRoute.Picker: case DesktopRoute.PRPicker: case DesktopRoute.DriverInfo: return ViewKind.Browser;
    case DesktopRoute.Cloud: case DesktopRoute.ChartData: case DesktopRoute.Losses: case DesktopRoute.Editor: case DesktopRoute.Options: case DesktopRoute.Info:
    case DesktopRoute.ProjectImport: case DesktopRoute.DriverImport: case DesktopRoute.DriverSave: case DesktopRoute.PRSave: return ViewKind.Dialog;
  }
}
function fromMobile(surface:MobileSurface):ViewEntry {
  return {id:surface.id,skin:ViewSkin.Phone,kind:mobileKind(surface.kind),owner:surface.owner,reach:surface.instructions,decision:BASELINE};
}
function fromDesktop(surface:DesktopSurface):ViewEntry {
  return {id:surface.id,skin:ViewSkin.Desktop,kind:desktopKind(surface.route),owner:surface.owner,reach:surface.relationship,decision:BASELINE};
}
const JOHN_RULING:ViewDecision={kind:'ruling',by:'John',date:'2026-11-08',ref:'T739'};
const SHELL='packages/ui/src/ui/shells/original/OriginalShell.vue',WIZARD='packages/ui/src/ui/shells/original/OriginalNewProject.vue',LIST='packages/ui/src/ui/shells/original/OriginalProjectList.vue';
function ruled(id:string,kind:ViewKind,owner:string,reach:string):ViewEntry {
  return {id,skin:ViewSkin.Desktop,kind,owner,reach,decision:JOHN_RULING};
}
const PH='packages/ui/src/ui/shells/mobile/';
function phoneRuled(id:string,kind:ViewKind,owner:string,reach:string):ViewEntry {
  return {id,skin:ViewSkin.Phone,kind,owner:PH+owner,reach,decision:JOHN_RULING};
}
const CMP='packages/ui/src/ui/components/';
function sharedRuled(id:string,kind:ViewKind,owner:string,reach:string):ViewEntry {
  return {id,skin:ViewSkin.Both,kind,owner,reach,decision:JOHN_RULING};
}
/** John, 8 Nov 2026 (T739): warning and error popups, field notes and inline sections are views. Found by the source scan, absent from the older manifests. */
const RULED_VIEWS:readonly ViewEntry[]=[
  ruled('desktop/difference-cue',ViewKind.FieldNote,SHELL,'Click the ≠W Difference cue by a control, chart or filter editor: a popup says what WinISD does instead.'),
  ruled('desktop/projects/close-unsaved',ViewKind.WarningPopup,SHELL,'Close a project with unsaved changes: a dialog offers Save, Discard or Cancel.'),
  ruled('desktop/enclosure/sealed-alignment',ViewKind.Dialog,SHELL,'Box tab, closed box: press Alignment.'),
  ruled('desktop/enclosure/vented-alignment',ViewKind.Dialog,SHELL,'Box tab, vented box: press Alignment.'),
  ruled('desktop/enclosure/tuning-unreachable-warning',ViewKind.WarningPopup,SHELL,'Vented box whose target tuning cannot be reached: a red message appears under the field.'),
  ruled('desktop/enclosure/response-model-pending-notice',ViewKind.WarningPopup,SHELL,'Open a box type the engine does not model yet: a Response model pending notice replaces the curve and shows on the Box tab.'),
  ruled('desktop/results/chart-unavailable-notice',ViewKind.ErrorPopup,SHELL,'Pick a chart the engine cannot draw: the graph shows This chart isn\'t available in the engine yet.'),
  ruled('desktop/help/tab-help-panel',ViewKind.Help,SHELL,'Press the ? button on the save rail, or a section help button: a help panel opens.'),
  ruled('desktop/cloud/update-strip',ViewKind.WarningPopup,SHELL,'A newer app version is available: a strip appears under the toolbar.'),
  ruled('desktop/cloud/reconnect-strip',ViewKind.WarningPopup,SHELL,'Cloud sync needs the user to reconnect: a strip appears under the toolbar.'),
  ruled('desktop/cloud/conflict-notice',ViewKind.WarningPopup,SHELL,'Cloud sync finds a conflicting project: a notice appears under the toolbar.'),
  ruled('desktop/cloud/hint',ViewKind.FieldNote,SHELL,'Cloud sync has a hint to show: a line appears under the toolbar.'),
  ruled('desktop/signal/generator',ViewKind.Page,SHELL,'Left panel under the project list: the Signal Generator switch and frequency box.'),
  ruled('desktop/projects/new/vented-volume-warning',ViewKind.WarningPopup,WIZARD,'New project, vented box, details step: enter a volume the alignment rejects.'),
  ruled('desktop/projects/new/vented-tuning-warning',ViewKind.WarningPopup,WIZARD,'New project, vented box, details step: enter a tuning the box cannot reach.'),
  ruled('desktop/projects/new/passive-radiator-pick-error',ViewKind.ErrorPopup,WIZARD,'New project, passive radiator, details step: pick a radiator that cannot be used.'),
  ruled('desktop/projects/trace-colour-picker',ViewKind.System,LIST,'Click a project colour swatch: the browser colour picker opens.'),
  phoneRuled('phone/difference-cue',ViewKind.FieldNote,'filters/PassFields.vue','Tap the ≠W Difference cue by a control or filter field: a popup says what WinISD does instead.'),
  phoneRuled('phone/response-model-pending-notice',ViewKind.WarningPopup,'MobileBoxTab.vue','Box page, pick a box type the engine does not model yet: a Response model pending notice appears.'),
  phoneRuled('phone/tuning-unreachable-warning',ViewKind.WarningPopup,'MobileEnclosureTab.vue','Box page, vented box whose target tuning cannot be reached: a red message appears under the field.'),
  phoneRuled('phone/filter-card-body',ViewKind.InlineExpansion,'MobileFilterCard.vue','Filters page: tap a filter card to open its fields inline.'),
  phoneRuled('phone/wizard-isobarik-note',ViewKind.FieldNote,'MobileNewProject.vue','New project, driver count step: choose isobarik placement and a caption says it is not modelled.'),
  phoneRuled('phone/wizard-vented-volume-warning',ViewKind.WarningPopup,'MobileNewProject.vue','New project, vented box, details step: enter a volume the alignment rejects.'),
  phoneRuled('phone/wizard-vented-tuning-warning',ViewKind.WarningPopup,'MobileNewProject.vue','New project, vented box, details step: enter a tuning the box cannot reach.'),
  phoneRuled('phone/wizard-passive-radiator-pick-error',ViewKind.ErrorPopup,'MobileNewProject.vue','New project, passive radiator, details step: pick a radiator that cannot be used.'),
  phoneRuled('phone/save-note',ViewKind.FieldNote,'MobileSaveButton.vue','Tap the Save button: a note hangs under it.'),
  phoneRuled('phone/flash-strip',ViewKind.FieldNote,'MobileShell.vue','The app has a short message to show: a strip appears above the tab bar.'),
  phoneRuled('phone/update-strip',ViewKind.WarningPopup,'MobileShell.vue','A newer app version is available: a strip with Reload and Later appears above the tab bar.'),
  phoneRuled('phone/cloud-reconnect-strip',ViewKind.WarningPopup,'MobileShell.vue','Cloud sync needs the user to reconnect: a strip appears above the tab bar.'),
  phoneRuled('phone/cloud-conflict-notice',ViewKind.WarningPopup,'MobileShell.vue','Cloud sync finds a conflicting project: a notice appears above the tab bar.'),
  phoneRuled('phone/cloud-hint',ViewKind.FieldNote,'MobileShell.vue','Cloud sync has a hint to show: a strip with a Yes button appears above the tab bar.'),
  sharedRuled('shared/field-catalogue',ViewKind.Page,'packages/ui/src/ui/components/FieldCatalogue.vue','Open the app with ?field-catalogue in the address: a page lists a sample of every field style.'),
  sharedRuled('shared/flash-message',ViewKind.FieldNote,CMP+'Flash.vue','The app has a short message to show: a strip appears (desktop skin).'),
  sharedRuled('shared/chart-readout',ViewKind.FieldNote,'packages/ui/src/ui/canvas.ts','Move over a chart, or drag across it: a read-out box shows the values, or the range, ripple, peak and trough.'),
  sharedRuled('shared/driver-delete-challenge-warning',ViewKind.WarningPopup,CMP+'DriverBrowser.vue','Driver browser, press delete on saved drivers before exporting: a red warning says deleting destroys the only copy.'),
  sharedRuled('shared/graph-warning-pill',ViewKind.WarningPopup,CMP+'GraphPanel.vue','A chart has warnings: a pill with the first warning appears on the chart, with a dismiss button.'),
  sharedRuled('shared/graph-blocked-message',ViewKind.ErrorPopup,CMP+'GraphPanel.vue','A chart cannot be plotted: a Can\'t plot message lists the fields that block it.'),
  sharedRuled('shared/graph-context-menu',ViewKind.Menu,CMP+'GraphPanel.vue','Right-click a chart: a menu offers to place the marker, snap the cursor to peaks and troughs, and jump to roll-offs.'),
  sharedRuled('shared/store-gate',ViewKind.ErrorPopup,CMP+'StoreGate.vue','Start the app when saved data cannot be opened safely: a full-screen gate offers Restore, Open read-only and Export everything.'),
  sharedRuled('shared/winisd-difference-entry',ViewKind.InlineExpansion,CMP+'WinisdDifferencesModal.vue','OpenISD and WinISD differences dialog: tap an entry to unfold its WinISD and OpenISD text.'),
  sharedRuled('shared/about-page',ViewKind.Page,'packages/ui/about/index.html','Open /about/ in a browser: the static About OpenISD page.'),
  sharedRuled('shared/install-page',ViewKind.Page,'packages/ui/install/index.html','Open /install/ in a browser: the static Add OpenISD as an app page.'),
  sharedRuled('shared/options-error',ViewKind.ErrorPopup,CMP+'OptionsModal.vue','Options, type a value the app refuses (or a limit it rejects): a red message appears and Apply is blocked.'),
  sharedRuled('shared/storage-warning',ViewKind.WarningPopup,CMP+'StorageHistory.vue','Options, Your data, when storage may not persist or is nearly full: a warning line appears above the usage.'),
  sharedRuled('shared/storage-restore-picker',ViewKind.InlineExpansion,CMP+'StorageHistory.vue','Options, Your data, tap Restore on a backup row: its projects list opens inline, each with a Restore button.'),
  sharedRuled('shared/driver-editor-incomplete-warning',ViewKind.WarningPopup,CMP+'DriverEditorModal.vue','Driver editor with a missing brand or model, charts blocked, or disagreeing values: a warning strip lists why.'),
  sharedRuled('shared/driver-library-storage-note',ViewKind.WarningPopup,CMP+'DriverLibrary.vue','Driver list when browser storage is inaccessible: a note says saved drivers are unavailable.'),
  sharedRuled('shared/driver-library-broken-entry',ViewKind.WarningPopup,CMP+'DriverLibrary.vue','Driver list with a saved driver this version cannot read: a flagged row offers Export and Delete.'),
  sharedRuled('shared/driver-type-help',ViewKind.FieldNote,CMP+'DriverLibrary.vue','Driver list filters, press the ? by the types: a table explains the driver range classifications.'),
];
export const VIEW_INDEX:readonly ViewEntry[]=Object.freeze([...MOBILE_SURFACES.map(fromMobile),...DESKTOP_SURFACES.map(fromDesktop),...RULED_VIEWS]);
