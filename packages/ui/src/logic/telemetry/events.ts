/**
 * The usage events the app reports, and their wire form. One discriminated union: adding a
 * variant fails `fieldsOf` and `nameOf` until both handle it.
 */
import type {ChartId} from '@openisd/design/engine';

/** The one spelling of each skin on the wire: lower case. */
export const SKINS = ['original', 'mobile'] as const;
export type Skin = typeof SKINS[number];
/** Screen width band: the smallest bound the width is under, or the top band. */
export type ScreenWidthBand = '<600' | '<1024' | '<1440' | '<1920' | '>=1920';
export type DisplayMode = 'standalone' | 'browser';
export type Platform = 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'other';
export type ProjectSource = 'new' | 'wizard' | 'file' | 'stored' | 'driver' | 'share' | 'copy';
export type SaveFormat = 'stored' | 'owpr' | 'wpr' | 'archive';
export type DriverSource = 'bundled' | 'mine' | 'import';

export interface LaunchEvent {
  readonly kind: 'launch';
  readonly mode: DisplayMode;
  readonly platform: Platform;
  readonly skin: Skin;
  readonly w: number;
  readonly h: number;
  readonly screen: ScreenWidthBand;
  readonly lang: string;
  /** The referrer's host name only; '' when there is none. */
  readonly ref: string;
  /** Storage keys that were here at the last start and are gone now; none when nothing was lost. */
  readonly keysLost: readonly string[];
}
export interface InstallEvent { readonly kind: 'install' }
/** The service worker would not register (an extension or in-app browser blocked it); the app carries on without one. */
export interface SwBlockedEvent { readonly kind: 'sw_blocked'; readonly platform: Platform }
/** The page is going away: how long it was open and how many different charts were viewed. */
export interface SessionEndEvent { readonly kind: 'session_end'; readonly seconds: number; readonly charts: number }
export interface ProjectOpenEvent {
  readonly kind: 'project_open';
  readonly source: ProjectSource;
  readonly box: string;
  /** Only bundled drivers are named; user-owned driver identity stays private. */
  readonly driverId?: string;
  readonly driverName?: string;
}
/** The projects restored from browser storage at app start: how many, in one event (each is no `project_open`). */
export interface ProjectsRestoredEvent { readonly kind: 'projects_restored'; readonly count: number }
export interface ProjectSaveEvent {
  readonly kind: 'project_save';
  readonly format: SaveFormat;
  readonly box: string;
  /** Only bundled drivers are named; user-owned driver identity stays private. */
  readonly driverId?: string;
  readonly driverName?: string;
}
/** `name` is the catalogue's own name for a bundled driver; empty for a driver the user owns, whose name is theirs. */
export interface DriverPickEvent { readonly kind: 'driver_pick'; readonly source: DriverSource; readonly id: string; readonly name: string }
export type RadiatorSource = 'bundled' | 'mine';
/** A passive radiator chosen; `name` as for `DriverPickEvent`. */
export interface RadiatorPickEvent { readonly kind: 'radiator_pick'; readonly source: RadiatorSource; readonly id: string; readonly name: string }
export type FeatureName =
  | 'whatif' | 'tune' | 'filters' | 'export' | 'import' | 'driver_db' | 'options' | 'vents' | 'save_file' | 'share_link' | 'diagnostics' | 'backup' | 'restore' | 'chart_data' | 'driver_editor' | 'skin_switch'
  | 'winisd_differences' | 'bin_restore' | 'history_restore' | 'cloud_connect' | 'cloud_sync' | 'box_type' | 'alignment' | 'help' | 'compat_switch' | 'losses' | 'signal_generator' | 'save_my_driver' | 'driver_clone'
  | 'multi_driver_wiring_changed' | 'coil_wiring_changed';
/**
 * The driver list's filters left no driver. Every field is a closed set or a count: chip ids, size classes, impedances,
 * scope, and which ranges are used; the search text is only counted, never sent.
 */
