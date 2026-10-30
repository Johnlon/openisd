import type {ComputedRef, Ref} from 'vue';
import {useApp} from '../logic/app.js';
import {computed} from 'vue';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {cellClassOf} from '../logic/driverCells.js';
import type {Calculated, Clearable, Entered, Precise, ProvenanceLetter, Readable, Writable} from '@openisd/design';
import {driverSpecOfSlot, ventOfSlot} from '@openisd/design';
import type {DqIssue} from '@openisd/design/engine';
import {type NumberField, SheetField, SheetMode} from '@openisd/design/fields';
import type {SheetSlot} from '@openisd/design/fields';
import type {BoxType} from '@openisd/design/engine';
import type {NumSpecField} from '../logic/appState.js';
import {createSheetSession} from './sheetSession.js';
import type {ClearableUICell} from '../ui/components/uiFieldBinding.js';

export type NumKey = NumSpecField;
export type { NumSpecField };

/**
 * The desktop What-if? panel's hook. Every write lands in the focused project's What-if layer,
 * never in the project: a write with no What-if open (the panel restored by a reload) starts
 * one. `close` ends it and the project is as it was; `reset` puts the project's values back.
 */
/** One driver row of the panel: the spec field it edits, its registry field and its label. */
export interface WhatIfDriverRow { readonly key: NumSpecField; readonly def: NumberField; readonly label: string }
export interface WhatIfBoxRow { readonly field: SheetField; readonly value: number | null; readonly cell: ClearableUICell | null }
export interface WhatIfPortLengthRow { readonly key: string; readonly label: string; readonly portName: 'Vent' | 'Rear' | 'Front'; readonly cell: ClearableUICell }

// The driver rows the phone What-if sheet offers (Fs, Qes, Qms, Vas) come from the same design list.
const SHEET_ROWS: readonly WhatIfDriverRow[] = SheetField.DRIVER_SPEC.flatMap(row => {
  const key = driverSpecOfSlot(row.slot);
  return key === null ? [] : [{ key, def: row.field, label: row.label }];
});

/**
 * A field row's cell whose every write first starts the What-if layer, so the row writes into the
 * What-if and never the project. Reads and writes go to the one cell behind it.
 */
class WhatIfCell implements ClearableUICell {
  constructor(private readonly cell: ClearableUICell, private readonly begin: () => void) {}
  get name(): string { return this.cell.name; }
  get value(): number | null { return this.cell.value; }
  get provenance(): ProvenanceLetter { return this.cell.provenance; }
  get dq(): readonly DqIssue[] { return this.cell.dq; }
  get mandatoryAndUnsatisfied(): boolean { return this.cell.mandatoryAndUnsatisfied; }
  get entered(): boolean { return this.cell.entered; }
  get precision(): number | null { return this.cell.precision; }
  set(v: number, precision?: number): void { this.begin(); this.cell.set(v, precision); }
  clear(): void { this.begin(); this.cell.clear(); }
}

export interface OriginalWhatIfAPI {
  /** The driver rows shared with the phone What-if sheet, in its order. */
  readonly sheetRows: readonly WhatIfDriverRow[];
  /** The active box's editable fields, from the same type-aware list as the mobile sheet. */
  readonly boxRows: ComputedRef<readonly WhatIfBoxRow[]>;
  /** Port lengths paired with the tuning rows shown in the desktop What-if. */
  readonly portLengthRows: ComputedRef<readonly WhatIfPortLengthRow[]>;
  setBoxField(field: SheetField, value: number): void;
  readonly ebp: Readonly<Ref<number | null>>;
  readonly vb_m3: Readonly<Ref<number | null>>;

  specField(key: NumSpecField): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable;
  /** The row's cell for a field row: a write or an emptied box lands in the What-if layer. */
  specCell(key: NumSpecField): ClearableUICell;
  /** The box volume as a field row's cell. An emptied box leaves the What-if volume blank, never 0. */
  readonly vbCell: Readonly<Ref<ClearableUICell>>;
  cellClass(key: NumSpecField): string;
  cellVal(key: NumSpecField): number | null;
  dqNote(key: NumSpecField): string | null;

  /** `precision` is what the typed characters STATE, in SI — see `Writable.set`. */
  enterField(key: NumSpecField, v: number, precision?: number): void;
  clearField(key: NumSpecField): void;
  setVb_m3(v: number): void;
  reset(): Promise<void>;
  /** End the What-if: its values are discarded. */
  close(): void;
}

