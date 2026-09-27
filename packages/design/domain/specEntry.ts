/**
 * Spec-entry helpers: building an entered/calculated `SpecEntryJson`, reading its winning value,
 * the dq-mark schema every entry carries, and the read-time calculated defaults for a slot that
 * is shaped like a spec entry but is not one (a port count, a coil count). Split out of
 * `openisdSchema.ts` (that file declares data shapes only) — this is logic: how a value becomes
 * an entry, how an entry's value is read back, and what a caller reads when the slot is absent.
 */
import {z} from 'zod';
import type {SpecEntryJson} from './openisdSchema.js';

/** DQ marks. A function, not a shared object: a module-scoped literal would be state, and each
 *  schema gets its own. Exported so `driverYmlToOpenisdAndWdr.ts`'s `scraperEntrySchema` (D9/D11)
 *  can validate `dq_scraper` against the SAME shape this record stores, rather than a
 *  hand-duplicated copy free to drift. */
export const dqMarks = () => z.strictObject({
    kind: z.string(), severity: z.string(), rule: z.string(), detail: z.string(),
    params: z.record(z.string(), z.unknown()),
}).array().optional();

/** One data-quality mark. `kind` says who found it and how: `calc` and `range` are computed,
 *  `corroboration` is the scraper's cross-source verdict. Shape follows the corpus. */
export interface DqMark {
    readonly kind: string;
    readonly severity: string;
    readonly rule: string;
    readonly params: Readonly<Record<string, unknown>>;
    readonly detail: string;
}

/** A hand-entered value as a `SpecEntryJson` (T11 — no provenance for a value nothing was read
 *  from: no `origin`, no `readings`, just the number and the 'E' flag). */
export function enteredEntry(value: number): SpecEntryJson {
    return {state: 'E', value};
}

/** A solver-derived value as a `SpecEntryJson` (T11 — the 'C' flag; no `origin`/`readings`,
 *  nothing was read). */
export function calculatedEntry(value: number): SpecEntryJson {
    return {state: 'C', value};
}

/** The ONE legal way to read a spec entry's number: `.value` (T11 — one value, one flag; there
 *  is no second channel to fall back to). Null when the entry itself is absent ('N'). */
export function winningValue(entry: SpecEntryJson | undefined): number | null {
    return entry?.value ?? null;
}

/** WinISD's own default when a vented box states no port count (`[VentRear] Num`) — one port.
 *  Read-time fallback in the same style as `calcNumVC()` (`voiceCoilWiring.ts`): a record without
 *  a count, or with one that is not a whole number of at least one, READS as this calculated
 *  value. */
export function calcVentCount(): number {
    return 1;
}
