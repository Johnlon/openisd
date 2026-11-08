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
export const VIEW_INDEX:readonly ViewEntry[]=Object.freeze([...MOBILE_SURFACES.map(fromMobile),...DESKTOP_SURFACES.map(fromDesktop)]);
