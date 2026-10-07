import {type Engine} from '../../engine/index.js';
import type { Air, BoxType, DqIssue, VentedAlignment } from '../../engine/index.js';
import { CalculatedFieldImpl, absentCell, calculatedCell, entryField, focus, nullableField, pairedField, simpleField } from '../cell.js';
import type { Clearable, Entered, Precise, Readable, SimpleField, Writable } from '../cell.js';
import type { CoupledSealedLosses, SealedLosses } from '../losses.js';
import { WINISD_BOX_LOSSES } from '../boxDefaults.js';
import type { OpenISDBoxJson, SpecEntryJson } from '../openisdSchema.js';
import { OpenISDDriverEmbedded } from '../driver/openISDDriverEmbedded.js';
import { OpenISDPassiveRadiatorEmbedded } from '../passiveRadiator/openISDPassiveRadiatorEmbedded.js';
import { OpenISDPassiveRadiatorStandalone } from '../passiveRadiator/openISDPassiveRadiatorStandalone.js';
import { groupDq } from '../project/groupDq.js';
import type { ProjectIssues } from '../project/projectIssues.js';
import type { AbcBox } from './abcBox.js';
import type { Bandpass4Box } from './bandpass4Box.js';
import type { Bandpass6Box } from './bandpass6Box.js';
import type { Box, BoxLossGroup, TuningField, VentGroup } from './box.js';
import type { Vent } from '../vent.js';
import { CoupledSealedLossesWindow } from './coupledSealedLossesWindow.js';
import { CoupledVentedLossesWindow } from './coupledVentedLossesWindow.js';
import type { PassiveRadiatorBox } from './passiveRadiatorBox.js';
import type { SealedBox } from './sealedBox.js';
import { SealedLossesWindow } from './sealedLossesWindow.js';
import { VentWindow } from './ventWindow.js';
import type { VentedBox } from './ventedBox.js';
import { VentedChamberWindow } from './ventedChamberWindow.js';
import { VentedLossesWindow } from './ventedLossesWindow.js';

/** Starting values a box type gets the first time it is used with nothing entered — what the New
 *  Project wizard writes for a fresh project of that type (`applyStartingValues`). */
const STARTING = Object.freeze({
    /** Sealed: the volume for the flat (Butterworth) alignment. */
    sealedQtc: 0.707,
    /** Vented: the quasi-Butterworth design. */
    ventedAlignment: 'qb3',
    ventDiameter_m: 0.05,
    /** A slotted vent: width the driver's diaphragm diameter when known, else this; height flat. */
    ventSlotWidth_m: 0.1,
    ventSlotHeight_m: 0.03,
    /** Passive radiator and bandpass4 rear chamber. */
    volume_m3: 0.007,
    bandpass4FrontVolume_m3: 0.01,
    tuning_hz: 35,
    /** A chart-ready radiator (BUG_20260912: Fh must resolve instead of "--"), named so it reads
     *  as a stand-in, never a spec sheet (John 2026-09-29): Sd the driver's own when known, Xmax
     *  twice the driver's — a radiator has no motor, so it needs more excursion than the driver. */
    radiatorBrand: 'Placeholder',
    radiatorModel: 'ReplaceMe',
    radiatorSd_m2: 0.02,
    radiatorXmaxMultiple: 2,
    radiatorCms_m_per_N: 0.0005,
    radiatorMms_kg: 0.05,
} as const);

/** Fill the geometry pair a vent's `shape` uses, where unset. */
function startVentGeometry(vent: Vent, driverDd_m: number | null): void {
    if (vent.shape.value === 'slotted') {
        if ((vent.width_m.value ?? 0) <= 0) vent.width_m.set(driverDd_m !== null && driverDd_m > 0 ? driverDd_m : STARTING.ventSlotWidth_m);
        if ((vent.height_m.value ?? 0) <= 0) vent.height_m.set(STARTING.ventSlotHeight_m);
    } else if ((vent.diameter_m.value ?? 0) <= 0) {
        vent.diameter_m.set(STARTING.ventDiameter_m);
    }
}

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
/** A volume a box can be built with: entered and above 0. Blank, or the 0 an unused box type's
 *  record holds, is not — `applyStartingValues` fills those. */
function isStated(volume_m3: number | null): volume_m3 is number {
    return volume_m3 !== null && volume_m3 > 0;
}

/** The Box losses popup of a two-chamber box: one set per chamber, as WinISD gives each chamber
 *  panel its own Advanced-> losses. Both sets carry the rear chamber's Qicl, the one the sweep
 *  reads as WinISD's Qiclfr. */
