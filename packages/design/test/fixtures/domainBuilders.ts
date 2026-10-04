import {type DqIssue, createEngine} from '@openisd/design/engine';
import {type AppContext, OpenISDDriver, ProjectBuilder} from '../../domain/index.js';

export function fixedAppContext(id: string, isoDate = '2026-01-01T00:00:00.000Z', platformUser: string | null = null): AppContext {
  return { newId: () => id, now: () => new Date(isoDate), platformUser: () => platformUser };
}

// This test is the package's PROXY CONSUMER: it imports from `index.js` only, exactly what the
// real app can reach, and nothing internal. Anything it cannot do here, the app cannot do
// either — so a gap in the public surface shows up as a test that cannot be written, rather
// than as a test quietly reaching past the boundary to compensate.
//
// The record shapes are private, so these helpers build plain literals and rely on structural
// compatibility. That the test cannot name those types is the design working.
//
// Structural boilerplate only: every DOMAIN-MEANINGFUL number a test depends on is passed in by
// that test, so an `it()` block reads top to bottom without opening anything else.
export const scraped = <T,>(value: T) => ({ value });

/** Narrows an `unknown` value to a plain object — the runtime check a `JSON.parse(...)` result
 *  needs before any property on it can be read. This file reads `.owpr`/`.owdr` JSON only
 *  through this and `at()` below, never through a cast: the record shapes are private (see the
 *  note on `wooferOf` above), so a test proxy-consumer walks the parsed JSON the way any outside
 *  caller must, with runtime checks, not by asserting a shape it isn't allowed to name. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Walks a parsed `.owpr`/`.owdr` JSON value one property/index step at a time, checking each
 *  step's shape as it goes. `at(JSON.parse(text), 'saved', 'box', 'vented', 'vent', 'count')`
 *  reads the same path a hand-typed chain would, without ever trusting `JSON.parse`'s `any`. */
export function at(v: unknown, ...path: (string | number)[]): unknown {
  let cur = v;
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(cur)) throw new Error(`expected an array at [${key}], got ${typeof cur}`);
      cur = cur[key];
    } else {
      if (!isRecord(cur)) throw new Error(`expected an object at .${key}, got ${typeof cur}`);
      cur = cur[key];
    }
  }
  return cur;
}

/** One engine for the fixtures below — issue construction goes through the engine's door. */
export const fixtureEngine = createEngine();

/** A distinct, hand-constructible `DqIssue` for fixtures — a target-unreachable issue is the
 *  simplest closed-union member to write out by hand. */
export function ignoredIssue(target: string): DqIssue {
  return fixtureEngine.issues.targetUnreachable(target, 0);
}

/** A cloned record's woofer section, read the way any consumer must: `specs` is a SUM — a
 *  driver's sections or a radiator's — so the woofer is reachable only behind the `in` check.
 *  The record type is derived from the public method, never named. */
export function wooferOf(record: ReturnType<OpenISDDriver['cloneDriver']>) {
  const specs = record.specs;
  return 'woofer' in specs ? specs.woofer : undefined;
}

// A SPEC field carries `state`+`value` (T11), with `origin`/`readings` riding beside it as
// provenance. Building fixtures through this is what makes them the shape a real record has.
export const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'scraped', readings: { scraped: { read_value } } });

export function specSection(p: {
  Fs_hz: number; Qts: number; Sd_m2: number; Cms_m_per_N: number;
  Mmd_kg: number; Rms_Ns_per_m: number; Xmax_m: number;
}) {
  // A test names the parameter with its unit, the way the public API does; the RECORD's keys are
  // the suffixed ones the schema's `DriverSpecsSection` states, which is what this literal
  // has to produce.
  return {
    Fs_hz: spec(p.Fs_hz), Qts: spec(p.Qts), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Rms_kg_per_s: spec(p.Rms_Ns_per_m), Xmax_m: spec(p.Xmax_m),
  };
}

