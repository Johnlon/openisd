/**
 * The Enclosure tab's vent (port) readouts — vented's own vent for a single-chamber box, or
 * bandpass4's front vent. Skin-neutral: both `OriginalShell-hooks.ts` and the mobile Enclosure
 * tab call this SAME factory (one implementation, two presentations) rather than each shell
 * re-deriving "what does the vent group's E/C/N state and 1st-port-resonance mean".
 */
import {computed} from 'vue';
import type {ComputedRef, Ref} from 'vue';
import {NumberField, PhoneLabels} from '@openisd/design/fields';
import type {OpenISDProject, TuningField, VentPort} from '@openisd/design';
import type {BoxType, VentEngine} from '@openisd/design/engine';

/** A presentation fact with no domain counterpart: these three box types draw two chambers. */
import {DUAL_CHAMBER} from './boxFields.js';

export interface VentReadoutsDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
  selectedBox: Ref<BoxType>;
  vent: VentEngine;
}

/** The tuning row that heads a vent section (Fb in Vents, Frc in Rear vent, Ffc in Front vent); the Intra vent has none. */
function tuningRowOf(port: VentPort): {field: NumberField; label: string; cell: TuningField} | null {
  if (port.tuning_goal_hz === null) return null;
  switch (port.name) {
    case 'Vent': return {field: NumberField.BOX_FB_HZ, label: PhoneLabels.FB, cell: port.tuning_goal_hz};
    case 'Rear': return {field: NumberField.BOX_FRC_HZ, label: PhoneLabels.FRC, cell: port.tuning_goal_hz};
    case 'Front': return {field: NumberField.BOX_FFC_HZ, label: PhoneLabels.FFC, cell: port.tuning_goal_hz};
    case 'Intra': return null;
  }
}
/** The same tuning/length solved pair is editable on Box and on the port panel. */
export const FB_TARGET_TIP = 'Tuning frequency of the chamber and port. Enter a frequency to calculate '
  + 'the port length; enter the port length to calculate the tuning frequency. The calculation uses '
  + 'the chamber volume, port dimensions, number of ports and end correction. An entered frequency '
  + 'that requires an unbuildable port is flagged.';
/** Cross area is a solved pair with the vent's own shape dimension — diameter round, height
 *  slotted. Width is always an input, never derived. */
export const VENT_GEOMETRY_TIP = 'Cross area is solved from the vent\'s own dimension: diameter for a '
  + 'round vent, height for a slotted one. Width is always an input, never derived. Enter '
  + 'either the dimension or the area and the other is calculated from it. The Cross area box adds up all the ports.';
/** Fh (Helmholtz Frequency) tooltip explaining meaning and calculation. */
export const FH_TARGET_TIP = 'Fh (Helmholtz Frequency):\n'
  + 'The system tuning frequency of the passive radiator enclosure.\n'
  + 'It represents the Helmholtz resonance of the box volume (Vb) coupled to the passive radiator mass and suspension compliance.\n'
  + 'Formula: Fh = Fs_pr · √(1 + Vas_pr / Vb)';


export function createVentReadouts({ project, projectChanged: changed, selectedBox, vent }: VentReadoutsDeps) {
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
  // currently-active vent's length and the project's air.
  const portPipeResonance_hz = computed<number | null>(() => {
    void project.value;
    const L = activeVent.value.length_m.value;
    if (L == null) return null;
    return vent.firstResonance_hz(L, project.value.air);
  });
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
  const tuningField = computed(() => DUAL_CHAMBER.has(selectedBox.value) ? NumberField.BOX_FFC_HZ : NumberField.BOX_FB_HZ);

  /** Every port the selected box draws, each with its own first port resonance and unreachable
   *  mark (the single-port readouts above are the active port's). */
  const ventPorts = computed(() => {
    void changed.value;
    void project.value;
    return project.value.box.ventPortsOf(selectedBox.value).map(port => {
      const L = port.vent.length_m.value;
      const issue = port.vent.length_m.dq.find(i => i.kind === 'target-unreachable') ?? null;
      return {
        ...port,
        tuning: tuningRowOf(port),
        portPipeResonance_hz: L == null ? null : vent.firstResonance_hz(L, project.value.air),
        unreachable: issue !== null,
        unreachableMsg: issue === null ? '' : issue.text,
      };
    });
  });

  return { activeVent, activeTuning, ventPorts, portPipeResonance_hz, fbUnreachable, fbUnreachableMsg, tuningField };
}
