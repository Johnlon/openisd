/**
 * Stored-schema versioning — ARCHITECTURE.md §"EVERY STORED PAYLOAD CARRIES THE SCHEMA VERSION
 * IT WAS SERIALISED FROM" (app dev policy, human 2026-08-17).
 *
 * The properties that make versioning real rather than decorative:
 *   - every payload written states its version, and readers act on it;
 *   - a payload at Vn reaches the current Vm through the m−n steps, in order;
 *   - a version with no route is REFUSED, never loaded hopefully;
 *   - the V0 step repairs SHAPE only, so it cannot invent a value.
 *
 * The version this replaces (`v: 2`) was written for years and never read once — which is why
 * "does anything consume it" is asserted here and not assumed.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA, STEPS, schemaOf, upgrade, stamp } from '../../src/logic/schemaUpgrade.js';

describe('schema versioning — the chain is complete and ordered', () => {
  it('there is a step for every version between 0 and current', () => {
    for (let v = 0; v < CURRENT_SCHEMA; v++) {
      assert.ok(STEPS.some(s => s.from === v),
        `no upgrade step from V${v} to V${v + 1} — a gap makes every older payload unreadable`);
    }
  });

  it('no two steps claim the same source version', () => {
    const froms = STEPS.map(s => s.from);
    assert.deepEqual([...new Set(froms)].sort(), froms.slice().sort(),
      'two steps from one version means the order of application is undefined');
  });

  it('a payload with no version reads as V0, not as current', () => {
    assert.equal(schemaOf({}), 0);
    assert.equal(schemaOf({ v: 2 }), 0,
      '`v` was written and never read, so it describes nothing and must not be mistaken ' +
      'for the schema');
    assert.equal(schemaOf({ schema: 1 }), 1);
  });
});

describe('the V0 repair — shape only, never a value', () => {
  /** The exact payload that took the app down: a driver record with no `specs` container. */
  const v0WithBrokenDriver = () => ({
    v: 2,
    box: 'sealed',
    driver: {
      brand: { value: 'Acme', origin: 'manual', definition: 'd', dq: [] },
      model: { value: 'Widget', origin: 'manual', definition: 'd', dq: [] },
      // specs: ABSENT
    },
  });

  it('restores the missing specs container and stamps the current version', () => {
    const { blob, from, applied } = upgrade(v0WithBrokenDriver());
    assert.equal(from, 0);
    assert.equal(blob.schema, CURRENT_SCHEMA);
    assert.deepEqual((blob.driver as Record<string, unknown>).specs, { woofer: {} });
    assert.equal(applied.length, CURRENT_SCHEMA, 'one line per step applied');
  });

  it('invents no VALUE — the repaired section is empty', () => {
    const { blob } = upgrade(v0WithBrokenDriver());
    const specs = (blob.driver as Record<string, Record<string, object>>).specs;
    assert.deepEqual(Object.keys(specs.woofer), [],
      'an empty section asserts nothing about the driver. A step that filled in Fs or Qts ' +
      'would be fabricating measurements, which is why this repair is safe to apply to a ' +
      'payload whose true origin version is unknowable');
  });

  it('leaves a driver that already has specs untouched', () => {
    const good = { driver: { specs: { woofer: { Fs: { origin: 'manual', readings: {}, dq: [] } } } } };
    const { blob } = upgrade(structuredClone(good));
    assert.deepEqual((blob.driver as Record<string, unknown>).specs, good.driver.specs,
      'a step must change only what its own version got wrong');
  });

  it('carries the rest of the payload through unchanged', () => {
    const { blob } = upgrade(v0WithBrokenDriver());
    assert.equal(blob.box, 'sealed', 'the design survives the repair');
  });
});

describe('a version with no route is refused, not guessed at', () => {
  it('a payload from a NEWER build throws rather than loading', () => {
    assert.throws(() => upgrade({ schema: CURRENT_SCHEMA + 5 }), /newer version/,
      'silently loading a newer shape is how an older build truncates data on its next save');
  });

  it('an already-current payload needs no steps', () => {
    const { applied, from } = upgrade({ schema: CURRENT_SCHEMA, box: 'vented' });
    assert.equal(from, CURRENT_SCHEMA);
    assert.deepEqual(applied, []);
  });
});

describe('writing stamps the version', () => {
  it('stamp() marks a payload with the current schema', () => {
    assert.equal(stamp({ box: 'sealed' }).schema, CURRENT_SCHEMA);
  });

  it('a stamped payload round-trips through upgrade with no steps', () => {
    const { applied } = upgrade(stamp({ box: 'sealed' }));
    assert.deepEqual(applied, [],
      'what this build writes, this build reads without repair — or the version is lying');
  });
});
