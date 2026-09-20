# Plan: Unified PR and Vent Engine Solver Integration

## Objective
Unify Driver, Passive Radiator (PR), and Vent parameter solving across `@openisd/design` and `@openisd/ui` by establishing exact 1:1 canonical solver functions (`solveDriverConsistencyGroup`, `solvePrConsistencyGroup`, `solveVentConsistencyGroup`), consistency checkers (`checkDriverConsistency`, `checkPrConsistency`, `checkVentConsistency`), and exact quantity interfaces (`DriverSolverQuantities`, `PrSolverQuantities`, `VentSolverQuantities`), with zero backwards-compatibility aliases.

---

## Canonical Naming & Structure Matrix

| Component Group | Domain Path | Canonical Engine Class Method (`Engine.ts`) | Engine Solver Function (`engine/solver.ts`) | Engine Consistency Validator (`engine/`) | Quantity Interface (`engine/`) |
| --- | --- | --- | --- | --- | --- |
| **Driver T/S** | `p.driver` | `solveDriverConsistencyGroup()` | `solveDriverConsistencyGroup(p: DriverSolverQuantities)` | `checkDriverConsistency(p: DriverSolverQuantities)` | `DriverSolverQuantities` |
| **Passive Radiator** | `p.box.passiveRadiator` | `solvePrConsistencyGroup()` | `solvePrConsistencyGroup(p: PrSolverQuantities)` | `checkPrConsistency(p: PrSolverQuantities)` | `PrSolverQuantities` |
| **Vent** | `p.box.vented` / `bandpass4` / `bandpass6` / `abc` | `solveVentConsistencyGroup()` | `solveVentConsistencyGroup(p: VentSolverQuantities)` | `checkVentConsistency(p: VentSolverQuantities)` | `VentSolverQuantities` |

---

## Enclosure Topology Matrix (`Box` / `OpenISDBox`)

| Topology | Interface | Port/PR Solvers Applied | Primary Solved Quantity Pairs |
| --- | --- | --- | --- |
| **Sealed** | `SealedBox` | None (Direct engine calculation `resonance_hz()`) | `resonance_hz()` derived from volume $V_b$ and driver T/S. |
| **Vented** | `VentedBox` | `solveVentConsistencyGroup()` | `tuning_hz` $\leftrightarrow$ `vent.length_m` |
| **Passive Radiator** | `PassiveRadiatorBox` | `solvePrConsistencyGroup()` | `tuning_hz` $\leftrightarrow$ `addedMass_kg` |
| **Bandpass 4th Order** | `Bandpass4Box` | `solveVentConsistencyGroup()` (Front chamber/port) | `chambers.front.tuning_hz` $\leftrightarrow$ `vents.front.length_m` |
| **Bandpass 6th Order** | `Bandpass6Box` | `solveVentConsistencyGroup()` (Rear & Front ports) | `chambers.rear.tuning_hz` $\leftrightarrow$ `vents.rear.length_m`, `chambers.front.tuning_hz` $\leftrightarrow$ `vents.front.length_m` |
| **Aperiodic Bi-Chamber (ABC)** | `AbcBox` | `solveVentConsistencyGroup()` (Rear, Front & Intra ports) | Per-chamber tuning $\leftrightarrow$ per-port length |

---

## Detailed Before and After for All Box & Vent Component Classes

### 1. `OpenISDBox` Class

