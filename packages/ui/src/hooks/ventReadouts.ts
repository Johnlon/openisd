/**
 * The Enclosure tab's vent (port) readouts — vented's own vent for a single-chamber box, or
 * bandpass4's front vent. Skin-neutral: both `OriginalShell-hooks.ts` and the mobile Enclosure
 * tab call this SAME factory (one implementation, two presentations) rather than each shell
 * re-deriving "what does the vent group's E/C/N state and 1st-port-resonance mean".
 */
import {computed} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import {ventFieldState as ventFieldStateOn} from '../logic/useVentGroup.js';
import type {OpenISDProject} from '@openisd/design';
import type {BoxType, EnvironmentEngine} from '@openisd/design/engine';

/** A presentation fact with no domain counterpart: these three box types draw two chambers. */
export const DUAL_CHAMBER = new Set<BoxType>(['bandpass4', 'bandpass6', 'abc']);

export interface VentReadoutsDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
  selectedBox: Ref<BoxType>;
  air: ComputedRef<ReturnType<EnvironmentEngine['solve']>['values']>;
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

export function createVentReadouts({ project, projectChanged: changed, selectedBox, air }: VentReadoutsDeps) {
  const activeVent = computed(() => {
    void changed.value;
    void project.value;
    const box = project.value.box;
    return selectedBox.value === 'bandpass4' ? box.bandpass4.vents.front : box.vented.vent;
  });
  // First port (organ-pipe) resonance of the vent tube itself — the open-open duct fundamental
  // c/(2·L). Uses the PHYSICAL vent length (NOT the end-corrected Leff) to match WinISD exactly.
  const portPipeResonance_hz = computed<number | null>(() => {
    void project.value;
    const L = activeVent.value.length_m.value;
    if (L == null || L <= 0) return null;
    return air.value.c / (2 * L);
  });
  // Single-chamber vented tuning uses Vb (the whole box); the bandpass front chamber tunes on
  // its own front volume Vf. The four below are READ-ONLY derived values shown in more than one
  // place (E/C/N badges, warning banners) — genuinely DERIVED state.
  const fbState    = computed<'E' | 'C' | 'N'>(() => { void changed.value; void project.value; return ventFieldStateOn(project.value, 'Fb'); });
  const ventLState = computed<'E' | 'C' | 'N'>(() => { void changed.value; void project.value; return ventFieldStateOn(project.value, 'ventL'); });
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
  return { activeVent, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg, frontChamberTuningLabel };
}