function chamberLossGroups(
    rear: CoupledSealedLosses, rearQp: SimpleField<number> | null,
    front: CoupledSealedLosses, frontQp: SimpleField<number>,
): readonly BoxLossGroup[] {
    return [
        {heading: 'Rear chamber', Ql: rear.Ql, Qa: rear.Qa, Qp: rearQp, Qicl: rear.Qicl},
        {heading: 'Front chamber', Ql: front.Ql, Qa: front.Qa, Qp: frontQp, Qicl: rear.Qicl},
    ];
}

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

    private constructor(
        lens: SimpleField<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
        issues: () => ProjectIssues,
        ventTuningExtra: () => DqIssue | null,
        air: () => Air,
    ) {
        this.#driver = driver;
        this.#engine = engine;
        this.#rs = rs;
        const boxType = focus(lens, 'boxType');
        this.boxType = simpleField(() => boxType.value, (type) => {
            boxType.set(type);
            this.applyStartingValues();
        });

        // The project's own resolved air, injected — the driver's OWN c_m_per_s/roo_kg_per_m3
        // are display-only and feed nothing (BUG_20260924_driver-solve-and-sweep-use-different-
        // air-models.md). Every vent/PR window below reads this same closure rather than each
        // computing its own reference-condition fallback.

        const sealedLens = focus(lens, 'sealed');
        const sealedVolume = nullableField(sealedLens, 'volume_m3', (v) => engine.issues.requiredPositiveIssue('Box volume', v, 'alignment'));
        const sealedLosses = new SealedLossesWindow(focus(sealedLens, 'losses'));
        this.sealed = {
            volume_m3: sealedVolume,
            resonance_hz: new CalculatedFieldImpl<number | null>(() => {
                const v = this.#sealedResonance(sealedVolume.value, sealedLosses, 'lossy')?.Fsc ?? null;
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
            volume_m3: nullableField(ventedChamber, 'volume_m3', (v) => {
                // Only the ACTIVE box type has a design to judge. Every other box's record sits
                // at its schema default (a 0 m³ vented chamber under a sealed project), which is
                // not an implausible design — it is no design. The resolve cascade draws the
                // same line, solving the vent only for the box type in play.
                if (lens.value.boxType !== 'vented') return null;
                if (v === null) return engine.issues.requiredPositiveIssue('Box volume', v, 'alignment');
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
                    volume_m3: nullableField(bp4Rear, 'volume_m3', (v) => engine.issues.requiredPositiveIssue('Rear chamber volume', v)),
                    // LOSSLESS here, unlike the plain sealed box above, because that is what
                    // WinISD itself writes for a bandpass4 rear chamber. Two goldens written by
                    // the same winisd.exe 89 seconds apart with the identical driver, identical
                    // Vr=0.02 and identical Qlr/Qar, differing only in BType: sealed-small.wpr
                    // carries the LOSSY Fr=61.267…, bandpass4.wpr the LOSSLESS Fr=58.3392371416399
                    // (= Fs·√(1+Vas/Vr), matched to 13 significant figures). The rear chamber's
                    // damping is already carried by Qlr/Qar in the bandpass circuit.
                    resonance_hz: new CalculatedFieldImpl<number | null>(() => {
                        const v = this.#sealedResonance(
                            focus(bp4Rear, 'volume_m3').value, bp4RearLosses, 'lossless')?.Fsc ?? null;
                        return v === null
                            ? absentCell<number>('resonance_hz')
                            : calculatedCell<number | null>('resonance_hz', v);
                    }),
                    // Same lossless chamber model as Frc above, so Qtc = Qts·√(1+Vas/Vr).
                    q_tc: new CalculatedFieldImpl<number | null>(() => {
                        const v = this.#sealedResonance(
                            focus(bp4Rear, 'volume_m3').value, bp4RearLosses, 'lossless')?.Qtc ?? null;
                        return v === null
                            ? absentCell<number>('q_tc')
                            : calculatedCell<number | null>('q_tc', v);
                    }),
                    losses: bp4RearLosses,
                },
                // front's volume is a Field, consistent with the rear chamber.
                front: {
                    volume_m3: nullableField(bp4Front, 'volume_m3', (v) => engine.issues.requiredPositiveIssue('Front chamber volume', v)),
                    tuning_goal_hz: bp4FrontTuningField,
                    losses: new CoupledVentedLossesWindow(focus(bp4Front, 'losses')),
                },
            },
            vents: {front: bp4FrontVent},
        };

        const bp6 = focus(lens, 'bandpass6');
        this.bandpass6 = {
            chambers: {
                rear: new VentedChamberWindow(focus(bp6, 'rear'), 'Rear chamber volume', engine.issues),
                front: new VentedChamberWindow(focus(bp6, 'front'), 'Front chamber volume', engine.issues),
            },
            vents: {
                rear: new VentWindow(focus(bp6, 'rearVent'), engine.vent, air),
                front: new VentWindow(focus(bp6, 'frontVent'), engine.vent, air),
            },
        };

        const abc = focus(lens, 'abc');
        this.abc = {
            chambers: {
                rear: new VentedChamberWindow(focus(abc, 'rear'), 'Rear chamber volume', engine.issues),
                front: new VentedChamberWindow(focus(abc, 'front'), 'Front chamber volume', engine.issues),
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
            return new OpenISDPassiveRadiatorEmbedded(prSlot, () => issues().radiator);
        };
        const prVolume = nullableField(pr, 'volume_m3', (v) => engine.issues.requiredPositiveIssue('Box volume', v));
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
                getRadiator().spec.deriveFromWinisdFigures(this.#engine.pr, air());
            },
            get radiator() {
                return getRadiator();
            },
            // OUTPUTS of the solved pair (S2-7d2): plain entry-backed slots the `solvePr` cascade
            // in `OpenISDProject#resolve()` writes as 'C' entries — never entered by a user, never
            // recomputed at read time here.
            systemTuning_hz: entryField(focus(pr, 'systemTuning_hz'), 'systemTuning_hz', () => groupDq(issues().pr)),
            resonanceWithAddedMass_hz: entryField(focus(pr, 'resonanceWithAddedMass_hz'), 'resonanceWithAddedMass_hz', () => groupDq(issues().pr)),
            naturalTuning_hz: new CalculatedFieldImpl<number | null>(() => {
                const Vb = prVolume.value;
                const r = getRadiator();
                const mech = {Mms_kg: r.spec.Mms_kg.value, Cms_m_per_N: r.spec.Cms_m_per_N.value};
                const prSd = r.spec.Sd_m2.value;
                const prNum = this.passiveRadiator.count.value || 1;
                if (!(Vb != null && Vb > 0 && mech.Mms_kg !== null && mech.Mms_kg > 0 && prSd !== null && prSd > 0
                    && mech.Cms_m_per_N !== null && mech.Cms_m_per_N > 0 && prNum > 0)) {
                    return absentCell<number>('naturalTuning_hz');
                }
                return calculatedCell<number | null>('naturalTuning_hz',
                    this.#engine.pr.tuning({ Vb, prMmd: mech.Mms_kg, prMadd: 0, prSd, prCms: mech.Cms_m_per_N, prNum }, air()));
            }),
            /** A read-only WHAT-IF query, independent of the stored pair and its cascade — never
             *  writes back, so it stays a pure computation over `PrEngine.massForFp` rather than a
             *  route through the (now-deleted) bag solver. The DQ text matches
             *  `checkPrConsistency`'s own negative-mass case exactly: the only DQ this cell could
             *  ever have carried in practice (the missing-dependencies branch always paired with a
             *  null answer, which the not-available branch below already reports with no DQ to lose). */
            addedMassForTuning_kg: (fp_hz: number) => new CalculatedFieldImpl<number | null>(() => {
                const Vb = prVolume.value;
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

        frontVolumeOf(type: BoxType): (Readable<number | null> & Entered & Precise & Writable<number> & Clearable) | null {
        switch (type) {
            case 'bandpass4': return this.bandpass4.chambers.front.volume_m3;
            case 'bandpass6': return this.bandpass6.chambers.front.volume_m3;
            case 'abc': return this.abc.chambers.front.volume_m3;
            case 'sealed':
            case 'vented':
            case 'box-passive-radiator':
                return null;
        }
    }

    rearTuningOf(type: BoxType): TuningField | null {
        switch (type) {
            case 'bandpass6': return this.bandpass6.chambers.rear.tuning_goal_hz;
            case 'abc': return this.abc.chambers.rear.tuning_goal_hz;
            case 'sealed':
            case 'vented':
            case 'bandpass4':
            case 'box-passive-radiator':
                return null;
        }
    }

    ventGroupOf(type: BoxType): VentGroup {
        if (type === 'bandpass4') {
            const front = this.bandpass4.chambers.front;
            return { volume_m3: front.volume_m3, tuning_goal_hz: front.tuning_goal_hz, vent: this.bandpass4.vents.front };
        }
        return this.vented;
    }

    lossGroupsOf(type: BoxType): readonly BoxLossGroup[] {
        switch (type) {
            case 'sealed': return [{heading: null, Ql: this.sealed.losses.Ql, Qa: this.sealed.losses.Qa, Qp: null, Qicl: null}];
            case 'vented': return [{heading: null, Ql: this.vented.losses.Ql, Qa: this.vented.losses.Qa, Qp: this.vented.losses.Qp, Qicl: null}];
            case 'bandpass4': {
                const {rear, front} = this.bandpass4.chambers;
                return chamberLossGroups(rear.losses, null, front.losses, front.losses.Qp);
            }
            case 'box-passive-radiator': return [{heading: null, Ql: this.passiveRadiator.losses.Ql, Qa: this.passiveRadiator.losses.Qa, Qp: null, Qicl: null}];
            case 'bandpass6': {
                const {rear, front} = this.bandpass6.chambers;
                return chamberLossGroups(rear.losses, rear.losses.Qp, front.losses, front.losses.Qp);
            }
            case 'abc': {
                const {rear, front} = this.abc.chambers;
                return chamberLossGroups(rear.losses, rear.losses.Qp, front.losses, front.losses.Qp);
            }
        }
    }

    resetLossesOf(type: BoxType): void {
        for (const losses of this.lossGroupsOf(type)) {
            losses.Ql.set(WINISD_BOX_LOSSES.Ql);
            losses.Qa.set(WINISD_BOX_LOSSES.Qa);
            losses.Qp?.set(WINISD_BOX_LOSSES.Qp);
            losses.Qicl?.set(WINISD_BOX_LOSSES.Qicl);
        }
    }

    /** Give the active box type its starting values where nothing is entered yet: sealed gets the
     *  flat-alignment volume, vented the QB3 design for the driver as driven plus vent geometry for
     *  its shape (50 mm round; a slot the driver's diameter wide and 3 cm high), a passive-radiator
     *  box 7 L with no mass added to a placeholder radiator sized off the driver, bandpass4 a 7 L rear and
     *  a 10 L front at 35 Hz through the same vent geometry. Bandpass6 and ABC have none.
     *  Called by `boxType.set()` and by every `ProjectBuilder` at build; every write is gated on
     *  its own field being unset, so nothing entered is ever overwritten. A driver without the
     *  specs a design needs leaves that value alone. */
    applyStartingValues(): void {
        switch (this.boxType.value) {
            case 'sealed': {
                if (isStated(this.sealed.volume_m3.value)) return;
                const Vb = this.#driver.sealedVolumeForQtc(STARTING.sealedQtc);
                if (Vb !== null && Vb > 0) this.sealed.volume_m3.set(Vb);
                return;
            }
            case 'vented': {
                if (!isStated(this.vented.volume_m3.value)) {
                    const design = this.#driver.ventedDesign(STARTING.ventedAlignment, this.#rs(), this.vented.losses.Ql.value);
                    if (design) {
                        this.vented.volume_m3.set(design.Vb);
                        this.vented.tuning_goal_hz.set(design.Fb);
                    }
                }
                startVentGeometry(this.vented.vent, this.#driver.specs.Dd_m.value);
                return;
            }
            case 'box-passive-radiator': {
                const pr = this.passiveRadiator;
                if (!isStated(pr.volume_m3.value)) pr.volume_m3.set(STARTING.volume_m3);
                // No mass added to the radiator cone (John, 2026-10-01); the tuning is calculated from it.
                if (!pr.addedMass_kg.entered && !pr.tuning_goal_hz.entered) pr.addedMass_kg.set(0);
                if (pr.radiator.brand.value === '') pr.radiator.brand.set(STARTING.radiatorBrand);
                if (pr.radiator.model.value === '') pr.radiator.model.set(STARTING.radiatorModel);
                const spec = pr.radiator.spec;
                const driver = this.#driver.specs;
                const driverSd = driver.Sd_m2.value, driverXmax = driver.Xmax_m.value;
                if (spec.Sd_m2.value === null) spec.Sd_m2.set(driverSd !== null && driverSd > 0 ? driverSd : STARTING.radiatorSd_m2);
                if (spec.Xmax_m.value === null && driverXmax !== null && driverXmax > 0) spec.Xmax_m.set(driverXmax * STARTING.radiatorXmaxMultiple);
                // The starting radiator as the figures WinISD asks for: its mass and compliance
                // stated through Fs and Vas, Qms left blank. Mms, Cms and Rms follow by the solve.
                const startSd = spec.Sd_m2.value;
                if (spec.Fs_hz.value === null && startSd !== null) {
                    spec.Fs_hz.set(this.#engine.pr.fsWithMass(STARTING.radiatorMms_kg, 0, STARTING.radiatorCms_m_per_N));
                }
                if (spec.Vas_m3.value === null && startSd !== null) {
                    spec.Vas_m3.set(this.#engine.pr.vas(STARTING.radiatorCms_m_per_N, startSd));
                }
                return;
            }
            case 'bandpass4': {
                const {chambers, vents} = this.bandpass4;
                if (!isStated(chambers.rear.volume_m3.value)) chambers.rear.volume_m3.set(STARTING.volume_m3);
                if (!isStated(chambers.front.volume_m3.value)) chambers.front.volume_m3.set(STARTING.bandpass4FrontVolume_m3);
                if (chambers.front.tuning_goal_hz.value === null) chambers.front.tuning_goal_hz.set(STARTING.tuning_hz);
                startVentGeometry(vents.front, this.#driver.specs.Dd_m.value);
                return;
            }
            case 'bandpass6':
            case 'abc':
                return;
        }
    }

    /** See `Box.resetVentedAlignment` (box.ts) for why this exists separately from
     *  `applyStartingValues`: it must overwrite, not merely fill a gap. */
    resetVentedAlignment(alignment: VentedAlignment = STARTING.ventedAlignment): void {
        const design = this.#driver.ventedDesign(alignment, this.#rs(), this.vented.losses.Ql.value);
        if (design) {
            this.vented.volume_m3.set(design.Vb);
            this.vented.tuning_goal_hz.set(design.Fb);
        }
    }

    volumeOf(type: BoxType): Readable<number | null> & Entered & Precise & Writable<number> & Clearable {
        switch (type) {
            case 'sealed': return this.sealed.volume_m3;
            case 'vented': return this.vented.volume_m3;
            case 'bandpass4': return this.bandpass4.chambers.rear.volume_m3;
            case 'bandpass6': return this.bandpass6.chambers.rear.volume_m3;
            case 'abc': return this.abc.chambers.rear.volume_m3;
            case 'box-passive-radiator': return this.passiveRadiator.volume_m3;
        }
    }

/** Takes the lens onto the project's `box` slot. The project owns that slot and builds the
     *  lens, so the box needs no reference back to the project. */
    static wrap(
        slot: SimpleField<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        rs: () => number,
        issues: () => ProjectIssues,
        ventTuningExtra: () => DqIssue | null,
        air: () => Air,
    ): OpenISDBox {
        return new OpenISDBox(slot, driver, engine, rs, issues, ventTuningExtra, air);
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
     * `Box.Fr` readout bit-for-bit (`winisd-parity-goldens.test.ts` "Box.Fr") passes exactly
     * the driver's stored Vas and `sourceLoadedQts(Qms, Qes, Re, Rg, Qts)` — never the inline
     * compliance reconstruction `Cms·Sd²·ρc²` and never bare `Qts` (Rg alone moves Fsc by 0.040 Hz
     * on the golden scene; `SEALED_FSC_MODEL.md` §5).
     */
    #sealedResonance(volume_m3: number | null, losses: SealedLosses,
                     form: 'lossy' | 'lossless'): { Fsc: number; Qtc: number } | null {
        if (volume_m3 === null || !(volume_m3 > 0)) return null;
        const ts = this.#driver.specs;
        const Fs_hz = ts.Fs_hz.value;
        const Vas = ts.Vas_m3.value;
        const QtsLoaded = this.#driver.sourceLoadedQts(this.#rs());
        if (Fs_hz === null || Vas === null || QtsLoaded === null) return null;
        // WinISD displays and saves the LOSSY figure by default (John 2026-08-27: "default is
        // winisd = Lossy") and it MOVES with the chamber's losses: measured, `Fr` shifts 5.8 Hz
        // for a `Ql` change at fixed volume (winisd_research FINDING-007). Ql and Qa at or above
        // the lossless limit give the lossless figure. The bandpass4 rear chamber asks for
        // 'lossless' outright: that is WinISD's own fixed behaviour for that chamber.
        const feed = {
            Fs: Fs_hz, Vas, Qts: QtsLoaded, Vb: volume_m3, Ql: losses.Ql.value, Qa: losses.Qa.value,
        };
        return form === 'lossless' ? this.#engine.sealed.losslessResonance(feed) : this.#engine.sealed.resonance(feed);
    }

}