#### Before
```ts
// EXISTING: openisdDomain.ts (OpenISDBox constructor, L515-L745)
class OpenISDBox implements Box {
    readonly boxType: RawField<BoxType>;
    readonly sealed: SealedBox;
    readonly vented: VentedBox;
    readonly bandpass4: Bandpass4Box;
    readonly bandpass6: Bandpass6Box;
    readonly abc: AbcBox;
    readonly passiveRadiator: PassiveRadiatorBox;

    constructor(
        lens: Lens<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        environment: () => OpenISDEnvironmentJson,
    ) {
        // Vented Tuning with Inline Branching
        const ventedTuning = new Field<number>(
            () => {
                const rawFb = rawVentedTuningLens.get();
                const rawL = rawVentLengthLens.get();
                if (rawFb !== null) {
                    const Vb = this.vented.volume_m3.get().value;
                    const l = ventWindow.lengthForTuning_m(Vb, rawFb);
                    const dq = (rawFb <= 0) ? 'Tuning frequency must be greater than zero'
                             : (l !== null && l < 0) ? 'Target tuning is unreachable for vent geometry'
                             : null;
                    return createCell<number>(rawFb, 'entered', dq);
                }
                if (rawL !== null) {
                    const Vb = this.vented.volume_m3.get().value;
                    const fb = ventWindow.tuningIn_hz(Vb);
                    return createCell<number>(fb, fb === null ? 'not-available' : 'calculated');
                }
                return createCell<number>(null, 'not-available');
            },
            (v) => { /* lens set */ },
            () => rawVentedTuningLens.set(null),
        );

        // PR Added Mass & Tuning with Inline Branching
        const prAddedMass = new Field<number>(
            () => {
                const rawMass = rawPrAddedMassLens.get();
                const rawTuning = rawPrTuningLens.get();
                if (rawMass !== null) {
                    const dq = rawMass < 0 ? 'Target tuning is above maximum passive radiator tuning' : null;
                    return createCell<number>(rawMass, 'entered', dq);
                }
                if (rawTuning !== null) {
                    const m = this.passiveRadiator?.addedMassForTuning_kg(rawTuning) ?? null;
                    const dq = (rawTuning <= 0) ? 'Tuning frequency must be greater than zero'
                             : (m !== null && m < 0) ? 'Target tuning is above maximum passive radiator tuning'
                             : null;
                    return createCell<number>(m, m === null ? 'not-available' : 'calculated', dq);
                }
                return createCell<number>(null, 'not-available');
            },
            // ...
        );
    }
}
```

#### After
```ts
// PROPOSED: openisdDomain.ts
class OpenISDBox implements Box {
    readonly boxType: RawField<BoxType>;
    readonly sealed: SealedBox;
    readonly vented: VentedBox;
    readonly bandpass4: Bandpass4Box;
    readonly bandpass6: Bandpass6Box;
    readonly abc: AbcBox;
    readonly passiveRadiator: PassiveRadiatorBox;

    constructor(
        lens: Lens<OpenISDBoxJson>,
        driver: OpenISDDriverEmbedded,
        engine: Engine,
        environment: () => OpenISDEnvironmentJson,
        projectSolvers?: {
            solvePr: () => { addedMass_kg: Cell<number>; tuning_hz: Cell<number> };
            solveVent: () => { tuning_hz: Cell<number>; length_m: Cell<number> };
        },
    ) {
        this.boxType = focus(lens, 'boxType');
        this.sealed = new SealedBoxWindow(focus(lens, 'sealed'), driver, engine);
        this.vented = new VentedBoxWindow(focus(lens, 'vented'), engine, projectSolvers?.solveVent);
        this.passiveRadiator = new PassiveRadiatorBoxWindow(focus(lens, 'passiveRadiator'), engine, projectSolvers?.solvePr);
        this.bandpass4 = new Bandpass4BoxWindow(focus(lens, 'bandpass4'), engine, projectSolvers?.solveVent);
        this.bandpass6 = new Bandpass6BoxWindow(focus(lens, 'bandpass6'), engine, projectSolvers?.solveVent);
        this.abc = new AbcBoxWindow(focus(lens, 'abc'), engine, projectSolvers?.solveVent);
    }
}
```

---

### 2. `VentWindow` Class

#### Before
```ts
// EXISTING: openisdDomain.ts (L343-L389)
class VentWindow implements Vent {
    constructor(
        lens: Lens<VentJson>,
        engine: Engine,
        ventContext?: { getVb: () => number | null; getTuningHz: () => number | null; clearTuningHz?: () => void }
    ) {
        const rawLengthLens = focus(lens, 'length_m');
        this.length_m = new Field<number>(
            () => {
                const rawL = rawLengthLens.get();
                if (rawL !== null) {
                    const dq = rawL < 0 ? 'Target tuning is unreachable for vent geometry' : null;
                    return createCell<number>(rawL, 'entered', dq);
                }
                if (ventContext) {
                    const Vb = ventContext.getVb();
                    const fb = ventContext.getTuningHz();
                    if (Vb !== null && Vb > 0 && fb !== null) {
                        const l = this.lengthForTuning_m(Vb, fb);
                        const dq = (fb <= 0) ? 'Tuning frequency must be greater than zero'
                                 : (l !== null && l < 0) ? 'Target tuning is unreachable for vent geometry'
                                 : null;
                        return createCell<number>(l, l === null ? 'not-available' : 'calculated', dq);
                    }
                }
                return createCell<number>(null, 'not-available');
            },
            (v) => {
                rawLengthLens.set(v);
                if (ventContext?.clearTuningHz) ventContext.clearTuningHz();
            },
            () => rawLengthLens.set(null),
        );
    }
}
```

