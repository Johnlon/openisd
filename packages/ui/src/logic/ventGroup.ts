/**
 * The vent group's UI seam. The physics — which of volume, diameter, tuning and length is HELD and
 * which is SOLVED, the Helmholtz relation itself, reachability — lives on `OpenISDProject`
 * (`cell()`/`enter()`/`clear()`/`notifyVentChanged()`), the owner of the state. This module keeps
 * only what is genuinely a UI concern: the members the shells bind (`VentMember`), the E/C/N letter
 * the badges show, and the solve-suspension that parks `appState.ts`'s coarse auto-solve watch
 * so one user action produces one solve (and a wholesale restore is adopted verbatim,
 * byte-identical — docs/design/STATE_MODEL.md rule 3).
 */
import type {OpenISDProject} from '@openisd/design';
import type {ProvenanceLetter} from '@openisd/design';

/** A thin passthrough onto the domain's own reactivity ping (`prGroup.ts`'s
 *  `notifyPrChanged` already took this shape). S2-7d2 wires the tuning ↔ vent-length relation
 *  into `OpenISDProject#resolve()` itself, run synchronously by every `.set()`/`.clear()` this
 *  module's own `VentMember` writes already make — so the manual Helmholtz solve
 *  this function used to perform (QO126's stub workaround, while the relation was unwired) is
 *  gone: it is now REDUNDANT with `#resolve()`, and worse, actively conflicting with it — calling
 *  `.set()` here on the "achieved" side re-entered it as a fresh fact, which (correctly) cleared
 *  its just-entered sibling and re-derived it a second time through the SAME formula, landing on
 *  a float a few ULPs off the value the user actually typed. */
export function notifyVentChanged(p: OpenISDProject): void {
  p.notifyVentChanged();
}

/** The vent group of the project's adopted box type: the front chamber's on a 4th-order bandpass,
 *  the vented box's otherwise. The domain owns that choice (`Box.ventGroupOf`). */
function group(p: OpenISDProject) {
  return p.box.ventGroupOf(p.box.boxType.value);
}

/** Clearing both of the pair falls back to the vented starting alignment; a bandpass front
 *  chamber has none and is left as cleared. */
function fallBackToStartingAlignment(p: OpenISDProject): void {
  if (p.box.boxType.value !== 'bandpass4') p.box.resetVentedAlignment();
}

/** Which side of the tuning / vent-length pair the user stated. */
type EnteredPair = 'tuning' | 'length' | 'both';
let userEnteredPair: EnteredPair = 'tuning';

export function resetVentGroupState(): void {
  userEnteredPair = 'tuning';
}

/** One user action, one solve: the domain solves inside the write, and the suspension parks the
 *  auto-solve watch. */
function act(p: OpenISDProject, write: () => void): void {
  suspendVentSolve(() => {
    p.batch(() => {
      write();
      p.notifyVentChanged();
    });
  });
}

/** A vent-group member the user can enter — held until cleared. */
export interface VentInput {
  enter(p: OpenISDProject, value: number): void;
}
/** A member that can be handed back: it becomes `C` if the remaining entered set determines it,
 *  `N` if nothing can. */
export interface VentClearable {
  clear(p: OpenISDProject): void;
}
/** A member that shows an E/C/N badge: `E` entered and locked · `C` calculated · `N` not
 *  available. */
export interface VentBadged {
  state(p: OpenISDProject): ProvenanceLetter;
}

/**
 * The vent group's members. Volume, diameter, tuning and length are tied by the Helmholtz
 * relation; width and height are what a slotted vent states in place of a diameter.
 */
export class VentMember {
  /** Mandatory on a vented box, so it has no cleared state. */
  static readonly VOLUME: VentInput & VentBadged = Object.freeze({
    enter: (p: OpenISDProject, value: number) => act(p, () => group(p).volume_m3.set(value)),
    state: (p: OpenISDProject) => group(p).volume_m3.provenance,
  });

