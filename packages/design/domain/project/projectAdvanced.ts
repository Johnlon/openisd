import {LossMode} from '../../fields/lossMode.js';
import { focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { Filter } from '../../engine/index.js';
import type { OpenISDProjectJson } from '../openisdSchema.js';

/** A project's own advanced/compatibility window, built fresh on every access — same reasoning
 *  as `driver`/`box`/`ProjectMeta`/`ProjectEnvironment` (PLAN_openisdproject_split.md). `filters`
 *  lives on its own top-level slot, not under `advanced`, so `wrap` takes both lenses; nothing
 *  here needs the engine. */
export class ProjectAdvanced {
    static wrap(
        advanced: SimpleField<OpenISDProjectJson['advanced']>,
        filtersSlot: SimpleField<OpenISDProjectJson['filters']>,
    ): ProjectAdvanced {
        return new ProjectAdvanced(advanced, filtersSlot);
    }

    readonly #advanced: SimpleField<OpenISDProjectJson['advanced']>;
    readonly #filtersSlot: SimpleField<OpenISDProjectJson['filters']>;

    private constructor(
        advanced: SimpleField<OpenISDProjectJson['advanced']>,
        filtersSlot: SimpleField<OpenISDProjectJson['filters']>,
    ) {
        this.#advanced = advanced;
        this.#filtersSlot = filtersSlot;
    }

    /** The signal-chain filter list. */
    get filters(): SimpleField<readonly Filter[]> {
        return focus(this.#filtersSlot, 'filters');
    }

    /** Force-flat auto-EQ — WinISD Advanced "Force flat response". */
    get forceFlatResponse(): SimpleField<boolean> {
        return focus(this.#advanced, 'forceFlatResponse');
    }

    /** Model ports as a lossy transmission line instead of a lumped mass — WinISD Advanced
     *  "Use transmission line-model for port simulation". */
    get useTransmissionLinePortModel(): SimpleField<boolean> {
        return focus(this.#advanced, 'useTransmissionLinePortModel');
    }

    /** WinISD Advanced "Rg is at driver side" — whether the amplifier's source resistance
     *  (`Rs_ohm`) is applied per driver or once across the whole array. */
    get rgAtDriverSide(): SimpleField<boolean> {
        return focus(this.#advanced, 'rgAtDriverSide');
    }

    /** WinISD Advanced "Simulate voice coil inductance" — includes Le in the acoustic circuit
     *  model (gyrator) rather than just the impedance plot (winisd). 'winisdGyrator' is WinISD's
     *  own inductance-on model. */
    get circuitModel(): SimpleField<'winisd' | 'gyrator' | 'winisdGyrator'> {
        return focus(this.#advanced, 'circuitModel');
    }

    /** WinISD Advanced "SPL graph is Xmax limited" — whether the SPL chart shows the
     *  Xmax-backed-off curve instead of the unclamped one. Display only. */
    get splGraphIsXmaxLimited(): SimpleField<boolean> {
        return focus(this.#advanced, 'splGraphIsXmaxLimited');
    }

    /** Sealed-box resonance loss model (S10/QO130) — which physics model `box.sealed`'s Fsc/Qtc
     *  readout uses. PROJECT-scoped, not a UI singleton: two open projects must not share one
     *  loss mode. `advanced.lossMode` stores the wire string; this is the one boundary that
     *  translates it via `LossMode.parse`/`.value`, matching the `circuitModel` accessor above. */
    get lossMode(): SimpleField<LossMode> {
        const lens = focus(this.#advanced, 'lossMode');
        return {
            get value() { return LossMode.parse(lens.value); },
            set: (mode: LossMode) => lens.set(mode.value),
        };
    }

    /** WinISD Advanced / Compatibility "Use WinISD driver calculations" — whether engine sweeps
     *  substitute the driver WinISD's own simulation acts on, `Mms = 1/((2π·Fs)²·Cms)`,
     *  `Rms = 2π·Fs·Mms/Qms` and `BL = √(Re/(2π·Fs·Qes·Cms))`, for entered values that conflict
     *  with them (measured 2026-09-26, docs/research/WINISD_PARITY.md). On where a project does
     *  not say, per the README: untouched, OpenISD gives WinISD's answer. */
    get winisdDriverModel(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdDriverModel');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "WinISD VA model": the amplifier apparent load power chart as WinISD
     *  computes it, P·Re·|Hf|²/|Z + Rg| (BUG_20260927_winisd-va-uses-re-not-re-plus-rg). Off: the
     *  apparent power the amplifier delivers, P·(Re + Rg)·|Hf|²/|Z_amp|. On where a project does
     *  not say. */
    get winisdVaModel(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdVaModel');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "WinISD ABC intra-port velocity": the ABC intra-chamber port velocity
     *  chart as WinISD draws it, V/(jωMai + Zf), which omits the leak term Zf·jωMai/Ricl. Off: the
     *  exact current through the port mass, V/[jωMai + Zf·(1 + jωMai/Ricl)]. On (WinISD) where a
     *  project does not say. */
    get winisdAbcIntraPortVelocity(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdAbcIntraPortVelocity');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "PR Npr resonance": the passive-radiator box's fixed leak and absorption
     *  losses taken at WinISD's ωr = 1/√(Npr·Map·(Cab ∥ Npr·Cap)), Npr times below the tuning. Off:
     *  the physical tuning. Off where a project does not say; no effect at Npr = 1. */
    get winisdPrNprResonance(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdPrNprResonance');
        return {
            get value() { return lens.value ?? false; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "WinISD Bessel high-pass": Bessel high-pass filters as WinISD computes
     *  them, (k·s)^n over the low-pass's own denominator. Off: the mirror of the low-pass (s → 1/s).
     *  Off where a project does not say. */
    get winisdBesselHighpass(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdBesselHighpass');
        return {
            get value() { return lens.value ?? false; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "WinISD phase wrapping": wraps phase curves to [-180°, +180°] (default).
     *  Off: continuous unwrapped phase. On where a project does not say. */
    get winisdWrapPhase(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdWrapPhase');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "WinISD driver count": N drivers as WinISD simulates them, each alone
     *  in Vb/N fed P/N (BUG_20260928_driver-count-not-winisd). Off: the N coils wired by `wiring`
     *  into one terminal impedance. On where a project does not say. */
    get winisdDriverCountModel(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdDriverCountModel');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "WinISD flat response": "Force flat response" as WinISD does it, every
     *  point to the transfer function's 0 dB, uncapped (BUG_20260928_force-flat-response-not-winisd).
     *  Off: boost only, up to the passband reference, capped. On where a project does not say. */
    get winisdFlatModel(): SimpleField<boolean> {
        const lens = focus(this.#advanced, 'winisdFlatModel');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }
}
