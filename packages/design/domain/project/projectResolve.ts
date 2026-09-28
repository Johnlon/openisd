import type { Engine } from '../../engine/index.js';
import type { Air, DqIssue, PrIssue, SealedAlignmentIssue, VentIssue } from '../../engine/index.js';
import { focus, inputOf } from '../cell.js';
import type { DefaultingFieldImpl, DualWriteFieldImpl, SimpleField } from '../cell.js';
import { calcVentCount, enteredEntry } from '../specEntry.js';
import type { OpenISDEnvironmentJson, OpenISDProjectJson } from '../openisdSchema.js';
import type { Vent } from '../vent.js';
import { isPortCount } from '../box/isPortCount.js';
import type { OpenISDBox } from '../box/openISDBox.js';
import type { OpenISDDriverEmbedded } from '../driver/openISDDriverEmbedded.js';
import type { EnvironmentFields } from './environmentFields.js';
import type { ProjectIssues } from './projectIssues.js';
import { sealedVolumeAsSolverField } from './sealedVolumeAsSolverField.js';

/** WinISD's reference drive: 1 W — the power the signal pair settles on, entered, once a usable
 *  Re appears with nothing else stated (moved with `settleSignal`, PLAN_openisdproject_split.md). */
const DEFAULT_DRIVE_POWER_W = 1;

/** Everything `resolveProject` needs from the project that it does not itself compute — every
 *  collaborator PASSED IN, never constructed here. `driverOver`/`boxOver`/`air`/`envFieldsOver`
 *  are the project's own private window-builders (S2-7d2: shared between a live getter and this
 *  direct-root resolve, so they stay project-owned); `powerDriveOver`/`driveVoltageOver` are its
 *  signal field-builders, the same way — `Engine.solveSignal` needs their full `SolverField`
 *  shape, not just a `value`/`entered` reading. */
export interface ProjectResolveContext {
    readonly directRoot: SimpleField<OpenISDProjectJson>;
    readonly engine: Engine;
    readonly driverOver: (root: SimpleField<OpenISDProjectJson>) => OpenISDDriverEmbedded;
    readonly boxOver: (root: SimpleField<OpenISDProjectJson>) => OpenISDBox;
    readonly air: (root: SimpleField<OpenISDProjectJson>) => Air;
    readonly envFieldsOver: (environment: SimpleField<OpenISDEnvironmentJson>) => EnvironmentFields;
    readonly powerDriveOver: (root: SimpleField<OpenISDProjectJson>) => DualWriteFieldImpl<number>;
    readonly driveVoltageOver: (root: SimpleField<OpenISDProjectJson>) => DefaultingFieldImpl<number>;
}

/**
 * T11/S2-7d: resolve the CURRENT layer's driver — write every quantity `solveDriver` can derive
 * back into THAT layer as a `'C'` entry, and answer the result to cache.
 *
 * Reads and writes go DIRECTLY to `ctx.directRoot`, never through a notifying `#slot`/`#root`:
 * those always promote to `#edited` and notify, which would make simply LOADING a project
 * (`wrap()`) register as "modified", and would make a solve's OWN writes notify a SECOND time for
 * one user action — the exact write-on-read/write-on-solve loop that broke `OpenISDDriverEmbedded`
 * in S2-7c before its own auto-resolve was pulled out of the shared driver constructor (see that
 * class's own note).
 *
 * Moved out of `OpenISDProject#resolve()` verbatim (PLAN_openisdproject_split.md): same control
 * flow, same reads, same writes: only the collaborators that were `this.#x` are now `ctx.x`.
 */