/** A spec section that states Fs/Sd/Cms/Mms/Xmax, `Qts` only when given, and NEVER `Rms` — the
 *  only mechanical route to Qms (and therefore Qes) `resolve()` has — so this nulls out Qms/Qes
 *  regardless of whether Qts itself is stated, unlike `specSection` which always states Rms. */
export function specSectionNoRms(p: {
  Fs_hz: number; Sd_m2: number; Cms_m_per_N: number; Mmd_kg: number; Xmax_m: number; Qts?: number;
}) {
  return {
    Fs_hz: spec(p.Fs_hz), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Xmax_m: spec(p.Xmax_m),
    ...(p.Qts !== undefined ? { Qts: spec(p.Qts) } : {}),
  };
}

/** A driver the Tune panel might have produced: Thiele/Small values only, NO `Sd`/`Cms`/`Mms`/
 *  `Rms`/`Xmax`, and no stored `Qts` — the pair `Qes`+`Qms` implies it. This is the golden
 *  scene's shape (`original-box-tab.browser.spec.ts`), and a shape the old compliance
 *  feed could not answer at all: `Cms·Sd²·ρc²` needs the fields this record deliberately lacks. */
export function tuneSpec(p: {Fs_hz: number; Vas_m3: number; Qes: number; Qms: number; Re_ohm: number}) {
  return {
    Fs_hz: spec(p.Fs_hz), Vas_m3: spec(p.Vas_m3),
    Qes: spec(p.Qes), Qms: spec(p.Qms), Re_ohm: spec(p.Re_ohm),
  };
}

/** A RADIATOR's spec section. Not a narrowed driver's: a radiator has no motor and no voice coil,
 *  so `Qts` describes nothing on one — there is no `Qes` for it to combine with. The strict schema
 *  refuses a `Qts` here, which is how this builder came to exist. */
export function prSpecSection(p: {
  Fs_hz: number; Sd_m2: number; Cms_m_per_N: number;
  Mmd_kg: number; Rms_Ns_per_m: number; Xmax_m: number;
}) {
  return {
    Fs_hz: spec(p.Fs_hz), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Rms_kg_per_s: spec(p.Rms_Ns_per_m), Xmax_m: spec(p.Xmax_m),
  };
}

/** The client's own boundary step: an untrusted record becomes a driver, or the reasons it
 *  cannot. Tests that expect a VALID record use this; the one that checks refusal calls
 *  `driverFromConformingRecord` directly and inspects the problems. */
// Takes whatever `driverJson` below takes.
export function driverFrom(p: Parameters<typeof driverJson>[0]) {
  const result = OpenISDDriver.fromConformingRecord(driverJson(p), createEngine());
  if (Array.isArray(result)) throw new Error(`fixture is not a valid driver: ${result.join(', ')}`);
  return result;
}

export function driverJson(p: {
  brand: string; model: string; section: 'woofer' | 'passive-radiator';
  // A driver's own section (`specSection`) or a radiator's (`prSpecSection`, no `Qts`) —
  // whichever matches `section` above.
  spec: ReturnType<typeof specSection> | ReturnType<typeof prSpecSection> | ReturnType<typeof tuneSpec>
    | ReturnType<typeof specSectionNoRms>;
}) {
  const meta = {
    brand: scraped(p.brand), model: scraped(p.model), manufacturer: scraped(p.brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    // The scrape provenance every openisd.yml record carries (`model_openisd.py:55-73`). A
    // fixture without them is not a record, and the conformance guard says so.
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    // `sku` is a DERIVED field: no origin, but `grounds` carrying the evidence it was
    // derived from, at least one entry.
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
  };
  if (p.section === 'woofer') return { ...meta, specs: { woofer: p.spec } };
  return { ...meta, specs: { 'passive-radiator': p.spec } };
}

/** A sealed 30 L project on a plain RS225 woofer with Re unstated — the starting point for the
 *  project-settings and signal scenarios. */
export function sealedProject() {
  return new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), createEngine()).sealed().volume_m3(0.03).build();
}
