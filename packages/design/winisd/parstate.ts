import {z} from 'zod';
import type {CellState} from "./cellState.js";


/**
 * WinISD ParState — the fixed 49-slot edit-state table.
 *
 * ParState is always exactly 49 chars mapped to WinISD's internal parameter list, which
 * is NOT the WDR file's key order (e.g. Qts is slot 14 though the WDR writes it first).
 * Every position except 20 and 46 is probe-confirmed via single-parameter files in
 * drivers/mysamples/ — see drivers/mysamples/README.md "Confirmed ParState position map" and
 * scripts/scraper_lib.py. The `.wdr` codec names each slot explicitly at every read
 * (`readWdrRow(raw, marks, 'Qts', 14)` in `winisdDriver.ts`) and write
 * (`#parState()`'s one entry per slot), so no slot→field table lives here — a field renamed
 * or re-slotted is a compile error at the codec, not a table entry to update.
 *
 * E = the human/source entered the value · C = WinISD computed it · N = not in play.
 */

/**
 * E/C/N — WinISD's ENCODING of a provenance, and NOT A SECOND TYPE.
 *
 * The three letters exist nowhere else in the codebase. They are what this one file format writes
 * on disk; the app's vocabulary is `CellState` (`domain/cellState.ts`), and every caller of this
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


/** Exactly how many marks a ParState row always carries — one per slot, 49. */
export const PARSTATE_LEN = 49;

/** A ParState row: exactly one mark per slot, each one a mark WinISD writes. */
const ParStateRowSchema = z.array(WdrMarkSchema).length(PARSTATE_LEN);

/**
 * The marks a ParState row states, or `null` when the row cannot be believed.
 *
 * `null` — NOT a throw — is the contract: a `.wdr` must never be refused because of a broken or
 * missing ParState. The values live in the `Key=` lines; ParState only records WHO authored each
 * one, and real-world files have been seen with a broken row (`s-xlim-123.wdr`). A wrong length
 * or an unreadable mark makes the whole row unusable, and `fromWdrIni` then reads presence ⇒ E,
 * exactly as for a file with no ParState line at all. A file with NO ParState line never reaches
 * here — that is the scraper-authored shape, handled by the caller.
 */
export function parseParState(row: string): readonly CellState[] | null {
  const marks = [...row];
  if (marks.length !== PARSTATE_LEN) return null;
  const parsed = ParStateRowSchema.safeParse(marks);
  return parsed.success ? parsed.data : null;
}
