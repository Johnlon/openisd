/**
 * "My wiring" (QO907, issue 512): how the user will wire a multi-coil driver's own voice coils,
 * beside the wiring the maker measured Re and BL in. A project setting, `series` or `parallel`,
 * absent until chosen, when it follows the measured wiring. It is not the project's `wiring`,
 * which joins several drivers.
 */
import type {Engine, Wiring} from '../../engine/index.js';
import type {SimpleField} from '../cell.js';
import type {OpenISDDriverEmbeddingJson} from '../openisdSchema.js';
import {NumberField} from '../../fields/field.js';
import {formatTrimmed} from '../../fields/format.js';
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

    /** Why My wiring cannot be chosen; null when it can. */
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

    get canChoose(): boolean {
        return this.unavailableReason === null;
    }

    /** The wiring in force: the user's choice, else the measured one; null when it cannot be chosen. */
    get mine(): Wiring | null {
        if (!this.canChoose) return null;
        return this.#embedding.value.coilWiring ?? this.measured;
    }

    get options(): readonly CoilWiringOption[] {
        return OPTIONS;
    }

    /** Re, BL, Le and Znom as published, for the measured wiring. */
    get published(): TerminalMotor {
        const s = this.#driver.specs;
        return {Re_ohm: s.Re_ohm.value, BL_Tm: s.BL_Tm.value, Le_H: s.Le_H.value, Znom_ohm: s.Znom_ohm.value};
    }

    /** The same figures for My wiring: what the amplifier sees. */
    get atMine(): TerminalMotor {
        return this.#driver.specs.terminalMotor();
    }

    /** A standalone copy of the project's driver stating the figures for My wiring, with My wiring
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

    /** Re and BL as published, in words. */
    get publishedFigures(): string {
        return figuresText(this.published);
    }

    /** Re and BL for My wiring, in words. */
    get mineFigures(): string {
        return figuresText(this.atMine);
    }

    choose(wiring: Wiring): void {
        const reason = this.unavailableReason;
        if (reason !== null) throw new Error(reason);
        this.#write(wiring);
    }

    /** Back to following the measured wiring. */
    clear(): void {
        if (this.#embedding.value.coilWiring === undefined) return;
        this.#write(undefined);
    }

    #write(wiring: Wiring | undefined): void {
        const {coilWiring: _was, ...rest} = this.#embedding.value;
        this.#embedding.set(wiring === undefined ? rest : {...rest, coilWiring: wiring});
    }
}

function figuresText(motor: TerminalMotor): string {
    const parts: string[] = [];
    if (motor.Re_ohm !== null) parts.push(`Re ${shown('Re_ohm', motor.Re_ohm)}`);
    if (motor.BL_Tm !== null) parts.push(`BL ${shown('BL_Tm', motor.BL_Tm)}`);
    return parts.join(' · ');
}

/** `valueSI` in the field's display unit to 3 decimals, trailing zeros down to 2 (4.70 Ω, 1.175 Ω). */
function shown(key: string, valueSI: number): string {
    const field = NumberField.named(key);
    if (field === undefined) return String(valueSI);
    return `${formatTrimmed(field.toDisplay(valueSI), 3)} ${field.unitLabel()}`;
}
