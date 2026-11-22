/**
 * What a bottom-sheet row reads and writes in a project: one function pair over the `SheetSlot`
 * the row names. The What-if and Tune sheets (skins in `packages/ui`) and the tests that prove
 * every row recalculates all go through these, so the rows have one definition.
 */
import type {BoxType} from '../../engine/index.js';
import type {SheetSlot} from '../../fields/sheetField.js';
import type {NumericDriverSpecFieldName} from '../driver/driverSpecFieldName.js';
import type {Vent} from '../vent.js';
import type {OpenISDProject} from './openISDProject.js';

/** The port a port slot names, or null when the slot is not a port slot or the box has no such port. */
export function ventOfSlot(p: OpenISDProject, type: BoxType, slot: SheetSlot): Vent | null {
    switch (slot) {
        case 'ventArea': case 'frontVentArea': return p.box.ventGroupOf(type).vent;
        case 'rearVentArea': return p.box.rearVentGroupOf(type)?.vent ?? null;
        case 'intraVentArea': return p.box.ventPortsOf(type).find(port => port.name === 'Intra')?.vent ?? null;
        case 'volume': case 'frontVolume': case 'ventTuning': case 'rearTuning': case 'prAddedMass': case 'prCount':
        case 'driverFs': case 'driverQes': case 'driverQms': case 'driverVas': case 'driverCount': case 'inputPower':
            return null;
    }
}

/** The driver spec field a slot edits, or null when the slot is not a driver spec slot. */
export function driverSpecOfSlot(slot: SheetSlot): NumericDriverSpecFieldName | null {
    switch (slot) {
        case 'driverFs': return 'Fs_hz';
        case 'driverQes': return 'Qes';
        case 'driverQms': return 'Qms';
        case 'driverVas': return 'Vas_m3';
        case 'volume': case 'frontVolume': case 'ventTuning': case 'rearTuning':
        case 'ventArea': case 'rearVentArea': case 'frontVentArea': case 'intraVentArea':
        case 'prAddedMass': case 'prCount': case 'driverCount': case 'inputPower':
            return null;
    }
}

/** The value (SI) a slot holds in `p`, or null when the box or driver has none. */
export function readSheetSlot(p: OpenISDProject, type: BoxType, slot: SheetSlot): number | null {
    switch (slot) {
        case 'volume': return p.box.volumeOf(type).value;
        case 'frontVolume': return p.box.frontVolumeOf(type)?.value ?? null;
        case 'ventTuning': return p.box.ventGroupOf(type).tuning_goal_hz.value;
        case 'rearTuning': return p.box.rearTuningOf(type)?.value ?? null;
        case 'ventArea': case 'rearVentArea': case 'frontVentArea': case 'intraVentArea':
            return ventOfSlot(p, type, slot)?.area_m2.value ?? null;
        case 'prAddedMass': return p.box.passiveRadiator.addedMass_kg.value;
        case 'prCount': return p.box.passiveRadiator.count.value;
        case 'driverFs': return p.driver.specField('Fs_hz').value;
        case 'driverQes': return p.driver.specField('Qes').value;
        case 'driverQms': return p.driver.specField('Qms').value;
        case 'driverVas': return p.driver.specField('Vas_m3').value;
        case 'driverCount': return p.nDrivers.value;
        case 'inputPower': return p.powerDrive_W.value;
    }
}

/** Write `v` (SI) to a slot. A port area is one batch with the vent notification, so the port's
 *  diameter and, where the tuning is held, its length follow in the same solve. */
export function writeSheetSlot(p: OpenISDProject, type: BoxType, slot: SheetSlot, v: number): void {
    switch (slot) {
        case 'volume': p.box.volumeOf(type).set(v); return;
        case 'frontVolume': p.box.frontVolumeOf(type)?.set(v); return;
        case 'ventTuning': p.box.ventGroupOf(type).tuning_goal_hz.set(v); return;
        case 'rearTuning': p.box.rearTuningOf(type)?.set(v); return;
        case 'ventArea': case 'rearVentArea': case 'frontVentArea': case 'intraVentArea': {
            const vent = ventOfSlot(p, type, slot);
            if (vent === null) return;
            p.batch(() => {
                vent.area_m2.set(v);
                p.recalc();
            });
            return;
        }
        case 'prAddedMass': p.box.passiveRadiator.addedMass_kg.set(v); return;
        case 'prCount': p.box.passiveRadiator.count.set(Math.round(v)); return;
        case 'driverFs': p.driver.specField('Fs_hz').set(v); return;
        case 'driverQes': p.driver.specField('Qes').set(v); return;
        case 'driverQms': p.driver.specField('Qms').set(v); return;
        case 'driverVas': p.driver.specField('Vas_m3').set(v); return;
        case 'driverCount': p.nDrivers.set(Math.round(v)); return;
        case 'inputPower': p.powerDrive_W.set(v); return;
    }
}