  static readonly DIAMETER: VentInput & VentClearable & VentBadged = Object.freeze({
    enter: (p: OpenISDProject, value: number) => act(p, () => group(p).vent.diameter_m.set(value)),
    clear: (p: OpenISDProject) => act(p, () => group(p).vent.diameter_m.clear()),
    state: (p: OpenISDProject) => group(p).vent.diameter_m.provenance,
  });

  static readonly TUNING: VentInput & VentClearable & VentBadged = Object.freeze({
    enter: (p: OpenISDProject, value: number) => act(p, () => {
      group(p).tuning_goal_hz.set(value);
      userEnteredPair = (group(p).vent.length_m.value !== null && userEnteredPair === 'length') ? 'both' : 'tuning';
    }),
    clear: (p: OpenISDProject) => act(p, () => {
      group(p).tuning_goal_hz.clear();
      if (userEnteredPair === 'both') {
        userEnteredPair = 'length';
      } else {
        // Nothing left on either side of the pair — rather than leave both blank (John,
        // 2026-10-01: "unrecoverable"), fall back to the same QB3-style alignment a fresh
        // box gets. The tuning is the alignment's own entered side, same as a new box.
        group(p).vent.length_m.clear();
        fallBackToStartingAlignment(p);
        userEnteredPair = 'tuning';
      }
    }),
    state: (p: OpenISDProject): ProvenanceLetter => {
      if (group(p).tuning_goal_hz.value === null) return 'N';
      if (userEnteredPair === 'length' && group(p).vent.length_m.value !== null) return 'C';
      return 'E';
    },
  });

  static readonly LENGTH: VentInput & VentClearable & VentBadged = Object.freeze({
    enter: (p: OpenISDProject, value: number) => act(p, () => {
      group(p).vent.length_m.set(value);
      userEnteredPair = (group(p).tuning_goal_hz.value !== null && userEnteredPair === 'tuning') ? 'both' : 'length';
    }),
    clear: (p: OpenISDProject) => act(p, () => {
      group(p).vent.length_m.clear();
      if (userEnteredPair === 'both') {
        userEnteredPair = 'tuning';
      } else {
        group(p).tuning_goal_hz.clear();
        fallBackToStartingAlignment(p);
        userEnteredPair = 'tuning';
      }
    }),
    state: (p: OpenISDProject): ProvenanceLetter => {
      if (group(p).vent.length_m.value === null) return 'N';
      if (userEnteredPair === 'tuning' && group(p).tuning_goal_hz.value !== null) return 'C';
      return 'E';
    },
  });

  static readonly WIDTH: VentInput = Object.freeze({
    enter: (p: OpenISDProject, value: number) => act(p, () => group(p).vent.width_m.set(value)),
  });

  static readonly HEIGHT: VentInput = Object.freeze({
    enter: (p: OpenISDProject, value: number) => act(p, () => group(p).vent.height_m.set(value)),
  });

  private constructor() {}
}

/** The tuning the CURRENT vent length actually delivers. */
export function ventAchievedFb(p: OpenISDProject): number | null {
  return p.ventAchievedFb.value;
}

/** The highest tuning this volume and port area can reach with ANY vent (L = 0). */
export function ventMaxReachableFb(p: OpenISDProject): number | null {
  return p.ventMaxReachableFb.value;
}

// ---- Restore suspension (docs/design/STATE_MODEL.md rule 3: "Cancel means byte-identical") -----------
// A restore assigns a whole persisted snapshot — both the entered set AND both members'
// values. There is nothing to recompute, and recomputing is exactly what breaks
// byte-identity: the solver would reproduce the calculated member from a value that was
// rounded on the way to storage, landing on a different double. Restores therefore run
// inside suspendVentSolve(), which parks the store's watcher while the assignment happens.
let suspended = false;

/** True while a restore is in flight — the store's watcher checks this and does not solve. */
export function ventSolveSuspended(): boolean {
  return suspended;
}

/**
 * Run `fn` with vent solving parked, so a wholesale restore is adopted verbatim.
 * Re-entrant-safe and exception-safe: the flag is always cleared.
 */
export function suspendVentSolve<T>(fn: () => T): T {
  const prev = suspended;
  suspended = true;
  try { return fn(); } finally { suspended = prev; }
}
