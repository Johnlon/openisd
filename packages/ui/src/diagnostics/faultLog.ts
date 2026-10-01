/**
 * Fault log — makes a runtime failure VISIBLE, and offers the smallest repair that fixes it.
 *
 * A thrown exception in a Vue computed kills that computed and nothing else. The page keeps
 * rendering, the console fills up, and the user sees a panel that is merely blank or stale.
 * That is how a build shipped with every driver-panel computation throwing and still looked
 * "loaded" — `bugs/BUG_20260817_deploy_verifies_asset_freshness_but_never_that_the_app_runs.md`.
 *
 * Two jobs:
 *
 *  1. CATCH AND SHOW. Uncaught errors, unhandled rejections and `console.error` are recorded
 *     with the state that produced them, and the UI raises a dialog on the first one. Silence
 *     is not an option a diagnostic tool gets to choose.
 *  2. OFFER THE LEAST DESTRUCTIVE REPAIR THAT WORKS. Every fix declares what it KEEPS and what
 *     it LOSES, and they are presented smallest-blast-radius first. "Clear all saved state" is
 *     the last resort, never the first offer — an unexpected app state is still the user's
 *     work, and throwing it away to clear an error destroys the evidence too.
 */

import type {AppSettingsRepo, ProjectRepairReport, ViewStateRepo} from '@openisd/persistence';

/** Writes a file the user keeps — the backup every repair takes before it changes stored state. */
export type SaveBackup = (fileName: string, text: string) => void;

export interface Fault {
  /** Monotonic id so the UI can key a list without an index. */
  id: number;
  kind: 'exception' | 'rejection' | 'console';
  message: string;
  stack?: string;
  /** When it happened, ISO, for the copyable report. */
  at: string;
  /** How many times this same message has fired — a throwing computed repeats on every tick. */
  count: number;
}

/**
 * One repair.
 *
 * `impact` orders the ladder and IS the user-facing promise: a fix must never destroy more
 * than its own line says. `probe` decides whether the fix is even applicable, so the dialog
 * offers only repairs that address the state actually on this machine.
 */
export interface QuickFix {
  id: string;
  title: string;
  /** Smaller is safer. The list is sorted on this. */
  impact: number;
  /** What survives. Shown verbatim. */
  keeps: string;
  /** What does not. Shown verbatim; empty string means "nothing is lost". */
  loses: string;
  /** True when this machine's stored state has the defect this fix repairs. */
  probe: () => boolean;
  /** Repair it, after handing `saveBackup` everything it is about to change. Returns a
   *  human-readable account of what changed. */
  apply: (saveBackup: SaveBackup) => string;
}

/** The stored records a repair may reset — each through its own repo. */
export interface ResettableRecords {
  readonly view: ViewStateRepo;
  readonly appSettings: AppSettingsRepo;
}

/** Hand a record's stored text to `saveBackup`, then reset it. False when nothing was stored. */
function backUpAndReset(record: ViewStateRepo | AppSettingsRepo, fileName: string, saveBackup: SaveBackup): boolean {
  const raw = record.exportRaw();
  if (raw === null) return false;
  saveBackup(fileName, raw);
  record.reset();
  return true;
}

/**
 * The built-in ladder.
 *
 * Ordered by what the user loses. Every rung backs up what it changes before changing it, and no
 * rung deletes a design, a project or a saved driver: those are the user's work, and a fault in
 * the running code is never a reason to lose them (John, 2026-10-01).
 */
export function repairLadder({ view, appSettings }: ResettableRecords): readonly QuickFix[] {
  return [
    {
      id: 'reset-view',
      title: 'Reset the chart layout and panels',
      impact: 2,
      keeps: 'every project, design, filter, My Drivers and your Options',
      loses: 'chart layout, open panels and which tab is shown (a backup file is saved first)',
      probe: () => view.exportRaw() !== null,
      apply: (saveBackup) => backUpAndReset(view, 'openisd_view.backup.json', saveBackup)
        ? 'Saved a backup of the chart layout, then reset it.' : 'There was no stored chart layout.',
    },
    {
      id: 'reset-app-settings',
      title: 'Reset Options to their defaults',
      impact: 3,
      keeps: 'every project, design, filter, chart layout and My Drivers',
      loses: 'Options settings such as the environment defaults (a backup file is saved first)',
      probe: () => appSettings.exportRaw() !== null,
      apply: (saveBackup) => backUpAndReset(appSettings, 'openisd_app_settings.backup.json', saveBackup)
        ? 'Saved a backup of Options, then reset them.' : 'There were no stored Options.',
    },
  ];
}

/** A project that loaded only after fields were reset — shown to the user, never silent. */
export interface RepairNotice {
  readonly projectName: string;
  /** Each reset field as a dotted path, e.g. `saved.box.portVelocityLimit_m_per_s`. */
  readonly fields: readonly string[];
  /** Where the text as it was is kept; null when the source (a file, a link) still has it. */
  readonly backupKey: string | null;
}

