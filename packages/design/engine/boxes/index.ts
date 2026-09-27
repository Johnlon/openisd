/**
 * WinISD's four simulatable box topologies — one class per type, chosen by `boxModel()` below.
 * Every formula, loss-model branch and WinISD quirk is copied exactly onto the class that owns
 * it, mirroring how `../filters/index.ts` structures the filter chain.
 */
import type {SimulatableBoxType, SweepParams} from '../types.js';
import type {BoxModel} from './BoxModel.js';
import {SealedBox} from './SealedBox.js';
import {VentedBox} from './VentedBox.js';
import {PassiveRadiatorBox} from './PassiveRadiatorBox.js';
import {Bandpass4Box} from './Bandpass4Box.js';

export type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';
export {SealedBox} from './SealedBox.js';
export {VentedBox} from './VentedBox.js';
export {PassiveRadiatorBox} from './PassiveRadiatorBox.js';
export {Bandpass4Box} from './Bandpass4Box.js';
export {portImpedance, portLoss} from './port.js';

/**
 * The one place a `SimulatableBoxType` becomes behaviour — an exhaustive switch, no default
 * arm: `SimulatableBoxType` is a closed 4-member union, so an unhandled new topology fails to
 * COMPILE here rather than falling through to a generic model nobody asked for.
 *
 * Takes `SimulatableBoxType`, not the full `BoxType` — the same narrowing `types.ts`'s own
 * `simulatableBoxType()` performs, so `bandpass6`/`abc` (declared but not modelled) are refused
 * by that ONE function rather than needing a second, redundant case here.
 */
export function boxModel(box: SimulatableBoxType, P: SweepParams): BoxModel {
  switch (box) {
    case 'sealed':                 return new SealedBox();
    case 'vented':                 return new VentedBox(P);
    case 'box-passive-radiator':   return new PassiveRadiatorBox(P);
    case 'bandpass4':              return new Bandpass4Box(P);
  }
}
