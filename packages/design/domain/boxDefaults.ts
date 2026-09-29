/**
 * The starting values a brand-new box is built from. Split out of `openisdSchema.ts` (that file
 * declares data shapes only) — this is logic: WinISD's own defaults for a freshly-created box,
 * and how they compose into a box with nothing designed yet.
 */
import type {
    ChamberJson, CoupledSealedLossesJson, CoupledVentedLossesJson, OpenISDBoxJson,
    RadiatorDeviceJson, SealedLossesJson, VentedLossesJson, VentJson,
} from './openisdSchema.js';

// Shared const objects, the starting values a brand-new box is built from. Values are WinISD's
// own defaults for a freshly-created box (packages/design/winisd/winisdProject.ts TEMPLATE:
// Ql=10, Qa=100, Qp=100, Qiclfr=100) — not invented numbers.
//
// Each is `Object.freeze`d so no assignment or mutating call on it can compile or run — see
// packages/design/AGENTS.md "Keep module-scoped state immutable". Every use still SPREADS the
// value (`{ ...NO_VENTED_CHAMBER }`) so the object reaching a project record is always a fresh
// copy, never the shared one.
const NO_SEALED_LOSSES: SealedLossesJson = Object.freeze({Ql: 10, Qa: 100});
const NO_VENTED_LOSSES: VentedLossesJson = Object.freeze({Ql: 10, Qa: 100, Qp: 100});
const NO_COUPLED_SEALED_LOSSES: CoupledSealedLossesJson =
    Object.freeze({Ql: 10, Qa: 100, Qicl: 100});
const NO_COUPLED_VENTED_LOSSES: CoupledVentedLossesJson =
    Object.freeze({Ql: 10, Qa: 100, Qp: 100, Qicl: 100});
const NO_VENT: VentJson = Object.freeze({
    shape: 'round',
    width_m: null,
    // Absent, not null (S7-a): a `SpecEntryJson` slot's "not-available" is the key missing.
    // WinISD's default port end correction: TWO FREE ENDS (0.613). The earlier 0.6 matched none
    // of the UI's END_CORRECTION_OPTIONS, so the select rendered blank (BUG_20260912 #10).
    endCorrection_m: 0.613,
});
const NO_VENTED_CHAMBER: ChamberJson =
    Object.freeze({volume_m3: 0, losses: NO_VENTED_LOSSES});
const NO_COUPLED_SEALED_CHAMBER =
    Object.freeze({volume_m3: 0, losses: NO_COUPLED_SEALED_LOSSES});
const NO_COUPLED_VENTED_CHAMBER =
    Object.freeze({volume_m3: 0, losses: NO_COUPLED_VENTED_LOSSES});

/** A box with nothing designed yet — every box type present and inert, matching the
 *  dormant-data rule (the box holds EVERY box type at once and names which is active, rather
 *  than leaving callers to honour that themselves). */
export function emptyBoxJson(radiator: RadiatorDeviceJson): OpenISDBoxJson {
    return {
        boxType: 'sealed',
        sealed: {volume_m3: 0, losses: NO_SEALED_LOSSES},
        vented: {chamber: NO_VENTED_CHAMBER, vent: NO_VENT},
        bandpass4: {rear: NO_COUPLED_SEALED_CHAMBER, front: NO_COUPLED_VENTED_CHAMBER, frontVent: NO_VENT},
        bandpass6: {
            rear: NO_COUPLED_VENTED_CHAMBER,
            front: NO_COUPLED_VENTED_CHAMBER,
            rearVent: NO_VENT,
            frontVent: NO_VENT,
        },
        abc: {
            rear: NO_COUPLED_VENTED_CHAMBER,
            front: NO_COUPLED_VENTED_CHAMBER,
            rearVent: NO_VENT,
            frontVent: NO_VENT,
            intraVent: NO_VENT,
        },
        passiveRadiator: {
            volume_m3: 0,
            // tuning_goal_hz/addedMass_kg absent, not null (S7-a): a `SpecEntryJson` slot's
            // "not-available" is the key missing.
            count: 1,
            losses: NO_SEALED_LOSSES,
            component: radiator,
        },
    };
}
