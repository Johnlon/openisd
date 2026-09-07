import { z } from 'zod';

import type { CellState } from '../domain/cell.js';

/**
 * WinISD ParState — the fixed 49-slot edit-state table.
 *
 * ParState is always exactly 49 chars mapped to WinISD's internal parameter list, which
 * is NOT the WDR file's key order (e.g. Qts is slot 14 though the WDR writes it first).
 * Every position except 20 and 46 is probe-confirmed via single-parameter files in
 * drivers/sample/ — see drivers/sample/README.md "Confirmed ParState position map" and
 * scripts/scraper_lib.py. Those two are covered by the note on POS_TO_WDRKEY below.
 *
 * E = the human/source entered the value · C = WinISD computed it · N = not in play.
 */

/**
 * E/C/N — WinISD's ENCODING of a provenance, and NOT A SECOND TYPE.
 *
 * The three letters exist nowhere else in the codebase. They are what this one file format writes
 * on disk; the app's vocabulary is `CellState` (`domain/cell.ts`), and every caller of this
 * module hands one in and gets one back (John, 2026-09-01: hide the letters "entirely inside the
 * WinISD i/o code"). Neither the table nor the schema below is exported — `markOf` and
 * `provenanceOf` are the whole surface, and neither of them can be called with a letter.
 */
const WDR_MARK: Record<CellState, string> = {
  entered: 'E',
  calculated: 'C',
  'not-available': 'N',
};

/** One ParState letter → the provenance it encodes. A letter the format does not define is a
 *  corrupt file, not a fourth state, so this REFUSES rather than defaulting. */
const WdrMarkSchema = z.enum(['E', 'C', 'N']).transform(
  letter => ({ E: 'entered', C: 'calculated', N: 'not-available' } as const)[letter],
);

/** The `.wdr` byte that encodes this provenance. Total by construction — `Record<CellState,…>`
 *  means a fourth state is a compile error here, never a silently missing mark. */
export function markOf(state: CellState): string {
  return WDR_MARK[state];
}

/** The provenance a `.wdr` byte states. Throws on anything else. */
export function provenanceOf(letter: string): CellState {
  return WdrMarkSchema.parse(letter);
}

/**
 * Slot → WDR file key. Exactly ONE slot is null: 10 (`Xlim`), which has a live editor field
 * and a mark but no key in the writer's literal pool — WinISD discards its value on save.
 *
 * Slots 20 and 46 are real keys that black-box probing could not reach, and the two rest on
 * different strength of evidence (`winisd_research/GHIDRA_FINDINGS.md`):
 *  - slot 20 = `Dia` is PROVEN: the registration block at `0x449e6e` binds `D+0x1E0` to the
 *    control `eddia`. It reads `N` in every WinISD-authored file because nothing computes `Dia`
 *    and its field is off the default tab, so nobody enters one either.
 *  - slot 46 = `VCCon` is UNPROVEN and we have no concrete evidence that this slot is related.
 *    None of our probing causes slot 46 to change. No instruction in `.text` writes slot 46 at all,
 *    so it only ever holds the `N` from a blank driver's `FillChar` or whatever a loaded file supplied.
 *    Because the slot pairing cannot be proven, we must never rely on ParState for `VCCon`.
 *
 * Which is why a hand-authored `E` in either slot round-trips through WinISD untouched —
 * `drivers/sample/winisd/inconsistency-test-saved.wdr` carries `E` in both and WinISD
 * reproduced them exactly.
 */
export const POS_TO_WDRKEY: readonly (string | null)[] = [
  'Znom',   // 0
  'Fs',     // 1
  'Pe',     // 2
  'SPL',    // 3  written as a key — drivers/sample/winisd/john-all-defaults.wdr emits SPL=0
  'Re',     // 4
  'Le',     // 5
  'fLe',    // 6
  'KLe',    // 7
  'BL',     // 8
  'Xmax',   // 9
  null,     // 10 Xlim — ParState-only, no WDR key
  'Cms',    // 11
  'Qms',    // 12
  'Qes',    // 13
  'Qts',    // 14
  'Rms',    // 15
  'Mms',    // 16
  'Sd',     // 17
  'Vd',     // 18
  'Vas',    // 19
  'Dia',    // 20  editor field `eddia`, value at D+0xE8
  'Dd',     // 21
  'no',     // 22 η₀
  'numVC',  // 23
  'Hc',     // 24
  'Hg',     // 25
  'SPLmax', // 26
  'SPLmaxLF', // 27
  'USPL',   // 28
  'alfaVC', // 29
  'Rt',     // 30
  'Ct',     // 31
  'gamma',  // 32
  'EBP',    // 33
  'Rme',    // 34
  'Mpow',   // 35
  'Mcost',  // 36
  'Gloss',  // 37
  'Thick',  // 38
  'Depth',  // 39
  'MagDepth', // 40
  'Magnet', // 41
  'Basket', // 42
  'Outer',  // 43
  'Vcd',    // 44
  'DVol',   // 45
  'VCCon',  // 46  INFERRED — editor combo `edConMode`, value at D+0x1C8
  'c',      // 47
  'roo',    // 48
];

export const PARSTATE_LEN = POS_TO_WDRKEY.length;

/** A ParState row: exactly one mark per slot, each one a mark WinISD writes. */
const ParStateRowSchema = z.array(WdrMarkSchema).length(PARSTATE_LEN);

/**
 * A `.wdr` whose ParState row cannot be believed. Thrown, not swallowed: ParState is the only
 * record a `.wdr` keeps of WHO authored each number, so reading a mark out of a broken row
 * would put a fabricated provenance claim into the app — worse than refusing the file, because
 * nobody downstream can tell it apart from a real one (John, 2026-09-01).
 *
 * The message names the slot, the field and the offending text, because the remedy is for a
 * person to open the file and correct the `ParState=` line.
 */
export class ParStateError extends Error {
  override name = 'ParStateError';
}

/**
 * The marks a ParState row states, or a `ParStateError` naming what is wrong with it.
 *
 * A file with NO ParState line at all is a different case and never reaches here — that is a
 * scraper-authored `.wdr`, a shape we write ourselves, and `fromWdrIni` reads presence ⇒ E for
 * it. This function is only ever asked about a row the file DOES carry.
 */
export function parseParState(row: string): readonly CellState[] {
  const marks = [...row];
  if (marks.length !== PARSTATE_LEN) {
    throw new ParStateError(
      `ParState carries ${marks.length} marks; a WinISD .wdr always carries exactly ${PARSTATE_LEN}, `
      + 'one per field. Edit the ParState= line to the right length before loading this file.');
  }
  const parsed = ParStateRowSchema.safeParse(marks);
  if (parsed.success) return parsed.data;

  const bad = marks
    .map((mark, slot) => ({ mark, slot }))
    .filter(({ mark }) => mark !== 'E' && mark !== 'C' && mark !== 'N')
    .map(({ mark, slot }) => `slot ${slot} (${POS_TO_WDRKEY[slot] ?? 'Xlim'}) holds ${JSON.stringify(mark)}`);
  throw new ParStateError(
    `ParState holds ${bad.length} mark(s) WinISD never writes — ${bad.join(', ')}. `
    + 'Every mark must be E (a person or datasheet stated the value), C (WinISD computed it) or '
    + 'N (not in play). Edit the ParState= line before loading this file.');
}