export function resolveProject(ctx: ProjectResolveContext): ProjectIssues {
    const { directRoot, engine, driverOver, boxOver, air: airOf, envFieldsOver, powerDriveOver, driveVoltageOver } = ctx;

    // Before the driver: its own air falls back to these three conditions, so they must state
    // the app's default by the time `driver.resolve()` reads them.
    resolveEnvironmentField(focus(directRoot, 'environment'), envFieldsOver);
    const driver = driverOver(directRoot);
    const driverIssues = driver.resolve();

    // The drive power/voltage pair, against the driver's just-resolved Re. Its dq is read from
    // `#issues.signal` at read time, so no `projectGroupDq` here.
    const Re_ohm = usableRe(directRoot, driverOver);
    settleSignal(focus(directRoot, 'signal'), Re_ohm);
    const signal = engine.signal.solve({
        power_W: powerDriveOver(directRoot),
        Re_ohm: inputOf(() => Re_ohm),
        voltage_V: driveVoltageOver(directRoot),
        Rs_ohm: inputOf(() => directRoot.value.driverEmbedding.Rs_ohm),
    });

    // The project's own air — the driver's OWN c_m_per_s/roo_kg_per_m3 are display-only and feed
    // nothing (BUG_20260924_driver-solve-and-sweep-use-different-air-models.md).
    const air: Air = airOf(directRoot);

    const box = boxOver(directRoot);
    // GEOMETRY IS IN, ACOUSTICS IS OUT (John, 2026-08-26): every port's area ↔ dims relation
    // solves here, unconditionally, for all 7 vents regardless of which box type is active —
    // geometry does not depend on that. Must run BEFORE the acoustic `solveVent` calls below,
    // which read `area_m2` as a plain input.
    const vents: readonly Vent[] = [
        box.vented.vent, box.bandpass4.vents.front,
        box.bandpass6.vents.rear, box.bandpass6.vents.front,
        box.abc.vents.rear, box.abc.vents.front, box.abc.vents.intra,
    ];
    for (const v of vents) {
        resolveVentGeometry(v);
        resolveVentCount(v);
    }
    const boxType = directRoot.value.box.boxType;
    let vent: readonly VentIssue[] = [];
    let pr: readonly PrIssue[] = [];
    let sealed: readonly SealedAlignmentIssue[] = [];
    let ventTuningExtra: DqIssue | null = null;

    if (boxType === 'vented') {
        vent = engine.vent.solve({
            tuning_goal_hz: box.vented.tuning_goal_hz,
            length_m: box.vented.vent.length_m,
            Vb_m3: inputOf(() => box.vented.volume_m3.value),
            area_m2: inputOf(() => box.vented.vent.area_m2.value),
            count: inputOf(() => box.vented.vent.count.value),
            endCorrection_m: inputOf(() => box.vented.vent.endCorrection_m.value),
        }, air);
        // The designed tuning is WinISD's own answer and is not changed — it is marked. Read
        // live off `#issues.ventTuningExtra`, appended to `#issues.vent`'s own mark, never over
        // it: the two say different things (this geometry does not solve / nobody would build
        // this).
        const Fb = box.vented.tuning_goal_hz.value;
        ventTuningExtra = Fb === null ? null : engine.vented.tuningIssue(Fb);
    } else if (boxType === 'bandpass4') {
        vent = engine.vent.solve({
            tuning_goal_hz: box.bandpass4.chambers.front.tuning_goal_hz,
            length_m: box.bandpass4.vents.front.length_m,
            Vb_m3: inputOf(() => box.bandpass4.chambers.front.volume_m3.value),
            area_m2: inputOf(() => box.bandpass4.vents.front.area_m2.value),
            count: inputOf(() => box.bandpass4.vents.front.count.value),
            endCorrection_m: inputOf(() => box.bandpass4.vents.front.endCorrection_m.value),
        }, air);
    } else if (boxType === 'box-passive-radiator') {
        const p = box.passiveRadiator;
        const r = p.radiator;
        pr = engine.pr.solve({
            addedMass_kg: p.addedMass_kg,
            tuning_goal_hz: p.tuning_goal_hz,
            resonanceWithAddedMass_hz: p.resonanceWithAddedMass_hz,
            systemTuning_hz: p.systemTuning_hz,
            Vb_m3: inputOf(() => p.volume_m3.value || box.vented.volume_m3.value),
            prMmd_kg: inputOf(() => r.spec.Mms_kg.value),
            prSd_m2: inputOf(() => r.spec.Sd_m2.value),
            prCms_m_per_N: inputOf(() => r.spec.Cms_m_per_N.value),
            prNum: inputOf(() => p.count.value),
        }, air);
    } else if (boxType === 'sealed') {
        const ts = driver.specs;
        // The Rg-loaded Qts, inlined rather than `sourceLoadedQts(Rs)` (that method reads the
        // NOTIFYING `this.driver.ts` — calling it from inside a resolve would re-enter the
        // write-on-read loop this function's own doc comment warns against). Mirrors
        // `#sealedResonance_hz`'s pre-S10 feed exactly (golden Fsc 63.1762 Hz/Qtc 0.5995).
        const rgLoadedQts = (): number | null => {
            const Qts = ts.Qts.value;
            if (Qts === null) return null;
            return engine.driver.sourceLoadedQts(
                ts.Qms.value ?? NaN, ts.Qes.value ?? NaN, ts.Re_ohm.value ?? NaN,
                directRoot.value.driverEmbedding.Rs_ohm, Qts);
        };
        sealed = engine.sealed.solve({
            Qts: inputOf(rgLoadedQts),
            Vas_m3: inputOf(() => ts.Vas_m3.value),
            Fs_hz: inputOf(() => ts.Fs_hz.value),
            Ql: inputOf(() => box.sealed.losses.Ql.value),
            Qa: inputOf(() => box.sealed.losses.Qa.value),
            lossMode: inputOf(() => directRoot.value.advanced.lossMode ?? null),
            Qtc: box.sealed.q_tc,
            Vb_m3: sealedVolumeAsSolverField(box.sealed.volume_m3),
        });
    }

    return { driver: driverIssues, signal, vent, pr, sealed, ventTuningExtra };
}

