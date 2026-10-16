/**
 * The bottom sheet's mode: which rows it shows and where its writes land.
 *
 * - `Tune` writes the live project at once (same path as the Box tab).
 * - `Learn` writes the What-if layer (temporary educational exploration).
 */
import type {BoxType} from '../engine/index.js';
import {SheetField} from './sheetField.js';

/** The sheet's mode: which rows it shows and where its writes land. */
export type SheetEdits = 'project' | 'whatIfLayer';

export class SheetMode {
  static readonly TUNE = new SheetMode('Tune', 'project', SheetMode.#tuneLines);
  static readonly LEARN = new SheetMode('Learn', 'whatIfLayer', t => SheetField.forBox(t).map(f => [f]));
  static readonly ALL: readonly SheetMode[] = Object.freeze([SheetMode.TUNE, SheetMode.LEARN]);

  private constructor(
    readonly label: string,
    readonly edits: SheetEdits,
    readonly lines: (type: BoxType) => readonly (readonly SheetField[])[],
  ) {}

  static #tuneLines(type: BoxType): readonly (readonly SheetField[])[] {
    switch (type) {
      case 'sealed':
        return [
          [SheetField.BOX_VOLUME],
          [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
        ];
      case 'vented':
        return [
          [SheetField.BOX_VOLUME],
          [SheetField.TUNING, SheetField.PORT_AREA],
          [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
        ];
      case 'box-passive-radiator':
        return [
          [SheetField.BOX_VOLUME],
          [SheetField.PR_ADDED_MASS, SheetField.PR_COUNT],
          [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
        ];
      case 'bandpass4':
        return [
          [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME],
          [SheetField.FRONT_TUNING, SheetField.PORT_AREA],
          [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
        ];
      case 'bandpass6':
        return [
          [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME],
          [SheetField.REAR_TUNING],
          [SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA],
          [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
        ];
      case 'abc':
        return [
          [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME],
          [SheetField.REAR_TUNING],
          [SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA],
          [SheetField.INTRA_PORT_AREA],
          [SheetField.INPUT_POWER, SheetField.DRIVER_COUNT],
        ];
    }
  }

  /** Row slots both modes reserve for `type`: the sheet never resizes on a mode switch. */
  static rowSlots(type: BoxType): number {
    return Math.max(...SheetMode.ALL.map(m => m.lines(type).length));
  }
}