#### After
```ts
// PROPOSED: openisdDomain.ts
class VentWindow implements Vent {
    readonly shape: RawField<VentShape>;
    readonly endCorrection_m: RawField<number>;
    readonly diameter_m: FieldHandle<number>;
    readonly width_m: FieldHandle<number>;
    readonly height_m: FieldHandle<number>;
    readonly length_m: FieldHandle<number>;

    constructor(
        lens: Lens<VentJson>,
        engine: Engine,
        getSolvedLengthCell?: () => Cell<number>,
        onSetLength?: (v: number | null) => void,
    ) {
        const rawLengthLens = focus(lens, 'length_m');
        this.length_m = new Field<number>(
            () => getSolvedLengthCell ? getSolvedLengthCell() : createCell(rawLengthLens.get(), rawLengthLens.get() !== null ? 'entered' : 'not-available'),
            (v) => {
                if (onSetLength) onSetLength(v);
                else rawLengthLens.set(v);
            },
            () => rawLengthLens.set(null),
        );
    }
}
```

---

### 3. `SealedBox` Component

#### Before
```ts
// EXISTING: openisdDomain.ts (L140-L148 & L545-L552)
export interface SealedBox {
    readonly volume_m3: RawField<number>;
    resonance_hz(): number | null;
    readonly losses: SealedLosses;
}

// OpenISDBox constructor wiring:
const sealedLens = focus(lens, 'sealed');
const sealedVolume = focus(sealedLens, 'volume_m3');
const sealedLosses = new SealedLossesWindow(focus(sealedLens, 'losses'));
this.sealed = {
    volume_m3: sealedVolume,
    resonance_hz: () => this.#sealedResonance_hz(sealedVolume.get(), sealedLosses),
    losses: sealedLosses,
};
```

#### After
```ts
// PROPOSED: openisdDomain.ts (Retained pure calculation method, no port/PR solver)
export interface SealedBox {
    readonly volume_m3: RawField<number>;
    resonance_hz(): number | null;
    readonly losses: SealedLosses;
}

class SealedBoxWindow implements SealedBox {
    readonly volume_m3: RawField<number>;
    readonly losses: SealedLosses;
    #driver: OpenISDDriverEmbedded;
    #engine: Engine;

    constructor(lens: Lens<SealedBoxJson>, driver: OpenISDDriverEmbedded, engine: Engine) {
        this.volume_m3 = focus(lens, 'volume_m3');
        this.losses = new SealedLossesWindow(focus(lens, 'losses'));
        this.#driver = driver;
        this.#engine = engine;
    }

    resonance_hz(): number | null {
        return this.#engine.sealedResonance('lossy', { Vb: this.volume_m3.get(), driver: this.#driver.solveDriverConsistencyGroup() }).Fsc;
    }
}
```

---

### 4. `VentedBox` Component

#### Before
```ts
// EXISTING: openisdDomain.ts (L150-L156 & L554-L597)
export interface VentedBox {
    readonly volume_m3: FieldHandle<number>;
    readonly tuning_hz: FieldHandle<number>;
    readonly vent: Vent;
    readonly losses: VentedLosses;
}

// OpenISDBox constructor inline wiring:
const ventedTuning = new Field<number>(
    () => {
        /* inline fallback checking rawFb vs rawL and lengthForTuning_m */
    },
    (v) => { /* lens set */ },
    () => rawVentedTuningLens.set(null),
);
```