/** The driver's Re when it is a positive finite number, else null — read off `driverOver`, the
 *  permanent facade collaborator every caller of `resolveProject` already supplies. Exported: also
 *  used by the facade's own `#signalOver` to build the `usableRe` callback `ProjectSignal` needs
 *  (PLAN_openisdproject_split.md). */
export function usableRe(root: SimpleField<OpenISDProjectJson>, driverOver: ProjectResolveContext['driverOver']): number | null {
    const Re_ohm = driverOver(root).specs.Re_ohm.value;
    return Re_ohm !== null && Number.isFinite(Re_ohm) && Re_ohm > 0 ? Re_ohm : null;
}

/**
 * The signal pair's entered-value rules the solve does not make. Re lost (a power is still
 * stored, which only a known Re allows): the voltage keeps its value as entered and the power
 * goes. Re known with nothing entered: the power is the 1 W reference, entered.
 */
function settleSignal(signal: SimpleField<OpenISDProjectJson['signal']>, Re_ohm: number | null): void {
    const {power_W, voltage_V} = signal.value;
    if (Re_ohm === null) {
        if (power_W !== undefined) {
            signal.set({...signal.value, power_W: undefined, voltage_V: voltage_V && enteredEntry(voltage_V.value)});
        }
        return;
    }
    if (power_W?.state !== 'E' && voltage_V?.state !== 'E') {
        signal.set({...signal.value, power_W: enteredEntry(DEFAULT_DRIVE_POWER_W)});
    }
}

/** Stores the app's Options → Environment value as a 'C' entry for every condition the project
 *  does not state itself: clear, then store what the empty slot reads. Re-stamped on every
 *  resolve, so changing Options reaches an unstated project (`appSettingsChanged`); an entered
 *  condition is never touched. */
function resolveEnvironmentField(
    environment: SimpleField<OpenISDEnvironmentJson>,
    envFieldsOver: ProjectResolveContext['envFieldsOver'],
): void {
    const env = envFieldsOver(environment);
    for (const condition of [env.tempK, env.humidityPct, env.pressurePa]) {
        if (condition.entered) continue;
        condition.clear();
        condition.setCalculated(condition.value);
    }
}

/** Solves `vent.area_m2` against whichever dimension its own `shape` uses: `diameter_m` round,
 *  `height_m` (times the live `width_m`) slotted. PLAIN GEOMETRY — πr² and width × height involve
 *  no air, compliance, resonance or end correction, so this belongs in the domain, not the engine
 *  (John 2026-08-26: "simple geometric calc like pi r squared are ok in the domain").
 *
 *  Entering either side of a pair already atomically clears the other (`pairedField`'s own
 *  `commitPair`), so this only ever has one side entered, or neither. `setNotAvailable()` on the
 *  "neither" branch wipes a stale calculated echo left over from a shape the vent has since
 *  switched away from — a plain `shape.set()` does not itself touch `area_m2`. */
function resolveVentGeometry(vent: Vent): void {
    if (vent.shape.value === 'round') {
        if (vent.diameter_m.entered) {
            vent.area_m2.setCalculated(Math.PI * (vent.diameter_m.value! / 2) ** 2);
        } else if (vent.area_m2.entered) {
            vent.diameter_m.setCalculated(2 * Math.sqrt(vent.area_m2.value! / Math.PI));
        } else {
            vent.area_m2.setNotAvailable();
            vent.diameter_m.setNotAvailable();
        }
        return;
    }
    const width = vent.width_m.value;
    if (vent.height_m.entered) {
        if (width === null) vent.area_m2.setNotAvailable();
        else vent.area_m2.setCalculated(width * vent.height_m.value!);
    } else if (vent.area_m2.entered) {
        if (width === null || width === 0) vent.height_m.setNotAvailable();
        else vent.height_m.setCalculated(vent.area_m2.value! / width);
    } else {
        vent.area_m2.setNotAvailable();
        vent.height_m.setNotAvailable();
    }
}

/** Stores the port count's default (one port) as a 'C' entry wherever the record states no count,
 *  or states one that is not a whole number of at least one — the repair John ruled on
 *  2026-09-20, written into the record rather than applied at read time (John, 2026-09-24: "simply
 *  no reason for these exceptions to the rule"). No solve derives a port count, so this is the
 *  only write that ever makes one calculated. */
function resolveVentCount(vent: Vent): void {
    const v = vent.count.value;
    if (!isPortCount(v)) vent.count.setCalculated(calcVentCount());
    else if (!vent.count.entered) vent.count.setCalculated(v);
}
