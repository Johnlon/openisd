/**
 * WinISD's six box topologies' own circuit classes — one per type, chosen by `boxModel()` below.
 * Every formula, loss-model branch and WinISD quirk is copied exactly onto the class that owns
 * it, mirroring how `../filters/index.ts` structures the filter chain.
 *
 * `boxModel()` takes the full `BoxType`, not `SimulatableBoxType`: `Bandpass6Box`/`AbcBox` exist
 * and are directly reachable here, but `circuit.ts`'s `solve()` (the `Engine.sweep()` production
 * path) and `domain/project/openISDProject.ts` still narrow through `simulatableBoxType()`,
 * which still refuses `bandpass6`/`abc` — widening THAT narrowing breaks non-exhaustive switches
 * in both those files (`types.ts`'s `BoxType` doc). Until that follow-up lands, this factory's
 * bandpass6/abc classes are reachable only by calling `boxModel()` directly (as
 * `test/engine/bandpass6-winisd.test.ts`/`abc-winisd.test.ts` do), never through a swept
 * project.
 */
import type {BoxType, SweepParams} from '../types.js';
import type {BoxModel} from './BoxModel.js';
import {SealedBox} from './SealedBox.js';
import {VentedBox} from './VentedBox.js';
import {PassiveRadiatorBox} from './PassiveRadiatorBox.js';
import {Bandpass4Box} from './Bandpass4Box.js';
import {Bandpass6Box} from './Bandpass6Box.js';
import {AbcBox} from './AbcBox.js';

export type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';
export {SealedBox} from './SealedBox.js';
export {VentedBox} from './VentedBox.js';
export {PassiveRadiatorBox} from './PassiveRadiatorBox.js';
export {Bandpass4Box} from './Bandpass4Box.js';
export {Bandpass6Box} from './Bandpass6Box.js';
export {AbcBox} from './AbcBox.js';
export {portImpedance, portLoss} from './port.js';

/**
 * The one place a `BoxType` becomes behaviour — an exhaustive switch, no default arm: `BoxType`
 * is a closed 6-member union, so an unhandled new topology fails to COMPILE here rather than
 * falling through to a generic model nobody asked for.
 */
export function boxModel(box: BoxType, P: SweepParams): BoxModel {
  switch (box) {
    case 'sealed':                 return new SealedBox();
    case 'vented':                 return new VentedBox(P);
    case 'box-passive-radiator':   return new PassiveRadiatorBox(P);
    case 'bandpass4':              return new Bandpass4Box(P);
    case 'bandpass6':              return new Bandpass6Box(P);
    case 'abc':                    return new AbcBox(P);
  }
}
