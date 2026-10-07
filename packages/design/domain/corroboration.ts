/**
 * D11 — the cross-source verdict on one field's readings, ported verbatim from
 * `winisd_tools/scrapers/scrapers/lib/model_driver.py`'s `readings_agree`/`unlike_conditions`/
 * `verdict_for`. This is the ONE place the comparison lives on the app side, matching the ONE
 * place it lives on the scraper side, so a stored verdict can never come to disagree with its
 * own readings.
 *
 * REJECTED readings take no part: a refused read is not a side, so it can neither match nor fail
 * to. Fewer than two usable readings is UNMATCHED — no match occurred. Any unlike-conditioned
 * pair makes the whole field NOT_MATCHABLE, because those numbers describe different physical
 * quantities. Otherwise MATCH requires EVERY pair to reconcile.
 */

import {Reader} from './reader.js';
import type {ReaderValue} from './reader.js';

/** One source's reading, as far as corroboration cares — the numeric side of the record's own
 *  `readingJsonSchema` shape (`openisdSchema.ts`), not a second definition of it. */
export interface Reading {
    readonly read_value: number;
    readonly read_precision?: number;
    readonly rejected?: string;
    readonly note?: string;
}

const _corroborationValues = ['MATCH', 'MISMATCH', 'NOT_MATCHABLE', 'UNMATCHED'] as const;
export type CorroborationValue = typeof _corroborationValues[number];

/** The closed set of corroboration verdicts, matching `Corroboration.ALL`'s wire values. */
export class Corroboration {
    private constructor(readonly value: CorroborationValue) {}

    static readonly Match = new Corroboration('MATCH');
    static readonly Mismatch = new Corroboration('MISMATCH');
    static readonly NotMatchable = new Corroboration('NOT_MATCHABLE');
    static readonly Unmatched = new Corroboration('UNMATCHED');

    static readonly ALL: readonly Corroboration[] = [
        Corroboration.Match,
        Corroboration.Mismatch,
        Corroboration.NotMatchable,
        Corroboration.Unmatched,
    ];

    /** Parse a wire value to a member. There is no default: a verdict is always COMPUTED by
     *  `corroborate`, never read off untrusted wire data, so an unrecognised value is a real bug
     *  in the caller rather than something to paper over. */
    static parse(value: CorroborationValue): Corroboration {
        // Exhaustive by construction: `CorroborationValue` names exactly `Corroboration.ALL`'s
        // wire values, so `find` cannot miss.
        return Corroboration.ALL.find(m => m.value === value)!;
    }

    toString(): string {
        return this.value;
    }
}

// Genuine measurement variation between two independently-measured copies of the same driver —
// the allowance that remains AFTER each source's own printed rounding has been accounted for.
const AGREE_REL_TOL = 0.01;

/** Do two sources' readings of one field agree? Each source's OWN printed precision, not a flat
 *  tolerance: `|a-b| < precision(a) + precision(b) + 0.01·max(|a|,|b|)`. A reading with no stated
 *  `read_precision` is treated as exact (precision 0) — no rounding information to extend it. */
function readingsAgree(a: Reading, b: Reading): boolean {
    const budget = (a.read_precision ?? 0) + (b.read_precision ?? 0)
        + AGREE_REL_TOL * Math.max(Math.abs(a.read_value), Math.abs(b.read_value));
    return Math.abs(a.read_value - b.read_value) < budget;
}

/** Do these two readings state UNLIKE measurement conditions? Two STATED conditions that differ
 *  are always unlike. Silence is not a competing claim: a silent side is unlike ONLY when the
 *  numbers also fail to line up (`unlike_conditions`, `model_driver.py`). */
function unlikeConditions(a: Reading, b: Reading): boolean {
    if ((a.note ?? null) === (b.note ?? null)) return false;
    if (a.note !== undefined && b.note !== undefined) return true;
    return !readingsAgree(a, b);
}