#### After
```ts
// PROPOSED: openisdDomain.ts
export interface VentedBox {
    readonly volume_m3: FieldHandle<number>;
    readonly tuning_hz: FieldHandle<number>;
    readonly vent: Vent;
    readonly losses: VentedLosses;
}

class VentedBoxWindow implements VentedBox {
    readonly volume_m3: FieldHandle<number>;
    readonly tuning_hz: FieldHandle<number>;
    readonly vent: Vent;
    readonly losses: VentedLosses;

    constructor(
        lens: Lens<VentedBoxJson>,
        engine: Engine,
        getSolvedVentGroup?: () => { tuning_hz: Cell<number>; length_m: Cell<number> }
    ) {
        const chamberLens = focus(lens, 'chamber');
        const rawTuningLens = focus(chamberLens, 'tuning_hz');
        this.volume_m3 = requiredField(chamberLens, 'volume_m3', 'vented.volume_m3');
        this.tuning_hz = new Field<number>(
            () => getSolvedVentGroup ? getSolvedVentGroup().tuning_hz : createCell(rawTuningLens.get(), rawTuningLens.get() !== null ? 'entered' : 'not-available'),
            (v) => focus(lens, 'vented').set({ chamber: { ...focus(lens, 'vented').get().chamber, tuning_hz: v }, vent: { ...focus(lens, 'vented').get().vent, length_m: null } }),
            () => rawTuningLens.set(null),
        );
        this.vent = new VentWindow(focus(lens, 'vent'), engine, () => getSolvedVentGroup ? getSolvedVentGroup().length_m : createCell(null, 'not-available'));
        this.losses = new VentedLossesWindow(focus(chamberLens, 'losses'));
    }
}
```

---

### 5. `PassiveRadiatorBox` Component

#### Before
```ts
// EXISTING: openisdDomain.ts (L221-L263 & L659-L745)
export interface PassiveRadiatorBox {
    readonly volume_m3: RawField<number>;
    readonly tuning_hz: FieldHandle<number>;
    readonly count: RawField<number>;
    readonly addedMass_kg: FieldHandle<number>;
    readonly losses: SealedLosses;
    configurePR(radiator: OpenISDPassiveRadiatorStandalone): void;
    readonly radiator: OpenISDPassiveRadiatorEmbedded;
    systemTuning_hz(): number | null;
    addedMassForTuning_kg(fp_hz: number): number | null;
    resonanceWithAddedMass_hz(): number | null;
}

// Inline Field definitions in OpenISDBox constructor...
```

#### After
```ts
// PROPOSED: openisdDomain.ts
export interface PassiveRadiatorBox {
    readonly volume_m3: RawField<number>;
    readonly tuning_hz: FieldHandle<number>;
    readonly count: RawField<number>;
    readonly addedMass_kg: FieldHandle<number>;
    readonly losses: SealedLosses;
    configurePR(radiator: OpenISDPassiveRadiatorStandalone): void;
    readonly radiator: OpenISDPassiveRadiatorEmbedded;
    systemTuning_hz(): number | null;
    addedMassForTuning_kg(fp_hz: number): number | null;
    resonanceWithAddedMass_hz(): number | null;
}

class PassiveRadiatorBoxWindow implements PassiveRadiatorBox {
    readonly volume_m3: RawField<number>;
    readonly tuning_hz: FieldHandle<number>;
    readonly count: RawField<number>;
    readonly addedMass_kg: FieldHandle<number>;
    readonly losses: SealedLosses;
    readonly radiator: OpenISDPassiveRadiatorEmbedded;

    constructor(
        lens: Lens<PassiveRadiatorBoxJson>,
        engine: Engine,
        getSolvedPrGroup?: () => { addedMass_kg: Cell<number>; tuning_hz: Cell<number> }
    ) {
        this.volume_m3 = focus(lens, 'volume_m3');
        this.count = focus(lens, 'count');
        this.losses = new SealedLossesWindow(focus(lens, 'losses'));
        this.radiator = new OpenISDPassiveRadiatorEmbedded(focus(lens, 'component'), engine);
        this.addedMass_kg = new Field<number>(
            () => getSolvedPrGroup ? getSolvedPrGroup().addedMass_kg : createCell(focus(lens, 'addedMass_kg').get(), focus(lens, 'addedMass_kg').get() !== null ? 'entered' : 'not-available'),
            (v) => focus(lens).set({ ...focus(lens).get(), addedMass_kg: v, tuning_hz: null }),
            () => focus(lens, 'addedMass_kg').set(null),
        );
        this.tuning_hz = new Field<number>(
            () => getSolvedPrGroup ? getSolvedPrGroup().tuning_hz : createCell(focus(lens, 'tuning_hz').get(), focus(lens, 'tuning_hz').get() !== null ? 'entered' : 'not-available'),
            (v) => focus(lens).set({ ...focus(lens).get(), tuning_hz: v, addedMass_kg: null }),
            () => focus(lens, 'tuning_hz').set(null),
        );
    }

    configurePR(chosen: OpenISDPassiveRadiatorStandalone): void { this.radiator.update(chosen); }
    systemTuning_hz(): number | null { return getSolvedPrGroup ? getSolvedPrGroup().tuning_hz.value : null; }
    addedMassForTuning_kg(fp_hz: number): number | null { return getSolvedPrGroup ? getSolvedPrGroup().addedMass_kg.value : null; }
    resonanceWithAddedMass_hz(): number | null { return null; }
}
```

