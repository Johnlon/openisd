/**
 * The bottom sheet's mode: which rows it shows and where its writes land.
 *
 * Two separate sheets, never one toggled between the other (John, 17 Oct 2026):
 * - `Tune` changes the project: writes the live project at once (same path as the Box tab).
 * - `What-if` is for experiments: it writes a temporary layer and never changes the project. It
 *   also offers the driver's Fs, Qts and Vas, which Tune does not.
 */
import type {BoxType} from '../engine/index.js';
import {SheetField} from './sheetField.js';

/** The sheet's mode: which rows it shows and where its writes land. */
export type SheetEdits = 'project' | 'whatIfLayer';

export class SheetMode {
  /** The sheet footer's Auto Y box (QO267 mock): its label and what it does. */
  static readonly AUTO_Y_LABEL = 'Auto Y';
  static readonly AUTO_Y_TITLE = 'Auto Y: ticked, the charts fit the curves after every edit. Unticked, the Y axis stays at the range shown when you unticked it.';
  static readonly TUNE = new SheetMode('Tune', 'project', SheetMode.#tuneFields);
  static readonly WHAT_IF = new SheetMode('What-if', 'whatIfLayer', t => SheetField.forBox(t).map(f => [f]));
  static readonly ALL: readonly SheetMode[] = Object.freeze([SheetMode.TUNE, SheetMode.WHAT_IF]);

  private constructor(
    readonly label: string,
    readonly edits: SheetEdits,
    readonly lines: (type: BoxType) => readonly (readonly SheetField[])[],
  ) {}

  /** The Tune fields: the box's main design figures, power and drivers; never the driver's own spec. */
  static #tuneFields(type: BoxType): readonly (readonly SheetField[])[] {
    return SheetField.forBox(type)
      .filter(f => !SheetField.DRIVER_SPEC.includes(f))
      .map(f => [f]);
  }

  /** The name a row carries in this sheet: Tune's real short name, What-if's full name. */
  labelOf(field: SheetField): string {
    switch (this.edits) {
      case 'project': return field.tuneLabel;
      case 'whatIfLayer': return field.label;
    }
  }
}
