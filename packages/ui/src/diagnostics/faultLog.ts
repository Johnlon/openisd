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

const STATE_KEY = 'openisd.state';
/** Where `applyState` sets a refused record aside, so a one-field repair stays possible
 *  after the autosave has overwritten the live state. */
const QUARANTINE_KEY = 'openisd.quarantine.driver';

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
  /** Repair it. Returns a human-readable account of what changed. */
  apply: () => string;
}

function readState(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function writeState(state: Record<string, unknown>): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

/** The saved driver record, or null where there is none to inspect. */
function savedDriver(): Record<string, unknown> | null {
  const d = readState()?.driver;
  return d && typeof d === 'object' ? d as Record<string, unknown> : null;
}

/** The record `applyState` refused, if one is set aside. */
function quarantinedDriver(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(QUARANTINE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

/**
 * The built-in ladder.
 *
 * Ordered by what they destroy, not by how likely they are to work. A repair that keeps the
 * design is always offered above one that drops it, even when the broader one is more certain.
 */
export const QUICK_FIXES: readonly QuickFix[] = [
  {
    id: 'add-missing-specs',
    title: 'Repair the saved driver — add the missing specs container',
    impact: 1,
    keeps: 'everything: the design, the driver and every value in it',
    loses: '',
    // `OpenISDDriver` reads `record.specs[section]`. A record with no `specs` key at all
    // throws on the FIRST read, so every computed that touches the driver dies. The container
    // is structural, not data — restoring it loses nothing, because there was nothing in it.
    probe: () => {
      const d = quarantinedDriver() ?? savedDriver();
      return !!d && d.specs == null;
    },
    apply: () => {
      const broken = quarantinedDriver() ?? savedDriver()!;
      broken.specs = { woofer: {} };
      const state = readState() ?? {};
      state.driver = broken;
      writeState(state);
      localStorage.removeItem(QUARANTINE_KEY);
      return 'Added the empty `specs` container and put the driver back in the design.';
    },
  },
  {
    id: 'drop-saved-driver',
    title: 'Forget the saved driver, keep the design',
    impact: 2,
    keeps: 'the box, vents, targets, signal, charts and every UI setting',
    loses: 'which driver was selected — pick it again from the library',
    probe: () => savedDriver() != null || quarantinedDriver() != null,
    apply: () => {
      const state = readState() ?? {};
      delete state.driver;
      writeState(state);
      localStorage.removeItem(QUARANTINE_KEY);
      return 'Removed the saved driver from the stored design.';
    },
  },
  {
    id: 'reset-design',
    title: 'Reset the saved design',
    impact: 3,
    keeps: 'My Drivers, saved passive radiators and your preferences',
    loses: 'the current design — box, vents, targets and chart setup',
    probe: () => readState() != null,
    apply: () => { localStorage.removeItem(STATE_KEY); return `Removed \`${STATE_KEY}\`.`; },
  },
  {
    id: 'clear-all',
    title: 'Clear ALL saved state',
    impact: 9,
    keeps: 'nothing stored in this browser',
    loses: 'the design, My Drivers, saved passive radiators and all preferences',
    // Last resort, and it says so. Offered only when something is actually stored, so it is
    // never the sole option on a machine with nothing to clear.
    probe: () => {
      try { return Object.keys(localStorage).some(k => k.startsWith('openisd.')); }
      catch { return false; }
    },
    apply: () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('openisd.'));
      for (const k of keys) localStorage.removeItem(k);
      return `Removed ${keys.length} key(s): ${keys.join(', ')}.`;
    },
  },
];

export interface FaultLog {
  /** Every distinct fault, newest last. */
  faults: Fault[];
  /** Repairs whose `probe()` says they apply to this machine, least destructive first. */
  applicable: () => QuickFix[];
  /** A copyable report: the faults, the stored-state shape, and the build. */
  report: () => string;
  /** Start listening. Idempotent. */
  install: () => void;
  /** Called whenever a NEW fault is recorded — the UI hook that raises the dialog. */
  onFault: (fn: (f: Fault) => void) => void;
}

export function createFaultLog(): FaultLog {
  const faults: Fault[] = [];
  const listeners: Array<(f: Fault) => void> = [];
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
    applicable: () => QUICK_FIXES.filter(f => { try { return f.probe(); } catch { return false; } })
      .slice().sort((a, b) => a.impact - b.impact),
    report: () => {
      const stored = (() => {
        try {
          return Object.keys(localStorage).filter(k => k.startsWith('openisd.'))
            .map(k => `${k}: ${(localStorage.getItem(k) ?? '').length} bytes`).join('\n  ');
        } catch { return '(localStorage unavailable)'; }
      })();
      const driver = savedDriver();
      return [
        `OpenISD diagnostics — ${new Date().toISOString()}`,
        `url: ${location.href}`,
        `agent: ${navigator.userAgent}`,
        '',
        `faults (${faults.length}):`,
        ...faults.map(f => `  [${f.kind}] ×${f.count} ${f.message}\n${f.stack ? '    ' + f.stack.split('\n').slice(0, 6).join('\n    ') : ''}`),
        '',
        'stored keys:',
        `  ${stored || '(none)'}`,
        '',
        'saved driver record:',
        driver
          ? `  keys: ${Object.keys(driver).join(', ')}\n  specs: ${driver.specs == null ? 'MISSING' : Object.keys(driver.specs as object).join(', ')}`
          : '  (none saved)',
      ].join('\n');
    },
    install: () => {
      if (installed) return;
      installed = true;

      window.addEventListener('error', e => {
        record('exception', e.message || String(e.error), e.error?.stack);
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
        const err = args.find(a => a instanceof Error) as Error | undefined;
        record('console', err ? err.message : args.map(a => String(a)).join(' '), err?.stack);
      };
    },
    onFault: fn => { listeners.push(fn); },
  };
}
