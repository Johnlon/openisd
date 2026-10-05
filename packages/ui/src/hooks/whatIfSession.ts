/**
 * The What-if? session, skin-neutral: the focused project's What-if layer (begin, reset, close)
 * and the rows the What-if? sheet edits on it (`WhatIfField.forBox`). Every write lands in the
 * What-if layer and never in the project. Closing, or the panel going away, discards it; Reset
 * puts the project's values back (docs/design/STATE_MODEL.md rule 3). Each row writes through the
 * same path its home tab uses: the vent tuning and port diameter go through `VentMember`, so the
 * port length follows them.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed, getCurrentScope, onScopeDispose} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';
import {WhatIfField, type WhatIfSlot} from '@openisd/design/fields';
import {VentMember} from '../logic/ventGroup.js';

export interface WhatIfSessionDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
}

/** One What-if? row: the field and its current value in SI, or null when it has none. */
export interface WhatIfRow {
  readonly field: WhatIfField;
  readonly value: number | null;
}

export interface WhatIfSession {
  /** The rows for the focused project's box type, with live values. */
  readonly rows: ComputedRef<readonly WhatIfRow[]>;
  /** Start the What-if layer; a no-op while one is active. */
  begin(): void;
  /** Write `v` (SI) to the row's slot, in the What-if layer. */
  set(field: WhatIfField, v: number): void;
  /** Put the project's own values back and keep the What-if open. */
  reset(): void;
  /** End the What-if: its values are discarded, the project is as it was. */
  close(): void;
}

function read(p: OpenISDProject, type: BoxType, slot: WhatIfSlot): number | null {
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

function write(p: OpenISDProject, type: BoxType, slot: WhatIfSlot, v: number): void {
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

export function createWhatIfSession({ project, projectChanged }: WhatIfSessionDeps): WhatIfSession {
  const rows = computed<readonly WhatIfRow[]>(() => {
    void projectChanged.value;
    const p = project.value;
    const type = p.box.boxType.value;
    return WhatIfField.forBox(type).map(field => ({ field, value: read(p, type, field.slot) }));
  });

  function begin(): void { project.value.beginWhatIf(); }

  function set(field: WhatIfField, v: number): void {
    const p = project.value;
    // A focus change or file open ends the What-if under an open sheet; a write must never
    // land in the project, so it starts a new one.
    p.beginWhatIf();
    write(p, p.box.boxType.value, field.slot, v);
  }

  function reset(): void { project.value.resetWhatIf(); }
  function close(): void { project.value.cancelWhatIf(); }
  // The panel or sheet going away (leaving the Graph page, a skin change) is a way out too.
  if (getCurrentScope() !== undefined) onScopeDispose(close);

  return { rows, begin, set, reset, close };
}