---

### 6. `Bandpass4Box` Component

#### Before
```ts
// EXISTING: openisdDomain.ts (L162-L182 & L599-L629)
export interface Bandpass4Box {
    readonly chambers: {
        readonly rear: { readonly volume_m3: FieldHandle<number>; resonance_hz(): number | null; readonly losses: CoupledSealedLosses; };
        readonly front: { readonly volume_m3: RawField<number>; readonly tuning_hz: FieldHandle<number>; readonly losses: CoupledVentedLosses; };
    };
    readonly vents: { readonly front: Vent; };
}
```

#### After
```ts
// PROPOSED: openisdDomain.ts
export interface Bandpass4Box {
    readonly chambers: {
        readonly rear: { readonly volume_m3: FieldHandle<number>; resonance_hz(): number | null; readonly losses: CoupledSealedLosses; };
        readonly front: { readonly volume_m3: RawField<number>; readonly tuning_hz: FieldHandle<number>; readonly losses: CoupledVentedLosses; };
    };
    readonly vents: { readonly front: Vent; };
}

class Bandpass4BoxWindow implements Bandpass4Box {
    readonly chambers: Bandpass4Box['chambers'];
    readonly vents: Bandpass4Box['vents'];

    constructor(
        lens: Lens<Bandpass4BoxJson>,
        engine: Engine,
        getSolvedVentGroup?: () => { tuning_hz: Cell<number>; length_m: Cell<number> }
    ) {
        const bp4Front = focus(lens, 'front');
        const rawFrontTuning = focus(bp4Front, 'tuning_hz');
        this.chambers = {
            rear: {
                volume_m3: requiredField(focus(lens, 'rear'), 'volume_m3', 'bandpass4.rear.volume_m3'),
                resonance_hz: () => null,
                losses: new CoupledSealedLossesWindow(focus(focus(lens, 'rear'), 'losses')),
            },
            front: {
                volume_m3: focus(bp4Front, 'volume_m3'),
                tuning_hz: new Field<number>(
                    () => getSolvedVentGroup ? getSolvedVentGroup().tuning_hz : createCell(rawFrontTuning.get(), rawFrontTuning.get() !== null ? 'entered' : 'not-available'),
                    (v) => rawFrontTuning.set(v),
                    () => rawFrontTuning.set(null),
                ),
                losses: new CoupledVentedLossesWindow(focus(bp4Front, 'losses')),
            },
        };
        this.vents = {
            front: new VentWindow(focus(lens, 'frontVent'), engine, () => getSolvedVentGroup ? getSolvedVentGroup().length_m : createCell(null, 'not-available')),
        };
    }
}
```

---

### 7. `Bandpass6Box` Component

#### Before
```ts
// EXISTING: openisdDomain.ts (L185-L194 & L631-L641)
export interface Bandpass6Box {
    readonly chambers: { readonly rear: VentedChamber; readonly front: VentedChamber; };
    readonly vents: { readonly rear: Vent; readonly front: Vent; };
}
```