export interface FaultLog {
  /** Every distinct fault, newest last. */
  faults: Fault[];
  /** Every project repaired while loading, oldest first. */
  repairs: RepairNotice[];
  /** Record a load-time repair and raise the dialog. */
  recordRepair: (report: ProjectRepairReport) => void;
  /** Save the backed-up original of a repaired project as a file. False when none is kept. */
  downloadOriginal: (notice: RepairNotice) => boolean;
  /** Repairs whose `probe()` says they apply to this machine, least destructive first. */
  applicable: () => QuickFix[];
  /** Run one repair, giving it the backup writer. */
  repair: (fix: QuickFix) => string;
  /** A copyable report: the faults, the stored-state shape, and the build. */
  report: () => string;
  /** Start listening. Idempotent. */
  install: () => void;
  /** Called whenever a repair is recorded — raises the dialog too. */
  onRepair: (fn: () => void) => void;
  /** Called whenever a NEW fault is recorded — the UI hook that raises the dialog. */
  onFault: (fn: (f: Fault) => void) => void;
}

/** `records` is a thunk: the fault log is created before the repos (so a fault while the app is
 *  being wired is still caught); until they exist, no repair is offered. */
export function createFaultLog(saveBackup: SaveBackup, records: () => ResettableRecords): FaultLog {
  function ladder(): readonly QuickFix[] {
    try { return repairLadder(records()); } catch { return []; }
  }
  const faults: Fault[] = [];
  const listeners: Array<(f: Fault) => void> = [];
  const repairListeners: Array<() => void> = [];
  const repairs: RepairNotice[] = [];
  let nextId = 1;
  let installed = false;

  function record(kind: Fault['kind'], message: string, stack?: string): void {
    // A throwing computed re-throws on every reactive tick. Counting repeats keeps the dialog
    // readable instead of showing the same line two hundred times.
    const same = faults.find(f => f.message === message && f.kind === kind);
    if (same) { same.count++; return; }
    const fault: Fault = { id: nextId++, kind, message, stack, at: new Date().toISOString(), count: 1 };
    faults.push(fault);
    for (const fn of listeners) fn(fault);
  }

  return {
    faults,
    repair: (fix) => fix.apply(saveBackup),
    repairs,
    recordRepair: (report) => {
      repairs.push({
        projectName: report.projectName,
        fields: report.repaired.map(path => path.join('.')),
        backupKey: report.backupKey,
      });
      for (const fn of repairListeners) fn();
    },
    downloadOriginal: (notice) => {
      if (notice.backupKey === null) return false;
      const text = localStorage.getItem(notice.backupKey);
      if (text === null) return false;
      saveBackup(`${notice.backupKey}.json`, text);
      return true;
    },
    onRepair: (fn) => { repairListeners.push(fn); },
    applicable: () => ladder().filter(f => { try { return f.probe(); } catch { return false; } })
      .slice().sort((a, b) => a.impact - b.impact),
    report: () => {
      const stored = (() => {
        try {
          return Object.keys(localStorage).filter(k => k.startsWith('openisd_'))
            .map(k => `${k}: ${(localStorage.getItem(k) ?? '').length} bytes`).join('\n  ');
        } catch { return '(localStorage unavailable)'; }
      })();
      return [
        `OpenISD diagnostics — ${new Date().toISOString()}`,
        `url: ${location.href}`,
        `agent: ${navigator.userAgent}`,
        '',
        `faults (${faults.length}):`,
        ...faults.map(f => `  [${f.kind}] ×${f.count} ${f.message}\n${f.stack ? '    ' + f.stack.split('\n').slice(0, 6).join('\n    ') : ''}`),
        '',
        'stored keys:',
        `  ${stored || '(none)'}`].join('\n');
    },
    install: () => {
      if (installed) return;
      installed = true;

      window.addEventListener('error', e => {
        // `ErrorEvent.error` is typed `any` by the DOM lib — it is whatever was thrown. Only an
        // Error carries a stack worth recording.
        const thrown: unknown = e.error;
        record('exception', e.message || String(thrown), thrown instanceof Error ? thrown.stack : undefined);
      });
      window.addEventListener('unhandledrejection', e => {
        const r: unknown = e.reason;
        record('rejection', r instanceof Error ? r.message : String(r),
          r instanceof Error ? r.stack : undefined);
      });

      // Vue swallows a throw inside a computed into console.error rather than letting it reach
      // window.onerror, so without this hook the exact fault class that started all of this
      // would be invisible here. The original is still called — the console stays intact.
      const original = console.error.bind(console);
      console.error = (...args: unknown[]) => {
        original(...args);
        const err = args.filter((a): a is Error => a instanceof Error)[0];
        record('console', err ? err.message : args.map(a => String(a)).join(' '), err?.stack);
      };
    },
    onFault: fn => { listeners.push(fn); },
  };
}
