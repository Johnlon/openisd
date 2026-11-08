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
];
export const VIEW_INDEX:readonly ViewEntry[]=Object.freeze([...MOBILE_SURFACES.map(fromMobile),...DESKTOP_SURFACES.map(fromDesktop),...RULED_VIEWS]);