#### After
```ts
// PROPOSED: openisdDomain.ts
export interface Bandpass6Box {
    readonly chambers: { readonly rear: VentedChamber; readonly front: VentedChamber; };
    readonly vents: { readonly rear: Vent; readonly front: Vent; };
}

class Bandpass6BoxWindow implements Bandpass6Box {
    readonly chambers: Bandpass6Box['chambers'];
    readonly vents: Bandpass6Box['vents'];

    constructor(
        lens: Lens<Bandpass6BoxJson>,
        engine: Engine,
        getSolvedVentGroup?: () => { tuning_hz: Cell<number>; length_m: Cell<number> }
    ) {
        this.chambers = {
            rear: new VentedChamberWindow(focus(lens, 'rear')),
            front: new VentedChamberWindow(focus(lens, 'front')),
        };
        this.vents = {
            rear: new VentWindow(focus(lens, 'rearVent'), engine, () => getSolvedVentGroup ? getSolvedVentGroup().length_m : createCell(null, 'not-available')),
            front: new VentWindow(focus(lens, 'frontVent'), engine, () => getSolvedVentGroup ? getSolvedVentGroup().length_m : createCell(null, 'not-available')),
        };
    }
}
```

---

### 8. `AbcBox` Component (`ABCBox`)

#### Before
```ts
// EXISTING: openisdDomain.ts (L209-L219 & L643-L657)
export interface AbcBox {
    readonly chambers: { readonly rear: VentedChamber; readonly front: VentedChamber; };
    readonly vents: { readonly rear: Vent; readonly front: Vent; readonly intra: Vent; };
}
```

#### After
```ts
// PROPOSED: openisdDomain.ts
export interface AbcBox {
    readonly chambers: { readonly rear: VentedChamber; readonly front: VentedChamber; };
    readonly vents: { readonly rear: Vent; readonly front: Vent; readonly intra: Vent; };
}

class AbcBoxWindow implements AbcBox {
    readonly chambers: AbcBox['chambers'];
    readonly vents: AbcBox['vents'];

    constructor(
        lens: Lens<AbcBoxJson>,
        engine: Engine,
        getSolvedVentGroup?: () => { tuning_hz: Cell<number>; length_m: Cell<number> }
    ) {
        this.chambers = {
            rear: new VentedChamberWindow(focus(lens, 'rear')),
            front: new VentedChamberWindow(focus(lens, 'front')),
        };
        this.vents = {
            rear: new VentWindow(focus(lens, 'rearVent'), engine, () => getSolvedVentGroup ? getSolvedVentGroup().length_m : createCell(null, 'not-available')),
            front: new VentWindow(focus(lens, 'frontVent'), engine, () => getSolvedVentGroup ? getSolvedVentGroup().length_m : createCell(null, 'not-available')),
            intra: new VentWindow(focus(lens, 'intraVent'), engine, () => getSolvedVentGroup ? getSolvedVentGroup().length_m : createCell(null, 'not-available')),
        };
    }
}
```

---

## Component Interfaces & Data Models

### 1. Driver Consistency Group (`DriverSolverQuantities` & `ConsistencyIssue`)
```ts
// engine/solverQuantities.ts & engine/consistency.ts
export interface DriverSolverQuantities {
    // Thiele/Small
    Fs_hz?: number;
    Re_ohm?: number;
    Znom_ohm?: number;
    Le_H?: number;
    fLe_hz?: number;
    KLe_H_sqrtHz?: number;
    Qes?: number;
    Qms?: number;
    Qts?: number;
    Vas_m3?: number;
    Sd_m2?: number;
    Dd_m?: number;
    BL_Tm?: number;
    Mms_kg?: number;
    Cms_m_per_N?: number;
    Rms_kg_per_s?: number;
    EBP_hz?: number;
    // Large signal and power
    Xmax_m?: number;
    Vd_m3?: number;
    Hc_m?: number;
    Hg_m?: number;
    Pe_W?: number;
    // Sensitivity
    no?: number;
    SPLref_dB?: number;
    SPL_dB?: number;
    USPL_dB?: number;
    SPLmax_dB?: number;
    SPLmaxLF_dB?: number;
    // Figures of merit
    Rme_kg_per_s?: number;
    Mpow_N_per_sqrtW?: number;
    Mcost_kg_per_s?: number;
    gamma_m_per_s2_A?: number;
    Gloss?: number;
    // Dimensions
    Vcd_m?: number;
    Depth_m?: number;
    MagDepth_m?: number;
    Magnet_m?: number;
    DVol_m3?: number;
    // Air conditions
    c_m_per_s?: number;
    roo_kg_per_m3?: number;
    Re_terminal_ohm?: number;
    BL_terminal_Tm?: number;
    // Voice coil configuration
    numVC?: number;
    wiring?: Wiring;
}

export interface ConsistencyIssue {
    /** The relation as WINISD_SCHEMA.md §4 states it. */
    readonly formula: string;
    /** Every member of the group. */
    readonly fields: readonly (string)[];
    /** The member the relation predicts. */
    readonly target: string;
    /** What the other members imply for `target`, SI. */
    readonly expected: number;
    /** What `target` actually holds, SI. */
    readonly actual: number;
    /** |expected − actual| / |actual| — the size of the disagreement, unit-free. */
    readonly relative: number;
}
```

