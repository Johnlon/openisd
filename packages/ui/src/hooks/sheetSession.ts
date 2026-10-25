/**
 * One bottom sheet's session, skin-neutral: the focused project, the sheet's fixed mode (Tune or
 * What-if), its What-if layer when it is the What-if sheet, and the lines/rows the sheet edits.
 *
 * - The Tune sheet (`edits === 'project'`) writes land directly in the project (no What-if layer).
 * - The What-if sheet (`edits === 'whatIfLayer'`) writes land in the temporary What-if layer.
 *
 * Each sheet has its own session and its mode never changes.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed, getCurrentScope, onScopeDispose} from 'vue';
import {readSheetSlot, ventOfSlot, writeSheetSlot} from '@openisd/design';
import type {OpenISDProject, Vent} from '@openisd/design';
import type {BoxType} from '@openisd/design/engine';
import {SheetField, SheetMode, type SheetSlot} from '@openisd/design/fields';
import {suspendVentSolve} from '../logic/ventGroup.js';

export interface SheetSessionDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
  mode: SheetMode;
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
  /** How many rows the sheet shows for the focused project's box type. */
  readonly rowSlots: ComputedRef<number>;
  /** Start the What-if layer (no-op in Tune). */
  begin(): void;
  /** Write `v` (SI) to the row's slot. Tune writes to the project; What-if writes to the What-if layer. */
  set(field: SheetField, v: number): void;
  /** Put the project's own values back and keep the What-if open (no-op in Tune). */
  reset(): void;
  /** End the session: in What-if, discards its values; in Tune, just closes. */
  close(): void;
}

/** A port-area write also parks the store's auto-solve watch: one user action, one solve. */
function write(p: OpenISDProject, type: BoxType, slot: SheetSlot, v: number): void {
  if (ventOfSlot(p, type, slot) === null) writeSheetSlot(p, type, slot, v);
  else suspendVentSolve(() => writeSheetSlot(p, type, slot, v));
}

export function createSheetSession({ project, projectChanged, mode }: SheetSessionDeps): SheetSession {
  const lines = computed<readonly (readonly SheetRow[])[]>(() => {
    void projectChanged.value;
    const p = project.value;
    const type = p.box.boxType.value;
    const m = mode;
    return m.lines(type).map(line =>
      line.map(field => ({
        field,
        value: readSheetSlot(p, type, field.slot),
        vent: ventOfSlot(p, type, field.slot),
      })),
    );
  });

  const rows = computed<readonly SheetRow[]>(() => lines.value.flat());
  const rowSlots = computed<number>(() => lines.value.length);

  function begin(): void {
    switch (mode.edits) {
      case 'project':
        return;
      case 'whatIfLayer':
        project.value.beginWhatIf();
        return;
    }
  }

  function set(field: SheetField, v: number): void {
    const p = project.value;
    switch (mode.edits) {
      case 'project':
        write(p, p.box.boxType.value, field.slot, v);
        return;
      case 'whatIfLayer':
        p.beginWhatIf();
        write(p, p.box.boxType.value, field.slot, v);
        return;
    }
  }

  function reset(): void {
    switch (mode.edits) {
      case 'project':
        return;
      case 'whatIfLayer':
        project.value.resetWhatIf();
        return;
    }
  }

  function close(): void {
    switch (mode.edits) {
      case 'project':
        return;
      case 'whatIfLayer':
        project.value.cancelWhatIf();
        return;
    }
  }

  // The panel or sheet going away (leaving the Graph page, a skin change) is a way out too.
  if (getCurrentScope() !== undefined) onScopeDispose(close);

  return { lines, rows, rowSlots, begin, set, reset, close };
}
