/**
 * The fields the What-if? sheet offers: a short list of the values most worth trying, chosen per box
 * type. Each member names the registry `NumberField` that formats, bounds and steps it, and the
 * project slot it edits (`WhatIfSlot`). A member adds no storage: every slot is a field the Box,
 * Enclosure, Driver or Signal tab already writes.
 *
 * Java-style enum (private constructor, static members, `ALL` by reflection). `forBox` is
 * exhaustive over `BoxType`, so a new box type does not compile until it has a list.
 */
import type {BoxType} from '../engine/index.js';
import {NumberField} from './field.js';

/**
 * The project slot a What-if? row reads and writes.
 *
 * - `volume` — the box's own volume, or the rear chamber's on a two-chamber box.
 * - `frontVolume` — the front chamber's volume (bandpass and ABC).
 * - `ventTuning` — the tuning goal of the ported chamber (vented, bandpass4 front); the port
 *   length follows it.
 * - `rearTuning` — the rear chamber's tuning goal (bandpass6, ABC).
 * - `ventDiameter` — the ported chamber's port diameter; the port length follows it.
 * - `prAddedMass`, `prCount` — the passive radiator's added mass and number of radiators.
 * - `driverFs`, `driverQts`, `driverVas` — the driver's own spec, as a what-if.
 * - `driverCount` — the number of drivers.
 * - `inputPower` — the system input power.
 */
export type WhatIfSlot =
  | 'volume' | 'frontVolume' | 'ventTuning' | 'rearTuning' | 'ventDiameter'
  | 'prAddedMass' | 'prCount' | 'driverFs' | 'driverQts' | 'driverVas' | 'driverCount' | 'inputPower';

export class WhatIfField {
  static readonly BOX_VOLUME = new WhatIfField('volume', NumberField.BOX_VB_L, 'Box volume');
  static readonly REAR_VOLUME = new WhatIfField('volume', NumberField.BOX_VB_L, 'Rear volume');
  static readonly FRONT_VOLUME = new WhatIfField('frontVolume', NumberField.BOX_VF_L, 'Front volume');
  static readonly TUNING = new WhatIfField('ventTuning', NumberField.BOX_FB_HZ, 'Tuning (Fb)');
  static readonly FRONT_TUNING = new WhatIfField('ventTuning', NumberField.BOX_FB_HZ, 'Front tuning');
  static readonly REAR_TUNING = new WhatIfField('rearTuning', NumberField.BOX_FRC_HZ, 'Rear tuning');
  static readonly PORT_DIAMETER = new WhatIfField('ventDiameter', NumberField.VENT_D_CM, 'Port diameter');
  static readonly PR_ADDED_MASS = new WhatIfField('prAddedMass', NumberField.PR_MADD_G, 'PR added mass');
  static readonly PR_COUNT = new WhatIfField('prCount', NumberField.PR_NUM, 'Radiators');
  static readonly INPUT_POWER = new WhatIfField('inputPower', NumberField.SIGNAL_PIN_W, 'Input power');
  static readonly DRIVER_FS = new WhatIfField('driverFs', NumberField.FS_HZ, 'Fs');
  static readonly DRIVER_QTS = new WhatIfField('driverQts', NumberField.QTS, 'Qts');
  static readonly DRIVER_VAS = new WhatIfField('driverVas', NumberField.VAS_M3, 'Vas');
  static readonly DRIVER_COUNT = new WhatIfField('driverCount', NumberField.DRIVER_NDRIVERS, 'Drivers');

  /** Every member, built by reflection so none can be left out. Declared last. */
  static readonly ALL: readonly WhatIfField[] = Object.freeze(
    Object.values(WhatIfField).filter((v): v is WhatIfField => v instanceof WhatIfField));

  private constructor(
    /** The project slot the row edits. */
    readonly slot: WhatIfSlot,
    /** The registry field that formats, bounds and steps the value. */
    readonly field: NumberField,
    /** The row's short on-screen name. */
    readonly label: string,
  ) {}

  /** The What-if? rows for a box of `type`, in the order shown: the box first, then the signal,
   *  then the driver. */
  static forBox(type: BoxType): readonly WhatIfField[] {
    return Object.freeze([...WhatIfField.#boxRows(type), ...WhatIfField.#commonRows()]);
  }

  static #boxRows(type: BoxType): readonly WhatIfField[] {
    switch (type) {
      case 'sealed': return [WhatIfField.BOX_VOLUME];
      case 'vented': return [WhatIfField.BOX_VOLUME, WhatIfField.TUNING, WhatIfField.PORT_DIAMETER];
      case 'box-passive-radiator': return [WhatIfField.BOX_VOLUME, WhatIfField.PR_ADDED_MASS, WhatIfField.PR_COUNT];
      case 'bandpass4':
        return [WhatIfField.REAR_VOLUME, WhatIfField.FRONT_VOLUME, WhatIfField.FRONT_TUNING, WhatIfField.PORT_DIAMETER];
      // The bandpass6 and ABC ports are not yet modelled, so only the volumes and the rear
      // chamber's tuning goal (the Box tab's own editable Frc) are offered.
      case 'bandpass6':
      case 'abc':
        return [WhatIfField.REAR_VOLUME, WhatIfField.FRONT_VOLUME, WhatIfField.REAR_TUNING];
    }
  }

  static #commonRows(): readonly WhatIfField[] {
    return [WhatIfField.INPUT_POWER, WhatIfField.DRIVER_FS, WhatIfField.DRIVER_QTS, WhatIfField.DRIVER_VAS, WhatIfField.DRIVER_COUNT];
  }
}