/** THE verdict derivation for one field, from its readings alone (`verdict_for`,
 *  `model_driver.py`). `readings` is keyed by source role — the same shape `SpecEntryJson`'s
 *  `readings` carries — but the key names play no part in the verdict itself. */
export function corroborate(readings: Readonly<Record<string, Reading>>): Corroboration {
    const usable = Object.values(readings).filter(r => r.rejected === undefined);
    if (usable.length < 2) return Corroboration.Unmatched;
    for (let i = 0; i < usable.length; i++) {
        for (let j = i + 1; j < usable.length; j++) {
            if (unlikeConditions(usable[i], usable[j])) return Corroboration.NotMatchable;
        }
    }
    for (let i = 0; i < usable.length; i++) {
        for (let j = i + 1; j < usable.length; j++) {
            if (!readingsAgree(usable[i], usable[j])) return Corroboration.Mismatch;
        }
    }
    return Corroboration.Match;
}


/** One reader's read of a datasheet cell, as the record's `reads` stores it. */
export interface ReaderRead {
    readonly actual_reading: string;
    readonly read_value: number | null;
    readonly read_precision: number | null;
}

/** The readers that read one cell, keyed by wire value; a reader that found no cell has no key. */
export type ReaderReads = Partial<Record<ReaderValue, ReaderRead>>;

const _readerAgreementValues = ['AGREE', 'DISAGREE', 'SINGLE'] as const;
export type ReaderAgreementValue = typeof _readerAgreementValues[number];

/** The closed set of reader-agreement verdicts. Derived from `reads` on every use; never stored. */
export class ReaderAgreement {
    private constructor(readonly value: ReaderAgreementValue) {}

    /** Every pair of readers that gave a number agrees. */
    static readonly Agree = new ReaderAgreement('AGREE');
    /** Some pair of readers gave numbers that do not agree: a DQ issue. */
    static readonly Disagree = new ReaderAgreement('DISAGREE');
    /** Fewer than two readers gave a number: nothing to compare. */
    static readonly Single = new ReaderAgreement('SINGLE');

    toString(): string {
        return this.value;
    }
}

export interface ReaderVerdict {
    readonly agreement: ReaderAgreement;
    /** Every reader that gave a number is an OCR reader: the value has no text-layer read behind it. */
    readonly unverified: boolean;
    /** The readers that gave a number, in `Reader.ALL` order. */
    readonly numbered: readonly ReaderValue[];
    /** The first pair that disagree, in `Reader.ALL` order; null unless the agreement is Disagree. */
    readonly disagreeing: readonly [ReaderValue, ReaderValue] | null;
}

/** Reader agreement for one datasheet cell, from its `reads`. A read with no number is not a side.
 *  Two reads agree by `readingsAgree`, the one formula; there is no second copy of it. */
export function readerVerdict(reads: ReaderReads): ReaderVerdict {
    const numbered: {readonly reader: Reader; readonly reading: Reading}[] = [];
    for (const reader of Reader.ALL) {
        const read = reads[reader.value];
        if (read === undefined || read.read_value === null) continue;
        numbered.push({reader, reading: {read_value: read.read_value, read_precision: read.read_precision ?? undefined}});
    }
    const unverified = numbered.length > 0 && numbered.every(n => n.reader.isOcr);
    const readers = numbered.map(n => n.reader.value);
    for (let i = 0; i < numbered.length; i++) {
        for (let j = i + 1; j < numbered.length; j++) {
            if (!readingsAgree(numbered[i].reading, numbered[j].reading)) {
                return {agreement: ReaderAgreement.Disagree, unverified, numbered: readers, disagreeing: [numbered[i].reader.value, numbered[j].reader.value]};
            }
        }
    }
    const agreement = numbered.length < 2 ? ReaderAgreement.Single : ReaderAgreement.Agree;
    return {agreement, unverified, numbered: readers, disagreeing: null};
}