export function useOriginalWhatIf(): OriginalWhatIfAPI {
  const {projectChanged} = useApp().appState;
  const project = useFocusedProject();
  const session = createSheetSession({ project, projectChanged, mode: SheetMode.WHAT_IF });

  function boxCell(type: BoxType, slot: SheetSlot): ClearableUICell {
    const box = project.value.box;
    switch (slot) {
      case 'volume': return box.volumeOf(type);
      case 'frontVolume': return box.frontVolumeOf(type) ?? missingBoxField(slot);
      case 'ventTuning': return box.ventGroupOf(type).tuning_goal_hz;
      case 'rearTuning': return box.rearTuningOf(type) ?? missingBoxField(slot);
      case 'ventArea': case 'rearVentArea': case 'frontVentArea': case 'intraVentArea':
        return ventOfSlot(project.value, type, slot)?.area_m2 ?? missingBoxField(slot);
      case 'prAddedMass': return box.passiveRadiator.addedMass_kg;
      case 'prCount': return missingBoxField(slot);
      case 'driverFs': case 'driverQes': case 'driverQms': case 'driverVas':
      case 'driverCount': case 'inputPower':
        return missingBoxField(slot);
    }
  }

  function missingBoxField(slot: SheetSlot): never {
    throw new Error(`What-if box field is not available for this box: ${slot}`);
  }

  const boxRows = computed<readonly WhatIfBoxRow[]>(() => {
    void projectChanged.value;
    const type = project.value.box.boxType.value;
    return session.rows.value
      .filter(row => row.field !== SheetField.INPUT_POWER && row.field !== SheetField.DRIVER_COUNT && !SheetField.DRIVER_SPEC.includes(row.field))
      .map(row => ({
        field: row.field,
        value: row.value,
        cell: row.field.slot === 'prCount' ? null : new WhatIfCell(boxCell(type, row.field.slot), session.begin),
      }));
  });

  const portLengthRows = computed<readonly WhatIfPortLengthRow[]>(() => {
    void projectChanged.value;
    const type = project.value.box.boxType.value;
    const ports = project.value.box.ventPortsOf(type);
    return session.rows.value.flatMap(row => {
      if (row.field.slot !== 'ventTuning' && row.field.slot !== 'rearTuning') return [];
      const portName: WhatIfPortLengthRow['portName'] = row.field.slot === 'rearTuning' ? 'Rear' : type === 'vented' ? 'Vent' : 'Front';
      const port = ports.find(candidate => candidate.name === portName);
      if (!port) return [];
      const label = portName === 'Vent' ? 'Port length' : `${portName} port length`;
      return [{key: `${portName.toLowerCase()}-port-length`, label, portName, cell: new WhatIfCell(port.vent.length_m, session.begin)}];
    });
  });

  function setBoxField(field: SheetField, value: number): void {
    session.begin();
    session.set(field, value);
  }


  function specField(key: NumSpecField):
      Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable {
    return project.value.driver.specField(key);
  }

  // `projectChanged` as well as `project`: the registry hands out the SAME project instance for
  // its whole life, so `project.value` never invalidates a cached computed after a write. Reading
  // only it froze `vb_m3` at the volume the panel opened with, which NumInput's blur reformat then
  // put back on screen (John, 2026-09-25: "Vb is the only one that's a problem"). Same rule as
  // `createBoxVolume` in `boxFields.ts`.
  const ebp = computed(() => {
    void projectChanged.value; void project.value;
    return project.value.driver.specs.EBP_hz.value;
  });

  const vb_m3 = computed<number | null>(() => {
    void projectChanged.value; void project.value;
    const box = project.value.box;
    return box.volumeOf(box.boxType.value).value;
  });

  const vbCell = computed<ClearableUICell>(() => {
    void projectChanged.value;
    const box = project.value.box;
    return new WhatIfCell(box.volumeOf(box.boxType.value), session.begin);
  });

  function specCell(key: NumSpecField): ClearableUICell {
    return new WhatIfCell(specField(key), session.begin);
  }

  function setVb_m3(v: number): void {
    session.begin();
    const box = project.value.box;
    box.volumeOf(box.boxType.value).set(v);
  }

  function cellClass(key: NumSpecField): string {
    return cellClassOf(specField(key));
  }

  /** A bad value (≤ 0, non-finite) is marked by the DOMAIN, on the field's own `.dq`
   *  (`Engine.positiveValueIssue`, BUG_20260927_driver-bad-value-decided-in-ui.md) — this reads
   *  that mark, never judges the value itself, same as the driver editor's own `dqNoteFor`.
   *  Each issue carries its own sentence. Joining the issues themselves put "[object Object]"
   *  in the tooltip, which nothing noticed while this panel's dq was always empty (the marks
   *  were computed and then discarded with the rebuilt embedded driver). */
  function dqNote(key: NumSpecField): string | null {
    return specField(key).dq.map(issue => issue.text).join('\n');
  }

  function cellVal(key: NumSpecField): number | null {
    const v = specField(key).value;
    return typeof v === 'number' ? v : null;
  }

  function enterField(key: NumSpecField, v: number, precision?: number): void {
    session.begin();
    specField(key).set(v, precision);
  }

  function clearField(key: NumSpecField): void {
    session.begin();
    specField(key).clear();
  }

  async function reset(): Promise<void> {
    session.reset();
  }

  return {
    sheetRows: SHEET_ROWS,
    boxRows,
    portLengthRows,
    setBoxField,
    ebp,
    vb_m3,
    vbCell,
    specCell,
    specField,
    cellClass,
    cellVal,
    dqNote,
    enterField,
    clearField,
    setVb_m3,
    close: session.close,
    reset,
  };
}
