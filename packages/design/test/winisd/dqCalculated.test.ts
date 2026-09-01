/**
 * Part B of `drivers/drivers.md`: the `dq_calculated` marks the bridge computes and attaches.
 *
 * EVERY EXPECTED `detail` STRING IN THIS FILE WAS PRODUCED BY THE PYTHON REGISTRY ITSELF —
 * `scrapers/lib/record_registries.py`'s `mark()` over the same params — not written by hand.
 * That is the whole point of these tests: `DqMark._guard_against_invention` re-renders the
 * registered template on load and REFUSES any mark whose `detail` differs by a single character,
 * so a record we emit with a hand-typed string is a record `winisd_tools` can never read back.
 * The Unicode must match byte for byte — ρ, ·, ², √, π, and an EM DASH before the percentage —
 * because the record model compares `detail` against the template's own rendering.
 */
import { describe, it, expect } from 'vitest';

import { stringify } from 'yaml';

import { calcMark, dqCalculated, rangeMark, withDqCalculated } from '../../winisd/dqCalculated.js';

describe('range marks', () => {
  it('renders range-below-min exactly as the Python registry renders it', () => {
    expect(rangeMark('Fs', 0.5)).toEqual({
      kind: 'range', severity: 'error', rule: 'range-below-min',
      params: { field: 'Fs', value: 0.5, limit: 1, unit: '' },
      detail: 'Fs=0.5 below min 1',
    });
  });

  it('renders range-above-max exactly as the Python registry renders it', () => {
    expect(rangeMark('Re', 1234567)).toEqual({
      kind: 'range', severity: 'error', rule: 'range-above-max',
      params: { field: 'Re', value: 1234567, limit: 64, unit: '' },
      detail: 'Re=1.23457e+06 above max 64',
    });
  });

  it("formats a sub-1e-4 value in Python's `g` scientific form, e-07 not e-7", () => {
    expect(rangeMark('Vas', 3e-7)).toEqual({
      kind: 'range', severity: 'error', rule: 'range-below-min',
      params: { field: 'Vas', value: 3e-7, limit: 1e-6, unit: '' },
      detail: 'Vas=3e-07 below min 1e-06',
    });
  });

  it('reports a float-noise overshoot with both numbers collapsed to six significant digits', () => {
    expect(rangeMark('Sd', 0.30000000000000004)).toEqual({
      kind: 'range', severity: 'error', rule: 'range-above-max',
      params: { field: 'Sd', value: 0.30000000000000004, limit: 0.3, unit: '' },
      detail: 'Sd=0.3 above max 0.3',
    });
  });

  it('marks nothing for a value inside its bounds', () => {
    expect(rangeMark('Fs', 35)).toBeUndefined();
  });

  it('marks nothing for a field the limits table asserts no bound for', () => {
    expect(rangeMark('Vcd', 1e9)).toBeUndefined();
  });

  it('skips zero, as `semantic_dq.py` does — a zero is an absent reading, not an out-of-range one', () => {
    // Fs's floor is 1.0, so an un-skipped zero would mark; Le's floor is 0.0, which a zero meets.
    expect(rangeMark('Fs', 0)).toBeUndefined();
  });
});

