/**
 * The load repair rules (`loadRepair.ts`) of a project record's own values, beside the drive level's
 * (`ProjectSignal.loadRepairRules`): the air, the driver count, the series resistance, and the
 * active box's tunings, port lengths, losses and passive radiator. A box volume of 0 is not repaired:
 * it is how a built project holds a chamber nothing has designed yet (`ProjectBuilder.empty()`). Each rule is the
 * field's own `NumberField.loadRepair`; this file only says where in the record each field lives.
 *
 * John, 18 Nov 2026 (QO953.c27-c32): a loaded impossible value is repaired automatically; a loaded
 * 0 where 0 is impossible counts as an empty box ("a 0 is just the same as clearing the value in a
 * sense", c28): a field the app can calculate is calculated, the others get their minimum or default;
 * the box shows the repaired value with no data-quality mark and the opening toast lists it.
 */
import {NumberField} from '../../fields/field.js';
import {enteredEntry} from '../specEntry.js';
import {focus, simpleField} from '../cell.js';
import type {SimpleField} from '../cell.js';
import type {
    ChamberJson, OpenISDBoxJson, OpenISDProjectJson, SealedLossesJson, SpecEntryJson, VentedLossesJson, VentJson,
} from '../openisdSchema.js';
import {fieldLoadRule, loadEmptiedText, repairLoaded} from './loadRepair.js';
import type {LoadRepairNote, LoadRepairRule} from './loadRepair.js';

/** A rule over a plain number slot: the field's repair always sets a number there. */
function numberRule(field: NumberField, slot: SimpleField<number>): LoadRepairRule {
    return fieldLoadRule(field, () => slot.value, v => {
        if (v === null) throw new Error(`${field.value} repairs to a number: its slot cannot be emptied`);
        slot.set(v);
    });
}

/** A rule over an entry slot: only an entered value is checked (a calculated one is worked out
 *  again by the resolve); emptied is the key absent, so the resolve calculates it or fills it. */
function entryRule(field: NumberField, slot: SimpleField<SpecEntryJson | undefined>): LoadRepairRule {
    return fieldLoadRule(field,
        () => {
            const entry = slot.value;
            return entry?.state === 'E' ? entry.value : null;
        },
        v => slot.set(v === null ? undefined : enteredEntry(v)));
}

function sealedLossRules(losses: SimpleField<SealedLossesJson>): LoadRepairRule[] {
    return [numberRule(NumberField.LOSS_QL, focus(losses, 'Ql')), numberRule(NumberField.LOSS_QA, focus(losses, 'Qa'))];
}

function ventedLossRules(losses: SimpleField<VentedLossesJson>): LoadRepairRule[] {
    return [
        numberRule(NumberField.LOSS_QL, focus(losses, 'Ql')), numberRule(NumberField.LOSS_QA, focus(losses, 'Qa')),
        numberRule(NumberField.LOSS_QP, focus(losses, 'Qp')),
    ];
}

/** A chamber's tuning (`tuning`: Fb, Ffc or Frc), paired with its port's length: an emptied tuning
 *  is worked out from the length the file gave, which becomes the entered side of the pair. */
function tuningRule(tuning: NumberField, goal: SimpleField<SpecEntryJson | undefined>, vent: SimpleField<VentJson>): LoadRepairRule {
    const length = focus(vent, 'length_m');
    return fieldLoadRule(tuning,
        () => {
            const entry = goal.value;
            return entry?.state === 'E' ? entry.value : null;
        },
        v => {
            goal.set(v === null ? undefined : enteredEntry(v));
            const stated = length.value;
            if (v === null && stated !== undefined && stated.state !== 'N' && stated.value > 0) length.set(enteredEntry(stated.value));
        });
}

/** A vented chamber and its port: the tuning, the losses and the port's length. The port's
 *  length runs first, so a negative one is emptied before the tuning could be worked out from it. */
function ventedChamberRules(chamber: SimpleField<ChamberJson>, vent: SimpleField<VentJson>, tuning: NumberField): LoadRepairRule[] {
    return [
        ...ventRules(vent),
        tuningRule(tuning, focus(chamber, 'tuning_goal_hz'), vent),
        ...ventedLossRules(focus(chamber, 'losses')),
    ];
}

function ventRules(vent: SimpleField<VentJson>): LoadRepairRule[] {
    return [entryRule(NumberField.VENT_L_CM, focus(vent, 'length_m'))];
}

/** The radiator figures a record states, each with the field that names it (T930). */
const RADIATOR_FIGURES = [
    ['Fs_hz', NumberField.PR_FS_HZ], ['Qms', NumberField.PR_QMS], ['Vas_m3', NumberField.PR_VAS_L],
    ['Sd_m2', NumberField.PR_SD_CM2], ['Mms_kg', NumberField.MMS_KG], ['Cms_m_per_N', NumberField.CMS_M_PER_N],
    ['Rms_kg_per_s', NumberField.RMS_KG_PER_S],
] as const;

/** The passive radiator the box holds, whichever box type is active: an entered figure of 0 or
 *  below is no radiator figure, so it counts as an empty box: calculated from the radiator's other
 *  figures when they give it, else left empty (a box the datasheet never states stays empty). */
