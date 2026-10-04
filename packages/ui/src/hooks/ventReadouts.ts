/**
 * The Enclosure tab's vent (port) readouts — vented's own vent for a single-chamber box, or
 * bandpass4's front vent. Skin-neutral: both `OriginalShell-hooks.ts` and the mobile Enclosure
 * tab call this SAME factory (one implementation, two presentations) rather than each shell
 * re-deriving "what does the vent group's E/C/N state and 1st-port-resonance mean".
 */
import {computed} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import {VentMember} from '../logic/useVentGroup.js';
import type {OpenISDProject} from '@openisd/design';
import type {BoxType, EnvironmentEngine, VentEngine} from '@openisd/design/engine';

/** A presentation fact with no domain counterpart: these three box types draw two chambers. */
import {DUAL_CHAMBER} from './boxFields.js';

export interface VentReadoutsDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
  selectedBox: Ref<BoxType>;
  air: ComputedRef<ReturnType<EnvironmentEngine['solve']>['values']>;
  vent: VentEngine;
}

/** The tooltip the QO11 ruling requires: Fb is the target the port solver designs to. */
export const FB_TARGET_TIP = 'The tuning you are designing to. It is an INPUT, not a readout: the '
  + 'port dimensions are calculated from it — the vent length on the enclosure tab is solved '
  + 'to deliver this tuning, and moves whenever you change the vent diameter or the volume.';
/** Cross area is a solved pair with the vent's own shape dimension — diameter round, height
 *  slotted. Width is always an input, never derived. */
export const VENT_GEOMETRY_TIP = 'Cross area is solved from the vent\'s own dimension: diameter for a '
  + 'round vent, height for a slotted one. Width is always an input, never derived. Enter '
  + 'either the dimension or the area and the other is calculated from it.';
/** Fh (Helmholtz Frequency) tooltip explaining meaning and calculation. */
export const FH_TARGET_TIP = 'Fh (Helmholtz Frequency):\n'
  + 'The system tuning frequency of the passive radiator enclosure.\n'
  + 'It represents the Helmholtz resonance of the box volume (Vb) coupled to the passive radiator mass and suspension compliance.\n'
  + 'Formula: Fh = Fs_pr · √(1 + Vas_pr / Vb)';


export function createVentReadouts({ project, projectChanged: changed, selectedBox, air, vent }: VentReadoutsDeps) {
  const activeVent = computed(() => {
    void changed.value;
    void project.value;
    const box = project.value.box;
    return box.ventGroupOf(selectedBox.value).vent;
  });
  /** The tuning goal the vent group designs to: the front chamber's on a 4th-order bandpass. */
  const activeTuning = computed(() => {
    void changed.value;
    void project.value;
    return project.value.box.ventGroupOf(selectedBox.value).tuning_goal_hz;
  });
  // The formula itself lives on VentEngine (UI is display-only) — this just feeds it the
  // currently-active vent's length and the resolved air.
  const portPipeResonance_hz = computed<number | null>(() => {
    void project.value;
    const L = activeVent.value.length_m.value;
    if (L == null) return null;
    return vent.firstResonance_hz(L, air.value);
  });
  // Single-chamber vented tuning uses Vb (the whole box); the bandpass front chamber tunes on
  // its own front volume Vf. The four below are READ-ONLY derived values shown in more than one
  // place (E/C/N badges, warning banners) — genuinely DERIVED state.
  const fbState    = computed<'E' | 'C' | 'N'>(() => { void changed.value; void project.value; return VentMember.TUNING.state(project.value); });
  const ventLState = computed<'E' | 'C' | 'N'>(() => { void changed.value; void project.value; return VentMember.LENGTH.state(project.value); });
  /** The vent's own dq — a `target-unreachable` mark means the entered tuning has no positive
   *  port length in this volume/area; the solver already wrote `length_m` null. */
  const fbUnreachableIssue = computed(() => {
    void changed.value; void project.value;
    return activeVent.value.length_m.dq.find(issue => issue.kind === 'target-unreachable') ?? null;
  });
  const fbUnreachable = computed(() => fbUnreachableIssue.value !== null);
  /** The vent's own dq sentence — the issue carries it, so the Box tab and the Vents tab say
   *  the same thing. */
  const fbUnreachableMsg = computed(() => {
    const issue = fbUnreachableIssue.value;
    return issue === null ? '' : issue.text;
  });
  /** The front chamber of a bandpass is vented on its OWN volume, so it carries its own symbol. */
  const frontChamberTuningLabel = computed(() =>
    DUAL_CHAMBER.has(selectedBox.value) ? 'Target Tuning Freq (Ffc)' : 'Target Tuning Freq');
  /** Typing a tuning enters it; clearing it (or a non-positive value) hands it back to the solver. */
  function setFbTarget(v: number | null): void {
    if (v == null || Number.isNaN(v) || v <= 0) VentMember.TUNING.clear(project.value);
    else VentMember.TUNING.enter(project.value, v);
  }

  return { activeVent, activeTuning, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg, frontChamberTuningLabel, setFbTarget };
}