describe('calc marks', () => {
  it('renders a Vas disagreement through the dedicated vas-consistency rule', () => {
    expect(calcMark({
      formula: 'Vas = ρ₀·c²·Sd²·Cms', fields: ['Vas_m3', 'Cms_m_per_N', 'Sd_m2'],
      target: 'Vas_m3', expected: 51.2, actual: 48, relative: 0.0666,
    })).toEqual({
      target: 'Vas',
      members: ['Vas', 'Cms', 'Sd'],
      mark: {
        kind: 'calc', severity: 'error', rule: 'vas-consistency',
        params: { computed: 51.2, stored: 48, off_pct: 6.3 },
        detail: 'Vas from ρ·c²·Sd²·Cms = 51.2 vs stored 48 — 6.3% apart',
      },
    });
  });

  it('renders a Qts disagreement through the dedicated qts-consistency rule', () => {
    expect(calcMark({
      formula: 'Qts = Qes·Qms/(Qes+Qms)', fields: ['Qts', 'Qes', 'Qms'],
      target: 'Qts', expected: 0.3899999, actual: 0.41, relative: 0.05,
    })).toEqual({
      target: 'Qts',
      members: ['Qts', 'Qes', 'Qms'],
      mark: {
        kind: 'calc', severity: 'error', rule: 'qts-consistency',
        params: { computed: 0.3899999, stored: 0.41, off_pct: 5.1 },
        detail: 'Qts from Qes·Qms/(Qes+Qms) = 0.39 vs stored 0.41 — 5.1% apart',
      },
    });
  });

  it('renders every other relation through calc-consistency, naming the formula\'s right-hand side', () => {
    expect(calcMark({
      formula: 'Rms = 2π·Fs·Mms/Qms', fields: ['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms'],
      target: 'Rms_kg_per_s', expected: 1234567, actual: 999999.5, relative: 0.23,
    })).toEqual({
      target: 'Rms',
      members: ['Rms', 'Fs', 'Mms', 'Qms'],
      mark: {
        kind: 'calc', severity: 'error', rule: 'calc-consistency',
        params: { field: 'Rms', formula: '2π·Fs·Mms/Qms', computed: 1234567, stored: 999999.5, off_pct: 19 },
        detail: 'Rms from 2π·Fs·Mms/Qms = 1.235e+06 vs stored 1e+06 — 19% apart',
      },
    });
  });

  it("breaks a rounding tie TO EVEN, as CPython does and as no JavaScript formatter does", () => {
    // Every number here lands exactly on a half: 1.8125 and 2.0625 at four significant digits,
    // and 13.75% at one decimal. `toExponential`/`toFixed` would round all three UP, giving
    // `1.813`, `2.063` and `13.8`, and a record carrying those is refused on load.
    expect(calcMark({
      formula: 'Dd = 2·√(Sd/π)', fields: ['Dd_m', 'Sd_m2'],
      target: 'Dd_m', expected: 1.8125, actual: 2.0625, relative: 0.138,
    }).mark).toEqual({
      kind: 'calc', severity: 'error', rule: 'calc-consistency',
      params: { field: 'Dd', formula: '2·√(Sd/π)', computed: 1.8125, stored: 2.0625, off_pct: 13.8 },
      detail: 'Dd from 2·√(Sd/π) = 1.812 vs stored 2.062 — 13.8% apart',
    });
  });

  it('rounds a half-tenth percentage to even in both directions', () => {
    expect(calcMark({
      formula: 'Dd = 2·√(Sd/π)', fields: ['Dd_m', 'Sd_m2'],
      target: 'Dd_m', expected: 100, actual: 100.25, relative: 0.0025,
    }).mark.detail).toBe('Dd from 2·√(Sd/π) = 100 vs stored 100.2 — 0.2% apart');

    expect(calcMark({
      formula: 'Dd = 2·√(Sd/π)', fields: ['Dd_m', 'Sd_m2'],
      target: 'Dd_m', expected: 100, actual: 100.75, relative: 0.0075,
    }).mark.detail).toBe('Dd from 2·√(Sd/π) = 100 vs stored 100.8 — 0.8% apart');
  });

  it('rounds a percentage whose decimal only LOOKS like a tie by the true value of the double', () => {
    // 1115.55 is really 1115.5499…, so it rounds DOWN. Scaling by ten first turns it into an
    // exact 11155.5 and rounds it up to 1115.6 — the reason the percentage is not scaled.
    expect(calcMark({
      formula: 'Dd = 2·√(Sd/π)', fields: ['Dd_m', 'Sd_m2'],
      target: 'Dd_m', expected: 100, actual: 1215.55, relative: 11.1555,
    }).mark.detail).toBe('Dd from 2·√(Sd/π) = 100 vs stored 1216 — 1115.5% apart');
  });

  it('drops a group member that no record key corresponds to', () => {
    // `Re_terminal_ohm` is derived from Re, numVC and wiring; no record stores it, so there is
    // no spec entry for a mark to land on.
    expect(calcMark({
      formula: 'Rme = Bl²/Re', fields: ['Rme_kg_per_s', 'BL_Tm', 'Re_terminal_ohm'],
      target: 'Rme_kg_per_s', expected: 12.5, actual: 10, relative: 0.25,
    }).members).toEqual(['Rme', 'BL']);
  });
});

