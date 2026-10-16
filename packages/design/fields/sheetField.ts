/**
 * The fields the bottom sheet offers: a short list of the values most worth trying, chosen per box
 * type. Each member names the registry `NumberField` that formats, bounds and steps it, and the
 * project slot it edits (`SheetSlot`). A member adds no storage: every slot is a field the Box,
 * Enclosure, Driver or Signal tab already writes.
 *
 * Java-style enum (private constructor, static members, `ALL` by reflection). `forBox` is
 * exhaustive over `BoxType`, so a new box type does not compile until it has a list.
 */
import type {BoxType} from '../engine/index.js';
import {NumberField} from './field.js';

/**
 * The project slot a sheet row reads and writes.
 *
 * - `volume` — the box's own volume, or the rear chamber's on a two-chamber box.
 * - `frontVolume` — the front chamber's volume (bandpass and ABC).
 * - `ventTuning` — the tuning goal of the ported chamber (vented, bandpass4 front); the port
 *   length follows it.
 * - `rearTuning` — the rear chamber's tuning goal (bandpass6, ABC).
 * - `ventArea`, `rearVentArea`, `frontVentArea`, `intraVentArea` — one port's cross-sectional area,
 *   whatever its shape (round or slotted); where the port has a tuning goal its length follows.
 * - `prAddedMass`, `prCount` — the passive radiator's added mass and number of radiators.
 * - `driverFs`, `driverQts`, `driverVas` — the driver's own spec.
 * - `driverCount` — the number of drivers.
 * - `inputPower` — the system input power.
 */
export type SheetSlot =
  | 'volume' | 'frontVolume' | 'ventTuning' | 'rearTuning'
  | 'ventArea' | 'rearVentArea' | 'frontVentArea' | 'intraVentArea'
  | 'prAddedMass' | 'prCount' | 'driverFs' | 'driverQts' | 'driverVas' | 'driverCount' | 'inputPower';

export class SheetField {
  static readonly BOX_VOLUME = new SheetField('volume', NumberField.BOX_VB_L, 'Box volume', 'V');
  static readonly REAR_VOLUME = new SheetField('volume', NumberField.BOX_VB_L, 'Rear volume', 'Vr');
  static readonly FRONT_VOLUME = new SheetField('frontVolume', NumberField.BOX_VF_L, 'Front volume', 'Vf');
  static readonly TUNING = new SheetField('ventTuning', NumberField.BOX_FB_HZ, 'Tuning (Fb)', 'Fb');
  static readonly FRONT_TUNING = new SheetField('ventTuning', NumberField.BOX_FB_HZ, 'Front tuning', 'Ff');
  static readonly REAR_TUNING = new SheetField('rearTuning', NumberField.BOX_FRC_HZ, 'Rear tuning', 'Fr');
  /** One port's cross-sectional area, whatever its shape; its length follows the tuning. Tapping the
   *  value opens that port's own fields (`portTitle`). */
  static readonly PORT_AREA = new SheetField('ventArea', NumberField.VENT_CROSSAREA_M2, 'Port area', 'Pp', 'Port');
  static readonly REAR_PORT_AREA = new SheetField('rearVentArea', NumberField.VENT_CROSSAREA_M2, 'Rear port area', 'Pr', 'Rear port');
  static readonly FRONT_PORT_AREA = new SheetField('frontVentArea', NumberField.VENT_CROSSAREA_M2, 'Front port area', 'Pf', 'Front port');
  static readonly INTRA_PORT_AREA = new SheetField('intraVentArea', NumberField.VENT_CROSSAREA_M2, 'Intra port area', 'Pi', 'Intra port');
  static readonly PR_ADDED_MASS = new SheetField('prAddedMass', NumberField.PR_MADD_G, 'PR added mass', 'Madd');
  static readonly PR_COUNT = new SheetField('prCount', NumberField.PR_NUM, 'Radiators', 'Npr');
  static readonly INPUT_POWER = new SheetField('inputPower', NumberField.SIGNAL_PIN_W, 'Input power', 'P');
  static readonly DRIVER_FS = new SheetField('driverFs', NumberField.FS_HZ, 'Fs', 'Fs');
  static readonly DRIVER_QTS = new SheetField('driverQts', NumberField.QTS, 'Qts', 'Qts');
  static readonly DRIVER_VAS = new SheetField('driverVas', NumberField.VAS_M3, 'Vas', 'Vas');
  static readonly DRIVER_COUNT = new SheetField('driverCount', NumberField.DRIVER_NDRIVERS, 'Drivers', 'N');

  /** Every member, built by reflection so none can be left out. Declared last. */
  static readonly ALL: readonly SheetField[] = Object.freeze(
    Object.values(SheetField).filter((v): v is SheetField => v instanceof SheetField));

  private constructor(
    /** The project slot the row edits. */
    readonly slot: SheetSlot,
    /** The registry field that formats, bounds and steps the value. */
    readonly field: NumberField,
    /** The row's full on-screen name (shown in Learn mode). */
    readonly label: string,
    /** The row's compact label (shown in Tune mode). */
    readonly shortLabel: string,
    /** The name of the port this row's value opens the fields of; null for every other row. */
    readonly portTitle: string | null = null,
  ) {}

  /** The sheet rows for a box of `type`, in the order shown: the box first, then the signal,
   *  then the driver. */
  static forBox(type: BoxType): readonly SheetField[] {
    return Object.freeze([...SheetField.#boxRows(type), ...SheetField.#commonRows()]);
  }

  static #boxRows(type: BoxType): readonly SheetField[] {
    switch (type) {
      case 'sealed': return [SheetField.BOX_VOLUME];
      case 'vented': return [SheetField.BOX_VOLUME, SheetField.TUNING, SheetField.PORT_AREA];
      case 'box-passive-radiator': return [SheetField.BOX_VOLUME, SheetField.PR_ADDED_MASS, SheetField.PR_COUNT];
      case 'bandpass4':
        return [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME, SheetField.FRONT_TUNING, SheetField.PORT_AREA];
      // The ports of a bandpass6 and an ABC carry no tuning of their own, so an area edit does not
      // move a length.
      case 'bandpass6':
        return [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME, SheetField.REAR_TUNING,
          SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA];
      case 'abc':
        return [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME, SheetField.REAR_TUNING,
          SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA, SheetField.INTRA_PORT_AREA];
    }
  }

  static #commonRows(): readonly SheetField[] {
    return [SheetField.INPUT_POWER, SheetField.DRIVER_FS, SheetField.DRIVER_QTS, SheetField.DRIVER_VAS, SheetField.DRIVER_COUNT];
  }
}
