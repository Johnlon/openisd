/**
 * "Coil wiring" (QO907, issue 512): how the user will wire a multi-coil driver's own voice coils, beside the wiring the maker
 * measured Re and BL in. It is the project's `VCCon`, named as the driver's (the setting that was always called Connection,
 * WinISD's project VCCon; John, QO942.c54 and c56): `series` or `parallel`, absent until chosen, when it follows the driver's
 * `VCCon`. Data version 5 renamed the project's saved `wiring` key to `VCCon`, value kept as saved (QO946.c18, c23;
 * `coilWiringAsVCCon.ts`).
 */
import type {Engine, Wiring} from '../../engine/index.js';
import type {SimpleField} from '../cell.js';
import type {OpenISDDriverEmbeddingJson} from '../openisdSchema.js';
import type {OpenISDDriver} from '../driver/openISDDriver.js';
import type {OpenISDDriverEmbedded} from '../driver/openISDDriverEmbedded.js';
import type {TerminalMotor} from '../driver/openIsdDriverSpec.js';

/** Where the measured wiring comes from. */
export type MeasuredBasis = 'stated' | 'inferred' | 'not-stated' | 'single-coil';

export interface CoilWiringOption {
    readonly value: Wiring;
    readonly label: string;
}

const OPTIONS: readonly CoilWiringOption[] = Object.freeze([
    Object.freeze({value: 'series' as const, label: 'Series'}),
    Object.freeze({value: 'parallel' as const, label: 'Parallel'}),
]);

const OTHER: Readonly<Record<Wiring, Wiring>> = Object.freeze({series: 'parallel', parallel: 'series'});

export class ProjectCoilWiring {
    readonly #embedding: SimpleField<OpenISDDriverEmbeddingJson>;
    readonly #driver: OpenISDDriverEmbedded;
    readonly #engine: Engine;

    constructor(embedding: SimpleField<OpenISDDriverEmbeddingJson>, driver: OpenISDDriverEmbedded, engine: Engine) {
        this.#embedding = embedding;
        this.#driver = driver;
        this.#engine = engine;
    }

    /** The wiring Re and BL are published in; null when the driver does not say. */
    get measured(): Wiring | null {
        return this.#driver.specs.VCCon.value;
    }

    get measuredBasis(): MeasuredBasis {
        const numVC = this.#driver.specs.numVC.value;
        if (numVC === null || numVC < 2) return 'single-coil';
        if (this.measured === null) return 'not-stated';
        return this.#driver.specs.VCCon.entered ? 'stated' : 'inferred';
    }

    /** Why Coil wiring cannot be chosen; null when it can. */
    get unavailableReason(): string | null {
        const numVC = this.#driver.specs.numVC.value;
        if (numVC === null) return 'The number of voice coils is not stated, so there is no wiring to choose.';
        if (numVC < 2) return 'This driver has one voice coil, so there is no wiring to choose.';
        const measured = this.measured;
        if (measured === null) {
            return 'Measured wiring not stated, so the figures cannot be converted. If you know it, set it on the driver (Edit).';
        }
        const probe = this.#engine.driver.convertWiring({Re_ohm: 1, BL_Tm: 1, Le_H: null, Znom_ohm: null}, numVC, measured, OTHER[measured]);
        return probe.converted ? null : probe.reason;
    }

    /** What a click on the greyed desktop control says (John, QO942.c88, c90); null when the wiring can be chosen. */
    get greyedMessage(): string | null {
        if (this.canChoose) return null;
        return this.measuredBasis === 'not-stated'
            ? 'The datasheet does not say how the coils were wired when measured, so the wiring cannot be changed. The figures are used as published.'
            : 'Coil wiring applies only to drivers with 2 or more voice coils.';
    }

    get canChoose(): boolean {
        return this.unavailableReason === null;
    }

    /** The wiring in force: the user's choice, else the measured one; null when it cannot be chosen. */
    get mine(): Wiring | null {
        if (!this.canChoose) return null;
        return this.#embedding.value.VCCon ?? this.measured;
    }

    get options(): readonly CoilWiringOption[] {
        return OPTIONS;
    }

    /** Re, BL, Le and Znom as published, for the measured wiring. */
    get published(): TerminalMotor {
        const s = this.#driver.specs;
        return {Re_ohm: s.Re_ohm.value, BL_Tm: s.BL_Tm.value, Le_H: s.Le_H.value, Znom_ohm: s.Znom_ohm.value};
    }

    /** The same figures for Coil wiring: what the amplifier sees. */
    get atMine(): TerminalMotor {
        return this.#driver.specs.terminalMotor();
    }

    /** A standalone copy of the project's driver stating the figures for Coil wiring, with Coil wiring
     *  as its wiring: what a project file carries. The project's own driver keeps the published
     *  figures. Where nothing is converted (no choice, or one equal to the measured wiring) it is
     *  a plain copy. */
    driverAtMine(): OpenISDDriver {
        const copy = this.#driver.detach();
        const mine = this.mine;
        if (mine === null || mine === this.measured) return copy;
        const converted = this.atMine;
        const s = copy.specs;
        const stated: readonly [typeof s.Re_ohm, number | null][] = [
            [s.Re_ohm, converted.Re_ohm], [s.BL_Tm, converted.BL_Tm], [s.Le_H, converted.Le_H], [s.Znom_ohm, converted.Znom_ohm],
        ];
        for (const [field, value] of stated) {
            const was = field.value;
            if (!field.entered || was === null || value === null) continue;
            field.set(value, field.precision === null ? undefined : field.precision * (value / was));
        }
        s.VCCon.set(mine);
        return copy;
    }

    choose(wiring: Wiring): void {
        const reason = this.unavailableReason;
        if (reason !== null) throw new Error(reason);
        this.#write(wiring);
    }

    /** Back to following the measured wiring. */
    clear(): void {
        if (this.#embedding.value.VCCon === undefined) return;
        this.#write(undefined);
    }

    #write(wiring: Wiring | undefined): void {
        const {VCCon: _was, ...rest} = this.#embedding.value;
        this.#embedding.set(wiring === undefined ? rest : {...rest, VCCon: wiring});
    }
}
