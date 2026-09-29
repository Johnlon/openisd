import {LossMode} from '../../fields/lossMode.js';
import {type Engine} from '../../engine/index.js';
import type { Air, BoxType, DqIssue } from '../../engine/index.js';
import { CalculatedFieldImpl, absentCell, calculatedCell, entryField, focus, pairedField, requiredField } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { SealedLosses } from '../losses.js';
import type { OpenISDBoxJson, SpecEntryJson } from '../openisdSchema.js';
import { OpenISDDriverEmbedded } from '../driver/openISDDriverEmbedded.js';
import { OpenISDPassiveRadiatorEmbedded } from '../passiveRadiator/openISDPassiveRadiatorEmbedded.js';
import { OpenISDPassiveRadiatorStandalone } from '../passiveRadiator/openISDPassiveRadiatorStandalone.js';
import { groupDq } from '../project/groupDq.js';
import type { ProjectIssues } from '../project/projectIssues.js';
import type { AbcBox } from './abcBox.js';
import type { Bandpass4Box } from './bandpass4Box.js';
import type { Bandpass6Box } from './bandpass6Box.js';
import type { Box } from './box.js';
import { CoupledSealedLossesWindow } from './coupledSealedLossesWindow.js';
import { CoupledVentedLossesWindow } from './coupledVentedLossesWindow.js';
import type { PassiveRadiatorBox } from './passiveRadiatorBox.js';
import type { SealedBox } from './sealedBox.js';
import { SealedLossesWindow } from './sealedLossesWindow.js';
import { VentWindow } from './ventWindow.js';
import type { VentedBox } from './ventedBox.js';
import { VentedChamberWindow } from './ventedChamberWindow.js';
import { VentedLossesWindow } from './ventedLossesWindow.js';

/**
 * The box, as a window onto its slice of the project record — AND holding a reference to the
 * containing `OpenISDProject` itself.
 *
 * The project reference is what lets a component answer a question that spans siblings. Fc is
 * the case in point: it depends on the box's volume AND on the driver's Fs/Sd/Cms, and the box
 * cannot see the driver on its own. An earlier version had the project inject a
 * `SealedResonanceFn` callback instead — one bespoke hole punched for one calculation, which
 * would need another hole for the next cross-component question (a vent's air mass needs the
 * environment; a PR's tuning needs the box volume it sits in). Holding the project answers all
 * of them at once.
 *
 * A box is ALWAYS part of a project, so the reference is mandatory and never null. That is not
 * true of a driver — one can be standalone (a My Drivers entry, a bundle row, a `detach()`ed
 * copy) — which is why `OpenISDDriver` does NOT take a project. Making it take one would force
 * every standalone driver to invent a project it is not part of.
 *
 * The box reaches the driver through its PUBLIC surface (`project.driver.Fs_hz.value`), never
 * through the record — the privacy rule holds inside the module too.
 */
export class OpenISDBox implements Box {
    readonly boxType: SimpleField<BoxType>;

    readonly sealed: SealedBox;
    readonly vented: VentedBox;
    readonly bandpass4: Bandpass4Box;
    readonly bandpass6: Bandpass6Box;
    readonly abc: AbcBox;
    readonly passiveRadiator: PassiveRadiatorBox;

    /** The driver this box loads, read through its PUBLIC field surface — never its record. A
     *  chamber's resonance depends on the driver, and this is the only thing the box needs it for. */
    readonly #driver: OpenISDDriverEmbedded;
    /** The one calculation surface. Injected, never constructed here. */
    readonly #engine: Engine;
    /** The project's amplifier source impedance, resolved at CALL time — the `Rg` that loads the
     *  driver's Qts the way WinISD's readout does. A PARAMETER rather than a record field for the
     *  same reason `OpenISDProject.sourceLoadedQts` treats `Rs` as one: the record hear has no
     *  home for it (it lives on the project's driverEmbedding, which the box does not own). */
    readonly #rs: () => number;
    /** The project's chosen sealed-box loss model (S10/QO130), resolved at CALL time — same
     *  reason `#rs` is a closure, not a field: `lossMode` lives on `advanced`, which the box
     *  does not own. */
    readonly #lossMode: () => LossMode;

