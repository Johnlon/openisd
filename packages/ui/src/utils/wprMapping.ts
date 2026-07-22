/**
 * Maps OpenISD's live design (box type + state.P + the derived driver) to the WprInput
 * shape @openisd/winisd's toWpr() serializes into a WinISD .wpr project file.
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
 *                (topology per WINISD_WPR_FILE_SCHEMA.md §4; OpenISD's own Original-skin UI
 *                already treats bandpass4's rear "Frc" with the same sealed-style formula —
 *                see OriginalShell.vue's rearResonance)
 *   pr         → 4, Vr/Fr = prTuning(P), Npr = prNum, [PassiveRadiator] from the PR T/S
 */
import { sealedFc, tuningFromLength, prTuning, prVas, prQms, prFsWithMass } from '@openisd/engine';
import type { Driver } from '@openisd/engine';
import type { WprInput } from '@openisd/winisd';
import type { BoxType, UiParams, ProjectMeta } from '../types.js';

const BTYPE: Record<BoxType, number> = { sealed: 0, vented: 1, bandpass4: 2, pr: 4 };

/** 'YYYY-MM-DD' → 'YYYYMMDD'; passes through an already-digits or empty string unchanged. */
function toWinIsdDate(s: string): string {
  return s.replace(/-/g, '');
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

export function buildWprInput(
  box: BoxType,
  P: UiParams,
  driver: Driver | null,
  driverSection: string,
  project: ProjectMeta,
  now: Date,
): WprInput {
  const Sp = Math.PI * (P.ventD / 2) ** 2;
  const modifyDate = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;

  const input: WprInput = {
    project: {
      description: project.description || '',
      creator: project.creator || '',
      createDate: toWinIsdDate(project.created || ''), // never fabricated — '' if truly unknown
      modifyDate,
    },
    driverSection,
    box: { bType: BTYPE[box], Vr: P.Vb, Fr: 0 },
    signal: { P: P.Pin },
  };

  if (box === 'sealed') {
    input.box.Fr = (driver && sealedFc(driver, P.Vb)) ?? 0;
  } else if (box === 'vented') {
    input.box.Fr = tuningFromLength(P.Vb, P.ventL, Sp, P.endCorrection);
    input.box.SdRear = Sp;
    input.ventRear = { dia: P.ventD, len: P.ventL, endCorrection: P.endCorrection };
  } else if (box === 'bandpass4') {
    input.box.Fr = (driver && sealedFc(driver, P.Vb)) ?? 0; // rear: sealed, driver's own chamber
    input.box.Vf = P.Vf;
    input.box.Ff = tuningFromLength(P.Vf, P.ventL, Sp, P.endCorrection); // front: vented
    input.box.SdFront = Sp;
    input.ventFront = { dia: P.ventD, len: P.ventL, endCorrection: P.endCorrection };
  } else if (box === 'pr') {
    input.box.Fr = prTuning(P);
    input.box.npr = P.prNum;
    input.pr = {
      Vas: prVas(P.prCms, P.prSd),
      Qms: prQms(P.prMmd, P.prCms, P.prRms),
      Fs: prFsWithMass(P.prMmd, P.prMadd, P.prCms),
      Sd: P.prSd,
      Xmax: P.prXmax,
      Me: P.prMadd,
    };
  }

  return input;
}