export interface DriverSearchEmptyEvent {
  readonly kind: 'driver_search_empty';
  readonly scope: string;
  /** The type chips that are on, comma-joined in sorted order; '' for none. */
  readonly types: string;
  readonly sizes: string;
  readonly impedances: string;
  /** Which range filters are used: 'fs', 'range', 'sd', comma-joined; '' for none. */
  readonly ranges: string;
  readonly favorites: boolean;
  /** Length of the typed search text; 0 when none. */
  readonly textLength: number;
}
/** A driver's values that disagree, or a refused number-box entry, was shown. `driver` is a bundled driver's catalogue name, else 'own'. */
export interface ValuesProblemSeenEvent {
  readonly kind: 'values_problem_seen';
  readonly problem: 'disagree' | 'refused';
  readonly field: string;
  readonly driver: string;
}
/** The release announcement popup: shown, then closed (`dismissed` is the Dismiss button on the latest one). */
export interface AnnouncementEvent {
  readonly kind: 'announcement';
  readonly stage: 'seen' | 'dismissed' | 'closed';
  readonly id: string;
  readonly view: 'latest' | 'list';
}
/** What happened to the feedback question the app offers at start: shown, answered with "Not now", or closed (Escape, outside tap,
 *  the cross) without an answer. An answer is not an outcome here: it is sent as `feedback`. Nothing typed or personal rides along. */
export type FeedbackPromptOutcome = 'shown' | 'not_now' | 'closed';
export interface FeedbackPromptEvent { readonly kind: 'feedback_prompt'; readonly outcome: FeedbackPromptOutcome }
export interface ChartViewEvent { readonly kind: 'chart_view'; readonly chart: ChartId }
/** The steps whose duration is reported: see `PerfEvent`. */
export const PERF_STEPS = ['boot_download', 'boot_catalogue', 'boot_restore', 'boot_ready', 'first_chart', 'project_open', 'driver_list_open', 'recalc'] as const;
export type PerfStep = typeof PERF_STEPS[number];
/** How long a key step took, so slow devices show up. `ms` is whole milliseconds (for `recalc` the session's median); `maxMs` and `count`
 *  are the session's slowest and number of recalculations, and null for every other step; `cores` and `memoryGb` are null where the browser does not say. */
export interface PerfEvent {
  readonly kind: 'perf';
  readonly step: PerfStep;
  readonly ms: number;
  readonly maxMs: number | null;
  readonly count: number | null;
  readonly skin: Skin;
  readonly cores: number | null;
  readonly memoryGb: number | null;
}
export interface FeatureEvent { readonly kind: 'feature'; readonly name: FeatureName }
export interface AnonymousErrorContext {
  readonly screen: string;
  readonly dialog: string;
  readonly projects: number;
  readonly box: string;
  readonly actions: string;
  readonly device: string;
}

export interface ErrorEvent {
  readonly kind: 'error';
  readonly message: string;
  readonly frames: string;
  readonly box: string;
  readonly screen: string;
  readonly dialog: string;
  readonly projects: number;
  readonly actions: string;
  readonly device: string;
}
export interface ReportEvent {
  readonly kind: 'report';
  readonly hash: string;
  readonly message: string;
  readonly note: string;
  readonly contact: string;
  readonly box: string;
  readonly screen: string;
  readonly dialog: string;
  readonly projects: number;
  readonly actions: string;
  readonly device: string;
}

/** The user's answer to "Do you like OpenISD?" (`face` is a `FeedbackFace` wire value) and, when they wrote one,
 *  their comment. A follow-up comment repeats the `id` and `face` of the answer it belongs to. */
export interface FeedbackEvent {
  readonly kind: 'feedback';
  readonly id: string;
  readonly face: string;
  readonly comment: string;
  readonly screen: string;
  readonly skin: Skin;
}

export type TelemetryEvent =
  | LaunchEvent | InstallEvent | SwBlockedEvent | SessionEndEvent | ProjectOpenEvent | ProjectsRestoredEvent | DriverSearchEmptyEvent | ValuesProblemSeenEvent | AnnouncementEvent | ProjectSaveEvent | DriverPickEvent | RadiatorPickEvent | ChartViewEvent | PerfEvent | FeatureEvent | ErrorEvent | ReportEvent | FeedbackEvent | FeedbackPromptEvent;

export type FieldValue = string | number | boolean | null;
export type Fields = Record<string, FieldValue>;

/** Where an event comes from: the live site or the test site. */
export type TelemetryEnvironment = 'production' | 'test';

/** One event as the collector receives it. */
export interface WireEvent {
  readonly name: TelemetryEvent['kind'];
  readonly ts: number;
  readonly version: string;
  readonly session: string;
  /** Anonymous random id of this browser, minted on first launch; linked to no account or name. */
  readonly browser_id: string;
  readonly environment: TelemetryEnvironment;
  readonly fields: Fields;
}

