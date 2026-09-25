import {describe, expect, it} from 'vitest';
import {Corroboration, corroborate} from '../../domain/corroboration.js';
import type {Reading} from '../../domain/corroboration.js';

const reading = (read_value: number, extra: Partial<Reading> = {}): Reading => ({read_value, ...extra});

describe('corroborate (D11) — the cross-source verdict on one field\'s readings', () => {
  it('MATCH — 1.01 g vs 0.995 g, one mass stated to two printed precisions', () => {
    // Each source's own printed rounding (half the last stated decimal place), not a flat
    // tolerance — peerless/pmt-40n25al17-04 (`test_crosscheck_precision.py`).
    const verdict = corroborate({
      a: reading(1.01, {read_precision: 0.005}),
      b: reading(0.995, {read_precision: 0.0005}),
    });
    expect(verdict).toBe(Corroboration.Match);
  });

  it('MISMATCH — 0.03 mH vs 0.3 mH, a decimal shift', () => {
    const verdict = corroborate({a: reading(0.00003), b: reading(0.0003)});
    expect(verdict).toBe(Corroboration.Mismatch);
  });

  it('NOT_MATCHABLE — unlike SPL conditions (both sides state a reference, and it differs)', () => {
    const verdict = corroborate({
      a: reading(88, {note: '1W/1m'}),
      b: reading(89, {note: '2.83V/1m'}),
    });
    expect(verdict).toBe(Corroboration.NotMatchable);
  });

  it('NOT_MATCHABLE — one side silent on the condition, and the numbers disagree', () => {
    const verdict = corroborate({
      a: reading(98, {note: '2.83V/1m'}),
      b: reading(91),
    });
    expect(verdict).toBe(Corroboration.NotMatchable);
  });

  it('MATCH — bare 98 dB vs 98 dB (2.83V/1m): same note counts as not unlike, and the numbers agree', () => {
    const verdict = corroborate({
      a: reading(98),
      b: reading(98, {note: '2.83V/1m'}),
    });
    expect(verdict).toBe(Corroboration.Match);
  });

  it('UNMATCHED — fewer than two usable readings', () => {
    expect(corroborate({a: reading(1.0)})).toBe(Corroboration.Unmatched);
    expect(corroborate({})).toBe(Corroboration.Unmatched);
  });

  it('UNMATCHED — a rejected reading does not count toward usable readings', () => {
    const verdict = corroborate({
      a: reading(1.0),
      b: reading(5.0, {rejected: 'ohm-glyph-merged-as-digit'}),
    });
    expect(verdict).toBe(Corroboration.Unmatched);
  });

  it('MISMATCH — any disagreeing pair among three or more usable readings sinks the whole verdict', () => {
    const verdict = corroborate({
      a: reading(1.0), b: reading(1.005), c: reading(2.0),
    });
    expect(verdict).toBe(Corroboration.Mismatch);
  });
});

describe('Corroboration — the enum class itself', () => {
  it('parses its own wire values back to the same members', () => {
    for (const member of Corroboration.ALL) {
      expect(Corroboration.parse(member.value)).toBe(member);
    }
  });
});