### 2. Passive Radiator Consistency Group (`PrSolverQuantities`)
```ts
// engine/solver.ts
export interface PrSolverQuantities {
    /** Stated or derived added mass on the passive radiator cone. */
    addedMass_kg?: number | null;
    /** Stated or derived system tuning frequency. */
    tuning_hz?: number | null;
    /** Driver-side box volume. */
    Vb_m3?: number | null;
    /** Passive radiator moving mass without added mass. */
    prMmd_kg?: number | null;
    /** Passive radiator cone area. */
    prSd_m2?: number | null;
    /** Passive radiator compliance. */
    prCms_m_per_N?: number | null;
    /** Number of passive radiators. */
    prNum?: number | null;
}
```

### 3. Vent Consistency Group (`VentSolverQuantities`)
```ts
// engine/solver.ts
export interface VentSolverQuantities {
    /** Stated or derived system tuning frequency. */
    tuning_hz?: number | null;
    /** Stated or derived physical vent length. */
    length_m?: number | null;
    /** Driver-side box volume. */
    Vb_m3?: number | null;
    /** Vent cross-sectional area. */
    area_m2?: number | null;
    /** Vent end correction length. */
    endCorrection_m?: number | null;
}
```

---

## Detailed Step-by-Step Execution

### Step 1: Engine Solvers & Validators (`packages/design/engine/`)
- Rename `SolverQuantities` $\to$ `DriverSolverQuantities` in `solverQuantities.ts`.
- Rename `solveConsistencyGroup` $\to$ `solveDriverConsistencyGroup` in `solver.ts` and `Engine.ts`.
- Implement `solvePrConsistencyGroup` and `checkPrConsistency` in `solver.ts`.
- Implement `solveVentConsistencyGroup` and `checkVentConsistency` in `solver.ts`.
- Expose `solveDriverConsistencyGroup`, `solvePrConsistencyGroup`, `solveVentConsistencyGroup`, `checkDriverConsistency`, `checkPrConsistency`, and `checkVentConsistency` on `Engine` class in `Engine.ts`.

### Step 2: Codebase-Wide Method Renaming (`packages/design`, `packages/ui`)
- Cleanly rename `solveConsistencyGroup` $\to$ `solveDriverConsistencyGroup` across `packages/design`, `packages/ui`, and all test suites. No aliases.
- Cleanly rename `solvePrGroup` $\to$ `solvePrConsistencyGroup` on `OpenISDProject`. No aliases.
- Cleanly rename `solveVentGroup` $\to$ `solveVentConsistencyGroup` on `OpenISDProject`. No aliases.

### Step 3: Domain Wiring (`packages/design/domain/openisdDomain.ts`)
- Implement `solvePrConsistencyGroup()` on `OpenISDProject` returning solved cell bags from `this.#engine.solvePrConsistencyGroup(...)` and `this.#engine.checkPrConsistency(...)`.
- Implement `solveVentConsistencyGroup()` on `OpenISDProject` returning solved cell bags from `this.#engine.solveVentConsistencyGroup(...)` and `this.#engine.checkVentConsistency(...)`.
- Update `passiveRadiator.addedMass_kg`, `passiveRadiator.tuning_hz`, `vented.tuning_hz`, and `vent.length_m` getters to construct `Cell<number>` using solved values and DQ messages.

---

## Verification Plan

### Targeted Unit Tests (TDD Loop)
Run targeted test files during TDD iterations:
```bash
npx vitest run packages/design/test/solver-group-pr-vent.test.ts packages/design/test/cell-dq.test.ts
```

### Full Health Check (Final Gate)
```bash
bash scripts/health-check.sh
```