export function fieldsOf(e: TelemetryEvent): Fields {
  switch (e.kind) {
    case 'launch': return {
      mode: e.mode, platform: e.platform, skin: e.skin, w: e.w, h: e.h, screen: e.screen, lang: e.lang, ref: e.ref,
      ...(e.keysLost.length === 0 ? {} : {keysLost: e.keysLost.join(',')}),
    };
    case 'install': return {};
    case 'sw_blocked': return {platform: e.platform};
    case 'session_end': return {seconds: e.seconds, charts: e.charts};
    case 'project_open': return {
      source: e.source, box: e.box,
      ...(e.driverId === undefined ? {} : {driverId: e.driverId}),
      ...(e.driverName === undefined ? {} : {driverName: e.driverName}),
    };
    case 'projects_restored': return {count: e.count};
    case 'driver_search_empty': return {
      scope: e.scope, types: e.types, sizes: e.sizes, impedances: e.impedances, ranges: e.ranges, favorites: e.favorites, textLength: e.textLength,
    };
    case 'values_problem_seen': return {problem: e.problem, field: e.field, driver: e.driver};
    case 'announcement': return {stage: e.stage, id: e.id, view: e.view};
    case 'project_save': return {
      format: e.format, box: e.box,
      ...(e.driverId === undefined ? {} : {driverId: e.driverId}),
      ...(e.driverName === undefined ? {} : {driverName: e.driverName}),
    };
    case 'driver_pick': return {source: e.source, id: e.id, ...(e.name === '' ? {} : {name: e.name})};
    case 'radiator_pick': return {source: e.source, id: e.id, ...(e.name === '' ? {} : {name: e.name})};
    case 'chart_view': return {chart: e.chart};
    case 'feature': return {name: e.name};
    case 'perf': return {step: e.step, ms: e.ms, max_ms: e.maxMs, count: e.count, skin: e.skin, cores: e.cores, memory_gb: e.memoryGb};
    case 'error': return {
      message: e.message,
      frames: e.frames,
      box: e.box,
      screen: e.screen,
      dialog: e.dialog,
      projects: e.projects,
      actions: e.actions,
      device: e.device,
    };
    case 'feedback': return {
      id: e.id, face: e.face, screen: e.screen, skin: e.skin,
      ...(e.comment === '' ? {} : {comment: e.comment}),
    };
    case 'feedback_prompt': return {outcome: e.outcome};
    case 'report': return {
      hash: e.hash,
      message: e.message,
      note: e.note,
      contact: e.contact,
      box: e.box,
      screen: e.screen,
      dialog: e.dialog,
      projects: e.projects,
      actions: e.actions,
      device: e.device,
    };
  }
}

export const MAX_MESSAGE = 200;
export const MAX_FRAMES = 600;
export const MAX_NOTE = 1000;
export const MAX_CONTACT = 200;
export const MAX_SCREEN = 60;
export const MAX_DIALOG = 40;
export const MAX_BOX = 40;
export const MAX_DEVICE = 40;
export const MAX_ACTIONS = 10;
export const MAX_ACTIONS_TEXT = 300;
const TOP_FRAMES = 3;

/** The first `TOP_FRAMES` stack frames, one per line, without the leading message line. */
export function topFrames(stack: string | undefined): string {
  if (!stack) return '';
  const lines = stack.split('\n').map(l => l.trim()).filter(l => l !== '');
  const v8 = lines.filter(l => l.startsWith('at '));
  const frames = v8.length > 0 ? v8 : lines.slice(1);
  return frames.slice(0, TOP_FRAMES).join('\n').slice(0, MAX_FRAMES);
}

/** An error event from anything that was thrown and its anonymous context. */
export function errorEventOf(thrown: unknown, context: AnonymousErrorContext): ErrorEvent {
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  const stack = thrown instanceof Error ? thrown.stack : undefined;
  return {
    kind: 'error',
    message: message.slice(0, MAX_MESSAGE),
    frames: topFrames(stack),
    box: context.box,
    screen: context.screen,
    dialog: context.dialog,
    projects: context.projects,
    actions: context.actions,
    device: context.device,
  };
}

/** The band a screen width falls in. */
export function screenWidthBandOf(width: number): ScreenWidthBand {
  if (width < 600) return '<600';
  if (width < 1024) return '<1024';
  if (width < 1440) return '<1440';
  if (width < 1920) return '<1920';
  return '>=1920';
}
