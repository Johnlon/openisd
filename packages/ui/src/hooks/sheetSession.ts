/**
 * The bottom sheet session, skin-neutral: the focused project's mode (Tune or Learn), its
 * What-if layer when in Learn mode, and the lines/rows the sheet edits.
 *
 * - In Tune mode (`edits === 'project'`), writes land directly in the project (no What-if layer).
 * - In Learn mode (`edits === 'whatIfLayer'`), writes land in the temporary What-if layer.
 *
 * Leaving Learn discards the What-if layer; entering Learn begins one.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed, getCurrentScope, onScopeDispose} from 'vue';
import type {OpenISDProject, Vent} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';
import {SheetField, SheetMode, type SheetSlot} from '@openisd/design/fields';
import {enterVentArea} from '../logic/ventGroup.js';

export interface SheetSessionDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
  mode: Ref<SheetMode>;
}

/** The port a port slot names, or null when the box has no such port. */
function ventOf(p: OpenISDProject, type: BoxType, slot: SheetSlot): Vent | null {
  switch (slot) {
    case 'ventArea': case 'frontVentArea': return p.box.ventGroupOf(type).vent;
    case 'rearVentArea': return p.box.rearVentGroupOf(type)?.vent ?? null;
    case 'intraVentArea': return p.box.ventPortsOf(type).find(port => port.name === 'Intra')?.vent ?? null;
    case 'volume': case 'frontVolume': case 'ventTuning': case 'rearTuning': case 'prAddedMass': case 'prCount':
    case 'driverFs': case 'driverQts': case 'driverVas': case 'driverCount': case 'inputPower':
      return null;
  }
}

/** One sheet row: the field and its current value in SI, or null when it has none. */
export interface SheetRow {
  readonly field: SheetField;
  readonly value: number | null;
  /** The port a port-area row stands for, whose own fields its value opens; null for every other row. */
  readonly vent: Vent | null;
}

export interface SheetSession {
  /** The lines for the focused project's box type and mode: mode.lines(type) mapped to rows. */
  readonly lines: ComputedRef<readonly (readonly SheetRow[])[]>;
  /** The flat rows for the focused project's box type and mode, with live values. */
  readonly rows: ComputedRef<readonly SheetRow[]>;
  /** Row slots reserved for the focused project's box type so the sheet does not resize on mode switch. */
  readonly rowSlots: ComputedRef<number>;
  /** Switch mode: leaving Learn cancels the What-if layer; entering Learn begins one. Tune -> Tune and Learn -> Learn do nothing. */
  setMode(next: SheetMode): void;
  /** Start the What-if layer (no-op in Tune). */
  begin(): void;
  /** Write `v` (SI) to the row's slot. Tune writes to the project; Learn writes to the What-if layer. */
  set(field: SheetField, v: number): void;
  /** Put the project's own values back and keep the What-if open (no-op in Tune). */
  reset(): void;
  /** End the session: in Learn, discards What-if values; in Tune, just closes. */
  close(): void;
}

function read(p: OpenISDProject, type: BoxType, slot: SheetSlot): number | null {
  switch (slot) {
    case 'volume': return p.box.volumeOf(type).value;
    case 'frontVolume': return p.box.frontVolumeOf(type)?.value ?? null;
    case 'ventTuning': return p.box.ventGroupOf(type).tuning_goal_hz.value;
    case 'rearTuning': return p.box.rearTuningOf(type)?.value ?? null;
    case 'ventArea': case 'rearVentArea': case 'frontVentArea': case 'intraVentArea':
      return ventOf(p, type, slot)?.area_m2.value ?? null;
    case 'prAddedMass': return p.box.passiveRadiator.addedMass_kg.value;
    case 'prCount': return p.box.passiveRadiator.count.value;
    case 'driverFs': return p.driver.specField('Fs_hz').value;
    case 'driverQts': return p.driver.specField('Qts').value;
    case 'driverVas': return p.driver.specField('Vas_m3').value;
    case 'driverCount': return p.nDrivers.value;
    case 'inputPower': return p.powerDrive_W.value;
  }
}

function write(p: OpenISDProject, type: BoxType, slot: SheetSlot, v: number): void {
  switch (slot) {
    case 'volume': p.box.volumeOf(type).set(v); return;
    case 'frontVolume': p.box.frontVolumeOf(type)?.set(v); return;
    case 'ventTuning': p.box.ventGroupOf(type).tuning_goal_hz.set(v); return;
    case 'rearTuning': p.box.rearTuningOf(type)?.set(v); return;
    case 'ventArea': case 'rearVentArea': case 'frontVentArea': case 'intraVentArea': {
      const vent = ventOf(p, type, slot);
      if (vent !== null) enterVentArea(p, vent, v);
      return;
    }
    case 'prAddedMass': p.box.passiveRadiator.addedMass_kg.set(v); return;
    case 'prCount': p.box.passiveRadiator.count.set(Math.round(v)); return;
    case 'driverFs': p.driver.specField('Fs_hz').set(v); return;
    case 'driverQts': p.driver.specField('Qts').set(v); return;
    case 'driverVas': p.driver.specField('Vas_m3').set(v); return;
    case 'driverCount': p.nDrivers.set(Math.round(v)); return;
    case 'inputPower': p.powerDrive_W.set(v); return;
  }
}

export function createSheetSession({ project, projectChanged, mode }: SheetSessionDeps): SheetSession {
  const lines = computed<readonly (readonly SheetRow[])[]>(() => {
    void projectChanged.value;
    const p = project.value;
    const type = p.box.boxType.value;
    const m = mode.value;
    return m.lines(type).map(line =>
      line.map(field => ({
        field,
        value: read(p, type, field.slot),
        vent: ventOf(p, type, field.slot),
      })),
    );
  });

  const rows = computed<readonly SheetRow[]>(() => lines.value.flat());
  const rowSlots = computed<number>(() => {
    void projectChanged.value;
    return SheetMode.rowSlots(project.value.box.boxType.value);
  });

  function begin(): void {
    switch (mode.value.edits) {
      case 'project':
        return;
      case 'whatIfLayer':
        project.value.beginWhatIf();
        return;
    }
  }

  function set(field: SheetField, v: number): void {
    const p = project.value;
    switch (mode.value.edits) {
      case 'project':
        write(p, p.box.boxType.value, field.slot, v);
        return;
      case 'whatIfLayer':
        p.beginWhatIf();
        write(p, p.box.boxType.value, field.slot, v);
        return;
    }


  }

  function setMode(next: SheetMode): void {
    const current = mode.value;
    if (current.edits === next.edits) return;
    switch (current.edits) {
      case 'whatIfLayer':
        project.value.cancelWhatIf();
        break;
      case 'project':
        project.value.beginWhatIf();
        break;
    }
    mode.value = next;
  }


  function reset(): void {
    switch (mode.value.edits) {
      case 'project':
        return;
      case 'whatIfLayer':
        project.value.resetWhatIf();
        return;
    }
  }

  function close(): void {
    switch (mode.value.edits) {
      case 'project':
        return;
      case 'whatIfLayer':
        project.value.cancelWhatIf();
        return;
    }
  }

  // The panel or sheet going away (leaving the Graph page, a skin change) is a way out too.
  if (getCurrentScope() !== undefined) onScopeDispose(close);

  return { lines, rows, rowSlots, setMode, begin, set, reset, close };
}
