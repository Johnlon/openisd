import {type Engine} from '../../engine/index.js';
import type { Air, DriverSolverParams, SolverInput, Wiring } from '../../engine/index.js';
import { VoiceCoilWiring } from '../voiceCoilWiring.js';
import { computedSlot } from './computedSlot.js';
import { NO_SLOT } from './noSlot.js';
import { OpenIsdDriverSpec } from './openIsdDriverSpec.js';
import { winisdBLterminal_Tm } from './winisdBLterminal.js';
import { winisdCms_m_per_N } from './winisdCms.js';
import { winisdMms_kg } from './winisdMms.js';
import { winisdRms_kg_per_s } from './winisdRms.js';

/** `spec`'s 44 handles, shaped as `DriverSolverParams` for `SimulationEngine.sweep()`/`maxCurves()`
 *  (S2-10 ruling: "`OpenIsdDriverSpec` structurally satisfies `DriverSolverParams`") — true for
 *  40 of the 44 by name; the other four are ADAPTED, not merely reused: `SPLref_dB`/
 *  `Re_terminal_ohm`/`BL_terminal_Tm` have no domain storage slot (matching `NO_SLOT`'s own doc
 *  above), and `wiring` is spelled `VCCon` here and carries a `VoiceCoilWiring` enum member, not
 *  the bare `'series'|'parallel'` union `DriverSolverParams` names. */
export function driverSolverParamsOf(spec: OpenIsdDriverSpec, engine: Engine, winisdDriverModel: boolean = false, air: Air | null = null): DriverSolverParams {
    const wiring: Wiring = spec.VCCon.value === VoiceCoilWiring.Series ? 'series' : 'parallel';
    const Re_ohm = spec.Re_ohm.value;
    const BL_Tm = spec.BL_Tm.value;
    const numVC = spec.numVC.value ?? undefined;
    const wiringInput: SolverInput<Wiring> = { value: wiring, entered: spec.VCCon.entered };

    const Re_terminal_ohm = Re_ohm == null ? null : engine.driver.terminalRe_ohm(Re_ohm, numVC, wiring);
    const BL_terminal_entered_Tm = BL_Tm == null ? null : engine.driver.terminalBL_Tm(BL_Tm, numVC, wiring);

    // WinISD's simulation reads Fs, Vas, Qes, Qms, Sd and Re, and nothing else: it keeps entered
    // Cms, Mms, BL and Rms untouched and its circuit names none of them outside CLe (measured
    // against 0.7.0.950, winisd_research/PROBE_FINDINGS.md). So the flag substitutes the four,
    // each only where its own inputs are present and positive, and each downstream one off the
    // substituted Cms — every one an identity on a self-consistent driver. The entered BL still
    // reaches the engine as `BL_Tm`, which is what the 'winisdGyrator' inductance model scales Le
    // by; WinISD reads the entered BL there too.
    const cmsField = winisdDriverModel ? winisdCms_m_per_N(spec, air) : spec.Cms_m_per_N;
    const mmsField = winisdDriverModel ? winisdMms_kg(spec, cmsField.value) : spec.Mms_kg;
    const rmsField = winisdDriverModel ? winisdRms_kg_per_s(spec, mmsField) : spec.Rms_kg_per_s;
    const blTerminal = winisdDriverModel
        ? winisdBLterminal_Tm(spec, Re_terminal_ohm, cmsField.value, BL_terminal_entered_Tm)
        : BL_terminal_entered_Tm;

    return {
        ...spec,
        Cms_m_per_N: cmsField,
        Mms_kg: mmsField,
        Rms_kg_per_s: rmsField,
        SPLref_dB: NO_SLOT,
        Re_terminal_ohm: computedSlot(Re_terminal_ohm),
        BL_terminal_Tm: computedSlot(blTerminal),
        wiring: wiringInput,
        // The circuit's air is the PROJECT's, when one is given — the driver's own
        // c_m_per_s/roo_kg_per_m3 are display-only and feed no calculation
        // (BUG_20260924_driver-solve-and-sweep-use-different-air-models.md). A caller with no
        // project (a standalone driver's own chart) passes no `air`, and the spread above already
        // carries the driver's own stated pair.
        ...(air !== null ? { c_m_per_s: computedSlot(air.c), roo_kg_per_m3: computedSlot(air.rho) } : {}),
    };
}