describe('collecting a device\'s marks', () => {
  it('puts one consistency mark on every member of the group it names', () => {
    const collected = dqCalculated([], [{
      formula: 'Qts = Qes·Qms/(Qes+Qms)', fields: ['Qts', 'Qes', 'Qms'],
      target: 'Qts', expected: 0.3899999, actual: 0.41, relative: 0.05,
    }]);

    const expected = {
      kind: 'calc', severity: 'error', rule: 'qts-consistency',
      params: { computed: 0.3899999, stored: 0.41, off_pct: 5.1 },
      detail: 'Qts from Qes·Qms/(Qes+Qms) = 0.39 vs stored 0.41 — 5.1% apart',
    };
    expect([...collected]).toEqual([
      ['Qts', [expected]], ['Qes', [expected]], ['Qms', [expected]],
    ]);
  });

  it('lists a field\'s range mark before its consistency mark', () => {
    const collected = dqCalculated([['Qts', 7.5]], [{
      formula: 'Qts = Qes·Qms/(Qes+Qms)', fields: ['Qts'],
      target: 'Qts', expected: 0.3899999, actual: 0.41, relative: 0.05,
    }]);

    expect(collected.get('Qts')).toEqual([
      { kind: 'range', severity: 'error', rule: 'range-above-max',
        params: { field: 'Qts', value: 7.5, limit: 5, unit: '' },
        detail: 'Qts=7.5 above max 5' },
      { kind: 'calc', severity: 'error', rule: 'qts-consistency',
        params: { computed: 0.3899999, stored: 0.41, off_pct: 5.1 },
        detail: 'Qts from Qes·Qms/(Qes+Qms) = 0.39 vs stored 0.41 — 5.1% apart' },
    ]);
  });

  it('gives each member its own mark object, so the YAML writer emits no alias', () => {
    // A `yaml` writer emits `&a1`/`*a1` for any object it reaches twice, and an entry whose whole
    // content is `*a1` states no finding a reader can see without going to look elsewhere.
    const collected = dqCalculated([], [{
      formula: 'Qts = Qes·Qms/(Qes+Qms)', fields: ['Qts', 'Qes', 'Qms'],
      target: 'Qts', expected: 0.3899999, actual: 0.41, relative: 0.05,
    }]);

    const text = stringify(withDqCalculated({
      specs: { woofer: {
        Qts: { origin: 'ds', readings: { ds: { read_value: 0.41 } } },
        Qes: { origin: 'ds', readings: { ds: { read_value: 0.44 } } },
        Qms: { origin: 'ds', readings: { ds: { read_value: 3.4 } } },
      } },
    }, 'woofer', collected));

    expect(text).not.toContain('&');
    expect(text).not.toContain('*');
    expect(text.match(/rule: qts-consistency/g)).toHaveLength(3);
    expect(text.match(/detail: Qts from Qes·Qms\/\(Qes\+Qms\)/g)).toHaveLength(3);
  });

  it('finds nothing for a device whose stated values agree and sit in range', () => {
    expect([...dqCalculated([['Fs', 35], ['Re', 6.2], ['Qts', 0.38]], [])]).toEqual([]);
  });
});

describe('attaching marks to a record', () => {
  it('puts each field\'s marks on that field\'s spec entry', () => {
    const record = {
      uuid: 'u1',
      specs: { woofer: {
        Fs: { origin: 'ds', readings: { ds: { read_value: 0.5 } } },
        Re: { origin: 'ds', readings: { ds: { read_value: 6.2 } } },
      } },
    };
    const marked = withDqCalculated(record, 'woofer', new Map([
      ['Fs', [{ kind: 'range' as const, severity: 'error' as const, rule: 'range-below-min',
               params: { field: 'Fs', value: 0.5, limit: 1, unit: '' },
               detail: 'Fs=0.5 below min 1' }]],
    ]));

    expect(marked).toEqual({
      uuid: 'u1',
      specs: { woofer: {
        Fs: { origin: 'ds', readings: { ds: { read_value: 0.5 } },
              dq_calculated: [{ kind: 'range', severity: 'error', rule: 'range-below-min',
                                params: { field: 'Fs', value: 0.5, limit: 1, unit: '' },
                                detail: 'Fs=0.5 below min 1' }] },
        Re: { origin: 'ds', readings: { ds: { read_value: 6.2 } } },
      } },
    });
  });

  it('leaves the record it was given completely untouched', () => {
    const record = {
      specs: { woofer: { Fs: { origin: 'ds', readings: { ds: { read_value: 0.5 } } } } },
    };
    withDqCalculated(record, 'woofer', new Map([
      ['Fs', [{ kind: 'range' as const, severity: 'error' as const, rule: 'range-below-min',
               params: { field: 'Fs', value: 0.5, limit: 1, unit: '' },
               detail: 'Fs=0.5 below min 1' }]],
    ]));

    expect(record).toEqual({
      specs: { woofer: { Fs: { origin: 'ds', readings: { ds: { read_value: 0.5 } } } } },
    });
  });

  it('adds no key at all when nothing was found — absent, never an empty list', () => {
    const record = {
      specs: { woofer: { Fs: { origin: 'ds', readings: { ds: { read_value: 35 } } } } },
    };
    expect(withDqCalculated(record, 'woofer', new Map())).toEqual({
      specs: { woofer: { Fs: { origin: 'ds', readings: { ds: { read_value: 35 } } } } },
    });
  });
});