    private constructor(
        lens: SimpleField<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
        lossMode: () => LossMode,
        issues: () => ProjectIssues,
        ventTuningExtra: () => DqIssue | null,
        air: () => Air,
    ) {
        this.#driver = driver;
        this.#engine = engine;
        this.#rs = rs;
        this.#lossMode = lossMode;
        this.boxType = focus(lens, 'boxType');

        // The project's own resolved air, injected — the driver's OWN c_m_per_s/roo_kg_per_m3
        // are display-only and feed nothing (BUG_20260924_driver-solve-and-sweep-use-different-
        // air-models.md). Every vent/PR window below reads this same closure rather than each
        // computing its own reference-condition fallback.

        const sealedLens = focus(lens, 'sealed');
        const sealedVolume = requiredField(sealedLens, 'volume_m3', (v) => engine.issues.positiveValueIssue(v));
        const sealedLosses = new SealedLossesWindow(focus(sealedLens, 'losses'));
        this.sealed = {
            volume_m3: sealedVolume,
            resonance_hz: new CalculatedFieldImpl<number | null>(() => {
                const v = this.#sealedResonance_hz(sealedVolume.value, sealedLosses);
                return v === null
                    ? absentCell<number>('resonance_hz')
                    : calculatedCell<number | null>('resonance_hz', v);
            }),
            q_tc: entryField(focus(sealedLens, 'Qtc'), 'q_tc', () => groupDq(issues().sealed)),
            losses: sealedLosses,
        };

        const ventedLens = focus(lens, 'vented');
        const ventedChamber = focus(ventedLens, 'chamber');
        const ventedVentLens = focus(ventedLens, 'vent');
        const ventedTuningEntry = entryField(focus(ventedChamber, 'tuning_goal_hz'), 'tuning_goal_hz', () => {
            const dq = groupDq(issues().vent);
            const extra = ventTuningExtra();
            return extra === null ? dq : [...dq, extra];
        });
        const ventedLengthEntry = entryField(focus(ventedVentLens, 'length_m'), 'length_m', () => groupDq(issues().vent));
        const commitVentedPair = (tuning: SpecEntryJson | undefined, length: SpecEntryJson | undefined): void => {
            const cur = ventedLens.value;
            ventedLens.set({
                ...cur,
                chamber: { ...cur.chamber, tuning_goal_hz: tuning },
                vent: { ...cur.vent, length_m: length },
            });
        };
        const ventedTuningField = pairedField((entry) => commitVentedPair(entry, undefined), ventedTuningEntry);
        const ventedLengthField = pairedField((entry) => commitVentedPair(undefined, entry), ventedLengthEntry);
        const ventWindow = new VentWindow(ventedVentLens, engine.vent, air, ventedLengthField);
        this.vented = {
            // The plausibility mark is computed at READ time, not stored: a mandatory volume field
            // has no `setDq` for a resolve to write through, and the band it is judged against is an
            // application setting the user can change under an already-open project. Reading it
            // now is what makes a Settings edit land without the record being rewritten.
            volume_m3: requiredField(ventedChamber, 'volume_m3', (v) => {
                // Only the ACTIVE box type has a design to judge. Every other box's record sits
                // at its schema default (a 0 m³ vented chamber under a sealed project), which is
                // not an implausible design — it is no design. The resolve cascade draws the
                // same line, solving the vent only for the box type in play.
                if (lens.value.boxType !== 'vented') return null;
                return engine.vented.volumeIssue(v);
            }),
            tuning_goal_hz: ventedTuningField,
            vent: ventWindow,
            losses: new VentedLossesWindow(focus(ventedChamber, 'losses')),
        };

        const bp4 = focus(lens, 'bandpass4');
        const bp4Rear = focus(bp4, 'rear');
        const bp4RearLosses = new CoupledSealedLossesWindow(focus(bp4Rear, 'losses'));
        const bp4Front = focus(bp4, 'front');
        const bp4FrontTuningEntry = entryField(focus(bp4Front, 'tuning_goal_hz'), 'tuning_goal_hz', () => groupDq(issues().vent));
        const bp4FrontVentLens = focus(bp4, 'frontVent');
        const bp4FrontLengthEntry = entryField(focus(bp4FrontVentLens, 'length_m'), 'length_m', () => groupDq(issues().vent));
        const commitBp4FrontPair = (tuning: SpecEntryJson | undefined, length: SpecEntryJson | undefined): void => {
            const cur = bp4.value;
            bp4.set({
                ...cur,
                front: { ...cur.front, tuning_goal_hz: tuning },
                frontVent: { ...cur.frontVent, length_m: length },
            });
        };
        const bp4FrontTuningField = pairedField((entry) => commitBp4FrontPair(entry, undefined), bp4FrontTuningEntry);
        const bp4FrontLengthField = pairedField((entry) => commitBp4FrontPair(undefined, entry), bp4FrontLengthEntry);
        const bp4FrontVent = new VentWindow(bp4FrontVentLens, engine.vent, air, bp4FrontLengthField);
        this.bandpass4 = {
            chambers: {
                // rear is SEALED — no port, so no `vents.rear`, and a read-only calculated
                // `resonance_hz()` (WinISD's "Frc") stands in for the tuning it cannot be given.
                rear: {
                    volume_m3: requiredField(bp4Rear, 'volume_m3', (v) => engine.issues.positiveValueIssue(v)),
                    // LOSSLESS here, unlike the plain sealed box above, because that is what
                    // WinISD itself writes for a bandpass4 rear chamber. Two goldens written by
                    // the same winisd.exe 89 seconds apart with the identical driver, identical
                    // Vr=0.02 and identical Qlr/Qar, differing only in BType: sealed-small.wpr
                    // carries the LOSSY Fr=61.267…, bandpass4.wpr the LOSSLESS Fr=58.3392371416399
                    // (= Fs·√(1+Vas/Vr), matched to 13 significant figures). The rear chamber's
                    // damping is already carried by Qlr/Qar in the bandpass circuit.
                    resonance_hz: new CalculatedFieldImpl<number | null>(() => {
                        const v = this.#sealedResonance_hz(
                            focus(bp4Rear, 'volume_m3').value, bp4RearLosses, LossMode.Lossless);
                        return v === null
                            ? absentCell<number>('resonance_hz')
                            : calculatedCell<number | null>('resonance_hz', v);
                    }),
                    losses: bp4RearLosses,
                },
                // front's volume is a Field, consistent with the rear chamber.
                front: {
                    volume_m3: requiredField(bp4Front, 'volume_m3', (v) => engine.issues.positiveValueIssue(v)),
                    tuning_goal_hz: bp4FrontTuningField,
                    losses: new CoupledVentedLossesWindow(focus(bp4Front, 'losses')),
                },
            },
            vents: {front: bp4FrontVent},
        };

