/**
 * The Tune session, skin-neutral: the focused project's transient what-if layer (begin, reset,
 * cancel) and the rows the Tune sheet edits on it (`TuneField.forBox`). Every write lands in the
 * what-if layer, so Cancel or Reset puts the design back (docs/design/STATE_MODEL.md rule 3).
 * Each row writes through the same path its home tab uses: the vent tuning and port diameter go
 * through `VentMember`, so the port length follows them.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';
import {TuneField, type TuneSlot} from '@openisd/design/fields';
import {VentMember} from '../logic/ventGroup.js';

export interface TuneSessionDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
}

/** One Tune row: the field and its current value in SI, or null when it has none. */
export interface TuneRow {
  readonly tune: TuneField;
  readonly value: number | null;
}

export interface TuneSession {
  /** The rows for the focused project's box type, with live values. */
  readonly rows: ComputedRef<readonly TuneRow[]>;
  /** Start the what-if layer; a no-op while one is active. */
  begin(): void;
  /** Write `v` (SI) to the row's slot, in the what-if layer. */
  set(tune: TuneField, v: number): void;
  /** Put the what-if back to the committed design and keep tuning. */
  reset(): void;
  /** Discard the what-if layer. */
  cancel(): void;
}

function read(p: OpenISDProject, type: BoxType, slot: TuneSlot): number | null {
  switch (slot) {
    case 'volume': return p.box.volumeOf(type).value;
    case 'frontVolume': return p.box.frontVolumeOf(type)?.value ?? null;
    case 'ventTuning': return p.box.ventGroupOf(type).tuning_goal_hz.value;
    case 'rearTuning': return p.box.rearTuningOf(type)?.value ?? null;
    case 'ventDiameter': return p.box.ventGroupOf(type).vent.diameter_m.value;
    case 'prAddedMass': return p.box.passiveRadiator.addedMass_kg.value;
    case 'prCount': return p.box.passiveRadiator.count.value;
    case 'driverFs': return p.driver.specField('Fs_hz').value;
    case 'driverQts': return p.driver.specField('Qts').value;
    case 'driverVas': return p.driver.specField('Vas_m3').value;
    case 'driverCount': return p.nDrivers.value;
    case 'inputPower': return p.powerDrive_W.value;
  }
}

function write(p: OpenISDProject, type: BoxType, slot: TuneSlot, v: number): void {
  switch (slot) {
    case 'volume': p.box.volumeOf(type).set(v); return;
    case 'frontVolume': p.box.frontVolumeOf(type)?.set(v); return;
    case 'ventTuning': VentMember.TUNING.enter(p, v); return;
    case 'rearTuning': p.box.rearTuningOf(type)?.set(v); return;
    case 'ventDiameter': VentMember.DIAMETER.enter(p, v); return;
    case 'prAddedMass': p.box.passiveRadiator.addedMass_kg.set(v); return;
    case 'prCount': p.box.passiveRadiator.count.set(Math.round(v)); return;
    case 'driverFs': p.driver.specField('Fs_hz').set(v); return;
    case 'driverQts': p.driver.specField('Qts').set(v); return;
    case 'driverVas': p.driver.specField('Vas_m3').set(v); return;
    case 'driverCount': p.nDrivers.set(Math.round(v)); return;
    case 'inputPower': p.powerDrive_W.set(v); return;
  }
}

export function createTuneSession({ project, projectChanged }: TuneSessionDeps): TuneSession {
  const rows = computed<readonly TuneRow[]>(() => {
    void projectChanged.value;
    const p = project.value;
    const type = p.box.boxType.value;
    return TuneField.forBox(type).map(tune => ({ tune, value: read(p, type, tune.slot) }));
  });

  function begin(): void { project.value.beginWhatIf(); }

  function set(tune: TuneField, v: number): void {
    const p = project.value;
    // A focus change or file open ends the what-if under an open sheet; a write must never
    // land in the ordinary edit layer, so it starts a new one.
    p.beginWhatIf();
    write(p, p.box.boxType.value, tune.slot, v);
  }

  function reset(): void { project.value.resetWhatIf(); }
  function cancel(): void { project.value.cancelWhatIf(); }

  return { rows, begin, set, reset, cancel };
}