function radiatorFigureRules(box: SimpleField<OpenISDBoxJson>): LoadRepairRule[] {
    const component = focus(focus(focus(box, 'passiveRadiator'), 'component'), 'specs');
    const section = focus(component, 'passive-radiator');
    return RADIATOR_FIGURES.map(([key, field]): LoadRepairRule => {
        return {
            field,
            loaded: () => {
                const entry = section.value[key];
                return entry?.state === 'E' ? entry.value : null;
            },
            breaks: v => !Number.isFinite(v) || v <= 0,
            fix: v => ({value: null, text: `Passive radiator ${loadEmptiedText(field, v, "the value worked out from the radiator's other figures, or empty when they do not give it")}`}),
            write: () => {
                const {[key]: _removed, ...rest} = section.value;
                section.set(rest);
            },
        };
    });
}

/** The rules of the box type the project is set to; the other types' records are not shown. */
function boxRules(box: SimpleField<OpenISDBoxJson>): LoadRepairRule[] {
    const type = box.value.boxType;
    switch (type) {
        case 'sealed': {
            const sealed = focus(box, 'sealed');
            return sealedLossRules(focus(sealed, 'losses'));
        }
        case 'vented': {
            const vented = focus(box, 'vented');
            return ventedChamberRules(focus(vented, 'chamber'), focus(vented, 'vent'), NumberField.BOX_FB_HZ);
        }
        case 'bandpass4': {
            const bp = focus(box, 'bandpass4');
            const rear = focus(bp, 'rear');
            return [
                ...sealedLossRules(focus(rear, 'losses')),
                ...ventedChamberRules(focus(bp, 'front'), focus(bp, 'frontVent'), NumberField.BOX_FFC_HZ),
                numberRule(NumberField.LOSS_QICL, focus(bp, 'Qiclfr')),
            ];
        }
        case 'bandpass6': {
            const bp = focus(box, 'bandpass6');
            return [
                ...ventedChamberRules(focus(bp, 'rear'), focus(bp, 'rearVent'), NumberField.BOX_FRC_HZ),
                ...ventedChamberRules(focus(bp, 'front'), focus(bp, 'frontVent'), NumberField.BOX_FFC_HZ),
                numberRule(NumberField.LOSS_QICL, focus(bp, 'Qiclfr')),
            ];
        }
        case 'abc': {
            const abc = focus(box, 'abc');
            return [
                ...ventedChamberRules(focus(abc, 'rear'), focus(abc, 'rearVent'), NumberField.BOX_FRC_HZ),
                ...ventedChamberRules(focus(abc, 'front'), focus(abc, 'frontVent'), NumberField.BOX_FFC_HZ),
                ...ventRules(focus(abc, 'intraVent')),
                numberRule(NumberField.LOSS_QICL, focus(abc, 'Qiclfr')),
            ];
        }
        case 'box-passive-radiator': {
            const pr = focus(box, 'passiveRadiator');
            return [
                numberRule(NumberField.PR_NUM, focus(pr, 'count')),
                entryRule(NumberField.PR_MADD_G, focus(pr, 'addedMass_kg')),
                ...sealedLossRules(focus(pr, 'losses')),
            ];
        }
    }
}

/** Every record rule, in the order they run: the driver count and series resistance first (the
 *  drive level's own rules, run after these, read them), then the air, then the box. */
export function projectLoadRepairRules(root: SimpleField<OpenISDProjectJson>): readonly LoadRepairRule[] {
    const embedding = focus(root, 'driverEmbedding');
    const environment = focus(root, 'environment');
    return [
        numberRule(NumberField.DRIVER_NDRIVERS, focus(embedding, 'nDrivers')),
        numberRule(NumberField.SIGNAL_RS_OHM, focus(embedding, 'Rs_ohm')),
        entryRule(NumberField.ADV_TEMP_K, focus(environment, 'temperature_K')),
        entryRule(NumberField.ADV_HUMIDITY_PCT, focus(environment, 'humidity_pct')),
        entryRule(NumberField.ADV_PRESSURE_KPA, focus(environment, 'pressure_Pa')),
        entryRule(NumberField.ADV_SOUNDVELOCITY_M_PER_S, focus(environment, 'c_m_per_s')),
        entryRule(NumberField.ADV_AIRDENSITY_KG_PER_M3, focus(environment, 'roo_kg_per_m3')),
        ...boxRules(focus(root, 'box')),
        ...radiatorFigureRules(focus(root, 'box')),
    ];
}

/** A record as the load repair left it, and the repairs made. */
export interface RepairedRecord {
    readonly record: OpenISDProjectJson;
    readonly notes: readonly LoadRepairNote[];
}

/** `record` with every rule of `projectLoadRepairRules` applied, before any resolve has read it. */
export function repairedRecord(record: OpenISDProjectJson): RepairedRecord {
    let current = record;
    const notes = repairLoaded(projectLoadRepairRules(simpleField(() => current, v => { current = v; })));
    return {record: current, notes};
}
