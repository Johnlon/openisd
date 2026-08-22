/**
 * Maps OpenISD's live design (box type + a `UiParams` snapshot + the derived driver) to the
 * WprInput shape @openisd/winisd's toWpr() serializes into a WinISD .wpr project file.
 *
 * Pure glue only — every box-tuning value comes from an EXISTING engine formula
 * (sealedFc, tuningFromLength, prTuning, prVas/prQms/prFsWithMass); no physics is
 * re-derived here (ARCHITECTURE.md: packages/ui/src/utils/ has no physics).
 *
 * Box-type → WinISD BType, and which chamber/vent carries the tuning:
 *   sealed     → 0, Vr/Fr = the driver's own sealed resonance in Vb, no ports
 *   vented     → 1, Vr/Fr = box volume + port-tuned frequency, rear port area = Sp
 *   bandpass4  → 2, rear (Vr/Fr) is SEALED — driver's own chamber, same formula as
 *                `sealed`; front (Vf/Ff) is VENTED — port-tuned off Vf, front port area = Sp
 *                (topology per WINISD_WPR_FILE_SCHEMA.md §4; OpenISD's own UI
 *                already treats bandpass4's rear "Frc" with the same sealed-style formula —
 *                see OriginalShell.vue's rearResonance)
 *   pr         → 4, Vr/Fr = prTuning(P), Npr = prNum, [PassiveRadiator] from the PR T/S
 */
import { sealedFc, tuningFromLength, prTuning, prVas, prQms, prFsWithMass, findImpedancePeak } from '@openisd/engine';
import type { EngineDriver, SweepResult } from '@openisd/engine';
import type { WprInput } from '@openisd/winisd';
import type { BoxType } from '@openisd/engine';
import type { UiParams, ProjectMeta } from '../types.js';

const BTYPE: Record<BoxType, number> = { sealed: 0, vented: 1, bandpass4: 2, pr: 4 };

/** 'YYYY-MM-DD' → 'YYYYMMDD'; passes through an already-digits or empty string unchanged. */
function toWinIsdDate(s: string): string {
  return s.replace(/-/g, '');
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

export function buildWprInput(
  box: BoxType,
  P: UiParams,
  driver: EngineDriver | null,
  driverSection: string,
  project: ProjectMeta,
  now: Date,
  /** Vent cross-sectional area, m² — a calculated value the caller reads off the domain
   *  object (`managedProject.ventArea_m2()`), never computed in this function
   *  (ARCHITECTURE.md §5 "only the domain objects calculate"). */
  ventArea_m2: number,
  curves?: SweepResult | null,
): WprInput {
  const Sp = ventArea_m2;
  const modifyDate = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;

  const input: WprInput = {
    project: {
      description: project.description || '',
      creator: project.creator || '',
      createDate: toWinIsdDate(project.created || ''), // never fabricated — '' if truly unknown
      modifyDate,
    },
    driverSection,
    box: { bType: BTYPE[box], Vr: P.Vb, Fr: 0, Ql: P.Ql, Qa: P.Qa, Qp: P.Qp },
    signal: { P: P.Pin, Rg: P.Rs, driverCount: P.nDrivers },
    voiceCoil: { alfaVC: P.alfaVC, tempRise_K: P.vcTempRise },
    // [SimulatorOptions] — the design's real Advanced-pane settings, not placeholders.
    // "Simulate voice coil inductance" is OpenISD's circuitModel under WinISD's wording.
    // The other two Advanced toggles (rgAtDriverSide, splXmaxLimited) have no key in this
    // format, so they are not written — see WprInput.simulatorOptions.
    simulatorOptions: {
      vcInductance: P.circuitModel === 'gyrator',
      flatResponse: P.forceFlatResponse,
      tlPorts:      P.tlPortModel,
    },
    // [Box] ambient — the design's own environment, per project as in WinISD. Humidity stays
    // a PERCENTAGE here; toWpr does the single conversion to WinISD's `phi` fraction.
    environment: { tempK: P.tempK, pressurePa: P.pressurePa, humidityPct: P.humidityPct },
  };

  const peak = (driver && curves) ? findImpedancePeak(curves, driver.Re) : null;
  const sealedFr = peak ? peak.Fsc : ((driver && sealedFc(driver, P.Vb)) ?? 0);

  if (box === 'sealed') {
    input.box.Fr = sealedFr;
  } else if (box === 'vented') {
    // The solved tuning from the store's vent group, not a recompute from the length. The two
    // agree whenever the group is determined — but if BOTH Fb and ventL are entered (allowed,
    // and left alone deliberately), recomputing here would export a tuning that contradicts
    // the one on screen. `.wpr` has no slot for the entered set, so the exported file is plain
    // geometry either way; it should at least be the geometry the user is looking at.
    input.box.Fr = P.Fb;
    input.box.SdRear = Sp;
    input.ventRear = { dia: P.ventD, len: P.ventL, endCorrection: P.endCorrection,
      // [VentRear].Fb/Vb are WinISD's copy of the rear chamber's own [Box].Fr/Vr (confirmed
      // against the whole parity corpus — see WprVent.Fb/Vb), so they come from the SAME
      // values just written above, not a second computation.
      Fb: input.box.Fr, Vb: input.box.Vr, carea: Sp,
      // Round port: the area is always derived from the diameter. This is provenance,
      // not a constant — a slot vent is entered as W×H, i.e. the area IS entered, and
      // this must become false there rather than silently writing a false flag.
      crossCalculated: !P.entered.ventCrossArea };
  } else if (box === 'bandpass4') {
    input.box.Fr = sealedFr; // rear: sealed, driver's own chamber
    input.box.Vf = P.Vf;
    input.box.Ff = tuningFromLength(P.Vf, P.ventL, Sp, P.endCorrection); // front: vented
    input.box.SdFront = Sp;
    input.ventFront = { dia: P.ventD, len: P.ventL, endCorrection: P.endCorrection,
      // [VentFront].Fb/Vb are WinISD's copy of the front chamber's own [Box].Ff/Vf (confirmed
      // against the whole parity corpus — see WprVent.Fb/Vb), so they come from the SAME
      // values just written above, not a second computation.
      Fb: input.box.Ff, Vb: input.box.Vf, carea: Sp,
      // Round port: the area is always derived from the diameter. This is provenance,
      // not a constant — a slot vent is entered as W×H, i.e. the area IS entered, and
      // this must become false there rather than silently writing a false flag.
      crossCalculated: !P.entered.ventCrossArea };
  } else if (box === 'pr') {
    input.box.Fr = prTuning(P);
    input.box.npr = P.prNum;
    input.pr = {
      // prVas() returns LITRES (its own contract, correct for PREditModal's display) — the
      // .wpr's [PassiveRadiator].Vas is SI cubic metres, like every other field in that
      // section. BUG_20260817_wpr_passive_radiator_vas_written_in_litres...: this was writing
      // litres straight into the m^3 field, 1000x too large.
      Vas: prVas(P.prCms, P.prSd) / 1000,
      Qms: prQms(P.prMmd, P.prCms, P.prRms),
      Fs: prFsWithMass(P.prMmd, P.prMadd, P.prCms),
      Sd: P.prSd,
      Xmax: P.prXmax,
      Me: P.prMadd,
    };
  }

  return input;
}
