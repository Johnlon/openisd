/**
 * The usage events the app reports, and their wire form. One discriminated union: adding a
 * variant fails `fieldsOf` and `nameOf` until both handle it.
 */
import type {ChartId} from '@openisd/design/engine';

export type Skin = 'original' | 'mobile';
export type DisplayMode = 'standalone' | 'browser';
export type Platform = 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'other';
export type ProjectSource = 'new' | 'wizard' | 'file' | 'stored' | 'driver';
export type SaveFormat = 'stored' | 'owpr' | 'wpr' | 'archive';
export type DriverSource = 'bundled' | 'mine' | 'import';

export interface LaunchEvent {
  readonly kind: 'launch';
  readonly mode: DisplayMode;
  readonly platform: Platform;
  readonly skin: Skin;
  readonly w: number;
  readonly h: number;
  readonly lang: string;
  readonly ref: string;
  /** Storage keys that were here at the last start and are gone now; none when nothing was lost. */
  readonly keysLost: readonly string[];
}
export interface InstallEvent { readonly kind: 'install' }
export interface ProjectOpenEvent { readonly kind: 'project_open'; readonly source: ProjectSource; readonly box: string }
export interface ProjectSaveEvent { readonly kind: 'project_save'; readonly format: SaveFormat; readonly box: string }
/** `name` is the catalogue's own name for a bundled driver; empty for a driver the user owns, whose name is theirs. */
export interface DriverPickEvent { readonly kind: 'driver_pick'; readonly source: DriverSource; readonly id: string; readonly name: string }
export type FeatureName =
  | 'whatif' | 'filters' | 'export' | 'import' | 'driver_db' | 'options' | 'vents' | 'save_file' | 'share_link' | 'diagnostics';
export interface ChartViewEvent { readonly kind: 'chart_view'; readonly chart: ChartId }
export interface FeatureEvent { readonly kind: 'feature'; readonly name: FeatureName }
export interface ErrorEvent { readonly kind: 'error'; readonly message: string; readonly frames: string; readonly box: string }
export interface ReportEvent { readonly kind: 'report'; readonly hash: string; readonly note: string; readonly contact: string }

export type TelemetryEvent =
  | LaunchEvent | InstallEvent | ProjectOpenEvent | ProjectSaveEvent | DriverPickEvent | ChartViewEvent | FeatureEvent | ErrorEvent | ReportEvent;

export type FieldValue = string | number | boolean;
export type Fields = Record<string, FieldValue>;

/** One event as the collector receives it. */
export interface WireEvent {
  readonly name: TelemetryEvent['kind'];
  readonly ts: number;
  readonly version: string;
  readonly session: string;
  readonly fields: Fields;
}

export function fieldsOf(e: TelemetryEvent): Fields {
  switch (e.kind) {
    case 'launch': return {
      mode: e.mode, platform: e.platform, skin: e.skin, w: e.w, h: e.h, lang: e.lang, ref: e.ref,
      ...(e.keysLost.length === 0 ? {} : {keysLost: e.keysLost.join(',')}),
    };
    case 'install': return {};
    case 'project_open': return {source: e.source, box: e.box};
    case 'project_save': return {format: e.format, box: e.box};
    case 'driver_pick': return {source: e.source, id: e.id, ...(e.name === '' ? {} : {name: e.name})};
    case 'chart_view': return {chart: e.chart};
    case 'feature': return {name: e.name};
    case 'error': return {message: e.message, frames: e.frames, box: e.box};
    case 'report': return {hash: e.hash, note: e.note, contact: e.contact};
  }
}

export const MAX_MESSAGE = 200;
export const MAX_FRAMES = 600;
export const MAX_NOTE = 1000;
export const MAX_CONTACT = 200;
const TOP_FRAMES = 3;

/** The first `TOP_FRAMES` stack frames, one per line, without the leading message line. */
export function topFrames(stack: string | undefined): string {
  if (!stack) return '';
  const lines = stack.split('\n').map(l => l.trim()).filter(l => l !== '');
  const v8 = lines.filter(l => l.startsWith('at '));
  const frames = v8.length > 0 ? v8 : lines.slice(1);
  return frames.slice(0, TOP_FRAMES).join('\n').slice(0, MAX_FRAMES);
}

/** An error event from anything that was thrown. */
export function errorEventOf(thrown: unknown, box: string): ErrorEvent {
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  const stack = thrown instanceof Error ? thrown.stack : undefined;
  return {kind: 'error', message: message.slice(0, MAX_MESSAGE), frames: topFrames(stack), box};
}