        const bp6 = focus(lens, 'bandpass6');
        this.bandpass6 = {
            chambers: {
                rear: new VentedChamberWindow(focus(bp6, 'rear'), engine.issues),
                front: new VentedChamberWindow(focus(bp6, 'front'), engine.issues),
            },
            vents: {
                rear: new VentWindow(focus(bp6, 'rearVent'), engine.vent, air),
                front: new VentWindow(focus(bp6, 'frontVent'), engine.vent, air),
            },
        };

        const abc = focus(lens, 'abc');
        this.abc = {
            chambers: {
                rear: new VentedChamberWindow(focus(abc, 'rear'), engine.issues),
                front: new VentedChamberWindow(focus(abc, 'front'), engine.issues),
            },
            // Three ports, flat siblings: rear's and front's own ports to outside air, plus the
            // connecting port between the chambers — owned by neither, which is why it sits here and
            // not inside a chamber.
            vents: {
                rear: new VentWindow(focus(abc, 'rearVent'), engine.vent, air),
                front: new VentWindow(focus(abc, 'frontVent'), engine.vent, air),
                intra: new VentWindow(focus(abc, 'intraVent'), engine.vent, air),
            },
        };

        const pr = focus(lens, 'passiveRadiator');
        const prSlot = focus(pr, 'component');
        const getRadiator = (): OpenISDPassiveRadiatorEmbedded => {
            return new OpenISDPassiveRadiatorEmbedded(prSlot);
        };
        const prVolume = requiredField(pr, 'volume_m3', (v) => engine.issues.positiveValueIssue(v));
        const prAddedMassEntry = entryField(focus(pr, 'addedMass_kg'), 'addedMass_kg', () => groupDq(issues().pr));
        const prTuningEntry = entryField(focus(pr, 'tuning_goal_hz'), 'tuning_goal_hz', () => groupDq(issues().pr));
        const prTuningField = pairedField(
            (entry) => pr.set({ ...pr.value, tuning_goal_hz: entry, addedMass_kg: undefined }),
            prTuningEntry,
        );
        const prAddedMassField = pairedField(
            (entry) => pr.set({ ...pr.value, addedMass_kg: entry, tuning_goal_hz: undefined }),
            prAddedMassEntry,
        );
        this.passiveRadiator = {
            volume_m3: prVolume,
            tuning_goal_hz: prTuningField,
            count: focus(pr, 'count'),
            addedMass_kg: prAddedMassField,
            losses: new SealedLossesWindow(focus(pr, 'losses')),
            // The embedded radiator adopts the chosen one — a radiator reading another radiator's
            // record, legal because both derive from the class that declares `slot`.
            configurePR: (chosen: OpenISDPassiveRadiatorStandalone) => {
                prSlot.set({ ...prSlot.value, ...chosen.clonePassiveRadiator() });
            },
            get radiator() {
                return getRadiator();
            },
            // OUTPUTS of the solved pair (S2-7d2): plain entry-backed slots the `solvePr` cascade
            // in `OpenISDProject#resolve()` writes as 'C' entries — never entered by a user, never
            // recomputed at read time here.
            systemTuning_hz: entryField(focus(pr, 'systemTuning_hz'), 'systemTuning_hz', () => groupDq(issues().pr)),
            resonanceWithAddedMass_hz: entryField(focus(pr, 'resonanceWithAddedMass_hz'), 'resonanceWithAddedMass_hz', () => groupDq(issues().pr)),
            /** A read-only WHAT-IF query, independent of the stored pair and its cascade — never
             *  writes back, so it stays a pure computation over `PrEngine.massForFp` rather than a
             *  route through the (now-deleted) bag solver. The DQ text matches
             *  `checkPrConsistency`'s own negative-mass case exactly: the only DQ this cell could
             *  ever have carried in practice (the missing-dependencies branch always paired with a
             *  null answer, which the not-available branch below already reports with no DQ to lose). */
            addedMassForTuning_kg: (fp_hz: number) => new CalculatedFieldImpl<number | null>(() => {
                const Vb = prVolume.value || this.vented.volume_m3.value;
                const r = getRadiator();
                const prMmd = r.spec.Mms_kg.value;
                const prSd = r.spec.Sd_m2.value;
                const prCms = r.spec.Cms_m_per_N.value;
                const prNum = this.passiveRadiator.count.value || 1;
                if (!(Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null && fp_hz > 0)) {
                    return absentCell<number>('addedMassForTuning_kg');
                }
                const totalMass = this.#engine.pr.massForFp({ Vb, prMmd, prMadd: 0, prSd, prCms, prNum }, fp_hz, air());
                const addedMass = totalMass - prMmd;
                const dq: DqIssue[] | undefined = addedMass < 0 ? [this.#engine.issues.targetUnreachable(
                    'addedMassForTuning_kg',
                    this.#engine.pr.tuning({ Vb, prMmd, prMadd: 0, prSd, prCms, prNum }, air()),
                )] : undefined;
                return calculatedCell<number | null>('addedMassForTuning_kg', addedMass, dq);
            }),
        };
    }

    /** Takes the lens onto the project's `box` slot. The project owns that slot and builds the
     *  lens, so the box needs no reference back to the project. */
    static wrap(
        slot: SimpleField<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
        lossMode: () => LossMode,
        issues: () => ProjectIssues,
        ventTuningExtra: () => DqIssue | null,
        air: () => Air,
    ): OpenISDBox {
        return new OpenISDBox(slot, driver, engine, rs, lossMode, issues, ventTuningExtra, air);
    }

    /**
     * A sealed chamber's resonance, through the INJECTED engine.
     *
     * Null whenever the driver has not stated what the feed needs, or the volume is not
     * positive — absence is `null` here as everywhere, never 0 and never a throw.
     *
     * The domain does none of the physics: it hands over the driver's SOLVED values (Fs, Vas and
     * the Q group), the volume, the chamber's losses and the project's source impedance, and the
     * engine computes the resonance.
     *
     * The FEED is parity-proven, not guessed: the engine test that matches WinISD's own sealed
     * `Box.Fr` readout bit-for-bit (`winisd-parity-functional.test.ts` "Box.Fr") passes exactly
     * the driver's stored Vas and `sourceLoadedQts(Qms, Qes, Re, Rg, Qts)` — never the inline
     * compliance reconstruction `Cms·Sd²·ρc²` and never bare `Qts` (Rg alone moves Fsc by 0.040 Hz
     * on the golden scene; `SEALED_FSC_MODEL.md` §5).
     */
    #sealedResonance_hz(volume_m3: number | null, losses: SealedLosses,
                        mode: LossMode = this.#lossMode()): number | null {
        if (volume_m3 === null || !(volume_m3 > 0)) return null;
        const ts = this.#driver.specs;
        const Fs_hz = ts.Fs_hz.value;
        const Vas = ts.Vas_m3.value;
        const Qts = ts.Qts.value;
        if (Fs_hz === null || Vas === null || Qts === null) return null;
        const QtsLoaded = this.#engine.driver.sourceLoadedQts(
            ts.Qms.value ?? NaN, ts.Qes.value ?? NaN, ts.Re_ohm.value ?? NaN, this.#rs(), Qts);
        // The project's own chosen mode (S10/QO130) by default. WinISD displays and saves the
        // LOSSY figure by default (John 2026-08-27: "default is winisd = Lossy") and it MOVES
        // with the chamber's losses: measured, `Fr` shifts 5.8 Hz for a `Ql` change at fixed
        // volume (winisd_research FINDING-007). A caller (bandpass4's rear chamber) may still
        // override `mode` — that is WinISD's own fixed behaviour for that chamber, not the
        // project's chosen mode; see that call site's own note.
        return this.#engine.sealed.resonance(mode, {
            Fs: Fs_hz, Vas, Qts: QtsLoaded, Vb: volume_m3, Ql: losses.Ql.value, Qa: losses.Qa.value,
        }).Fsc;
    }

}
