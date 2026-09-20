/**
 * `openISDDeviceJsonSchema` — the `specs` slot is a SUM TYPE, not a bag of three optional
 * sections. A device is ONE of:
 *   - a driver:  `{ woofer: <DriverSpecsSection>, tweeter?: <DriverSpecsSection> }`
 *                 (the tweeter section only on a coaxial; the woofer is what the app simulates)
 *   - a radiator: `{ 'passive-radiator': <PassiveRadiatorSpecsSection> }`
 *
 * A record carrying both, or neither, is refused at the parse — never handed on for a later
 * seam to discover. A radiator has no motor, so its section is the DRIVER's minus every
 * electrical/voice-coil field, and a driver field written into it is refused too.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {openISDDeviceJsonSchema} from '../../domain/openisdSchema.js';

const entry = (v: number) => ({origin: 'entered', readings: {entered: {read_value: v}}});

function record(specs: unknown): unknown {
  return {
    uuid: {value: '00000000-0000-4000-8000-000000000009'},
    quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []},
    manufacturer: {value: 'Dayton'}, brand: {value: 'Dayton'}, model: {value: 'RS225'},
    sku: {value: 'RS225', grounds: [{origin: 'manual', reading: 'RS225'}]},
    driver_type: {value: 'woofer'},
    data_sources: {value: {}},
    authoritative: {value: 'openisd'},
    specs,
  };
}

const problemsOf = (specs: unknown): string[] => {
  const r = openISDDeviceJsonSchema.safeParse(record(specs));
  return r.success ? [] : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
};

describe('openISDDeviceJsonSchema.specs — a driver OR a radiator, never both, never neither', () => {
  it('accepts a driver: a woofer section alone', () => {
    assert.deepEqual(problemsOf({woofer: {Fs_hz: entry(30)}}), []);
  });

  it('accepts a coaxial driver: a woofer section with a tweeter section beside it', () => {
    assert.deepEqual(problemsOf({woofer: {Fs_hz: entry(30)}, tweeter: {Fs_hz: entry(900)}}), []);
  });

  it('accepts a radiator: a passive-radiator section alone', () => {
    assert.deepEqual(problemsOf({'passive-radiator': {Fs_hz: entry(20), Sd_m2: entry(0.02)}}), []);
  });

  it('refuses a record with NO section — an empty specs object is neither a driver nor a radiator', () => {
    const problems = problemsOf({});
    assert.ok(problems.length > 0, 'an empty specs object parsed');
    assert.ok(problems.some(p => p.startsWith('specs') && p.includes('woofer') && p.includes('passive-radiator')),
      `the refusal names the two shapes a specs slot may take: ${problems.join(' | ')}`);
  });

  it('refuses a tweeter section on its own — a tweeter is not a driver the app simulates', () => {
    assert.ok(problemsOf({tweeter: {Fs_hz: entry(900)}}).length > 0);
  });

  it('refuses a record that is TWO THINGS AT ONCE — a woofer and a passive-radiator section', () => {
    const problems = problemsOf({woofer: {Sd_m2: entry(0.0137)}, 'passive-radiator': {Sd_m2: entry(0.0137)}});
    assert.ok(problems.length > 0, 'a record with both sections parsed');
    assert.ok(problems.some(p => p.startsWith('specs')), `the refusal is on 'specs': ${problems.join(' | ')}`);
  });

  it('refuses a radiator section carrying a motor field — a radiator has no voice coil', () => {
    for (const electrical of ['Re_ohm', 'Le_H', 'BL_Tm', 'Qes', 'numVC', 'Znom_ohm']) {
      const problems = problemsOf({'passive-radiator': {Fs_hz: entry(20), [electrical]: entry(1)}});
      assert.ok(problems.length > 0, `${electrical} accepted in a passive-radiator section`);
    }
  });

  it('a bad reading inside a section is named by its own path — the sum does not swallow member findings', () => {
    const problems = problemsOf({woofer: {Fs_hz: {origin: 'datasheet', readings: {datasheet: {read_value: 'thirty'}}}}});
    assert.ok(problems.some(p => p.startsWith('specs.woofer.Fs_hz.readings.datasheet.read_value')),
      `the member's issue path was lost: ${problems.join(' | ')}`);
  });

  it('a parsed driver record narrows to its woofer section by the `in` operator, a radiator by its own key', () => {
    const driver = openISDDeviceJsonSchema.parse(record({woofer: {Fs_hz: entry(30)}}));
    const radiator = openISDDeviceJsonSchema.parse(record({'passive-radiator': {Fs_hz: entry(20)}}));
    assert.ok('woofer' in driver.specs);
    assert.ok(!('woofer' in radiator.specs));
    assert.ok('passive-radiator' in radiator.specs);
    if ('woofer' in driver.specs) {
      assert.equal(driver.specs.woofer.Fs_hz?.value, 30);
    }
  });
});
