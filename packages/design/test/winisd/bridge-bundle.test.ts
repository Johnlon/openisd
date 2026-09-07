/**
 * The V8-loadable bridge artifact (`winisd_tools/DESIGN.md` §12.5/§12.6) — the single-file
 * IIFE `winisd_tools` embeds into mini-racer's V8 to call `driverYmlToOpenisdAndWdr` in-process, with
 * no filesystem, no module loader and no Node/browser globals.
 *
 * This test BUILDS the bundle itself (via `vite build --config
 * packages/winisd/vite.bridge.config.ts`, the same config `npm run build:bridge` uses) into
 * `build/bridge-test/` — the repo's gitignored scratch space (`.gitignore:5`) — rather than
 * reading a pre-built `dist/` artifact, so the test is self-contained and always checks the
 * bundle the current source tree actually produces.
 *
 * Contract asserted here, mechanically, not by grepping prose:
 *  1. the artifact exists and is a single file;
 *  2. no `import `/`require(`/dynamic `import(` survives in the output;
 *  3. the RUNNING bundle never reads a global mini-racer 0.14.1's V8 lacks — each one is
 *     installed as an accessor that throws, and the bundle is then driven end to end, so a name
 *     that merely appears in the text (a bundled library's own local `process`, an error string
 *     naming `Buffer`) cannot trip it and needs no exception (`console` and `setTimeout` are NOT
 *     in that set — mini-racer has both; that the bundle must not CALL them is checked below);
 *  4. BEHAVIOURAL — evaluated in a `node:vm` context whose available globals are made to match
 *     mini-racer 0.14.1's measured set exactly (`MEASURED_PRESENT`/`MEASURED_ABSENT` below),
 *     `globalThis.driverYmlToOpenisdAndWdr(realYamlFixture)` returns the pinned JSON-string contract
 *     for a clean record, a blocking-error record and a warn-alongside-a-good-record case;
 *  5. exactly one FUNCTION is added to the sandbox — `driverYmlToOpenisdAndWdr` (QT69.1: the
 *     bridge exposes exactly one function; John, 2026-08-25: the Python caller makes exactly this
 *     one call per record, with all verification embedded inside it) — alongside the two names
 *     zod keeps on globalThis, which are named in the assertion so nothing else can slip in.
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import * as vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

// This file lives at packages/design/test/winisd/, so the package root is two levels up and the
// repo root is four.
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const DESIGN_PKG_ROOT = join(TEST_DIR, '..', '..');
const REPO_ROOT = join(DESIGN_PKG_ROOT, '..', '..');
const BRIDGE_CONFIG = join(DESIGN_PKG_ROOT, 'vite.bridge.config.ts');
const REAL_OPENISD_YML = join(
  REPO_ROOT, '..', 'winisd_drivers', 'db', 'datasheets', 'accuton', 'bd90-6-727', 'driver.yml',
);

let outDir: string;
let bundlePath: string;
let bundleSource: string;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'openisd-bridge-test-'));
  execFileSync(
    'npx',
    ['vite', 'build', '--config', BRIDGE_CONFIG, '--outDir', outDir],
    { cwd: REPO_ROOT, stdio: 'pipe' },
  );
  bundlePath = join(outDir, 'openisd-bridge.js');
  bundleSource = readFileSync(bundlePath, 'utf8');
}, 60_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('openisd-bridge.js — artifact shape', () => {
  it('exists and is a single file', () => {
    assert.equal(existsSync(bundlePath), true);
    // Only the one JS file plus vite's own manifest-free lib output — no chunks, no assets.
    const files = readdirSync(outDir);
    assert.deepEqual(files, ['openisd-bridge.js']);
  });

  it('carries no import/require/dynamic-import in the output', () => {
    // Real statements only, not the word appearing in a comment or a string.
    assert.equal(/^\s*import\s/m.test(bundleSource), false, 'import statement present');
    assert.equal(/\brequire\s*\(/.test(bundleSource), false, 'require( call present');
    assert.equal(/\bimport\s*\(/.test(bundleSource), false, 'dynamic import( present');
  });

  it('tree-shakes TextEncoder/TextDecoder out entirely (they are absent from mini-racer)', () => {
    // packages/winisd/src/winisdBytes.ts uses both, but only on the .wdr BYTE boundary (file
    // read/write), which the yaml -> record -> toWdrText() call path this bridge exposes
    // never reaches — winisdDriver.ts only imports the WINISD_NEWLINE_SENTINEL *constant* from
    // that module. If a future change makes either survive bundling, that is a real change
    // to what the bridge touches and must be reported, not silently polyfilled.
    assert.equal(/\bTextEncoder\b/.test(bundleSource), false);
    assert.equal(/\bTextDecoder\b/.test(bundleSource), false);
  });

  it('never READS a global mini-racer 0.14.1 does not have — proven by trapping each one', () => {
    // Asked of the RUNNING bundle, not of its text. A source scan cannot tell a free reference to
    // the global `process` from a bundled library's own local function called `process` — zod
    // ships exactly that, and a bare-word match reported 21 hits with nothing wrong (QO111). So
    // each absent global is installed as an accessor that THROWS when read, and the bundle is
    // then loaded and driven end to end: any real reference detonates, and no exception list is
    // needed for a name that merely appears in the text.
    const ABSENT_IN_MINI_RACER = ['process', 'fetch', 'Buffer', 'window', 'require', 'module'] as const;

    const ctx = createMiniRacerLikeContext();
    ctx.__trapped = [] as string[];
    vm.runInContext(`
      for (const name of ${JSON.stringify(ABSENT_IN_MINI_RACER)}) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          get() { __trapped.push(name); throw new Error('the bundle read globalThis.' + name); },
        });
      }
    `, ctx);

    vm.runInContext(bundleSource, ctx);
    ctx.YAML_TEXT = ': : : not yaml : :';
    vm.runInContext('globalThis.driverYmlToOpenisdAndWdr(YAML_TEXT)', ctx);

    assert.deepEqual(ctx.__trapped, [], `the bundle read: ${(ctx.__trapped as string[]).join(', ')}`);
  });

  it('does not declare or call console/setTimeout as real code (comments/docstrings excepted)', () => {
    // The bundle's own inlined dependencies must not call these at runtime. Matched against
    // real call syntax, not the bare word, so this file's own docstring (which names both) or
    // a comment inside an inlined dep cannot trip it.
    assert.equal(/\bconsole\s*\./.test(bundleSource), false,
      'console.<method>( call present — see bugs/BUG_20260822_bridge_bundle_inlines_a_yaml_parse_console_warn_that_throws_in_bare_v8.md');
    assert.equal(/\bsetTimeout\s*\(/.test(bundleSource), false, 'setTimeout( call present');
  });
});

// Measured against mini-racer 0.14.1 this session (`ctx.eval('Object.getOwnPropertyNames(this)')`
// on a fresh MiniRacer()). Update this pair together if the pinned mini-racer version changes.
const MEASURED_PRESENT_GLOBALS = ['console', 'setTimeout', 'JSON', 'Math', 'Promise', 'Symbol', 'BigInt', 'Intl'] as const;
const MEASURED_ABSENT_GLOBALS = [
  'process', 'require', 'module', 'exports', 'fetch', 'Buffer', 'window', 'document',
  'setInterval', 'structuredClone', 'URL', 'crypto', 'queueMicrotask', 'atob', 'btoa',
  'TextEncoder', 'TextDecoder',
] as const;

/** A bare V8 context shaped to mini-racer 0.14.1's measured global set — not Node's default
 *  `vm` globals, which lack `setTimeout` (mini-racer has it) and could otherwise pass a check
 *  that real V8 would fail, or fail one real V8 would pass. */
function createMiniRacerLikeContext(): vm.Context {
  const seed: Record<string, unknown> = {};
  for (const name of MEASURED_PRESENT_GLOBALS) seed[name] = (globalThis as Record<string, unknown>)[name];
  const ctx = vm.createContext(seed);
  const present = vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx) as string[];
  for (const absent of MEASURED_ABSENT_GLOBALS) {
    assert.equal(present.includes(absent), false, `vm sandbox unexpectedly has '${absent}' — Node's vm context diverged from mini-racer's measured absence`);
  }
  return ctx;
}

describe('openisd-bridge.js — behavioural (node:vm, mini-racer-shaped sandbox)', () => {
  it('adds exactly one FUNCTION, plus the realm state zod keeps on globalThis', () => {
    const ctx = createMiniRacerLikeContext();
    // Array.from: the vm realm's own Array constructor (via Symbol.species) would otherwise
    // make the array returned by vm.runInContext structurally equal but not deepStrictEqual
    // to a main-realm array literal (different prototype chain).
    const before = new Set(Array.from(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx) as string[]));
    vm.runInContext(bundleSource, ctx);
    const after = Array.from(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx) as string[]);
    const added = after.filter(k => !before.has(k));

    // THE PROPERTY THIS STATES IS WEAKER THAN "NOTHING BUT THE ENTRY POINT", and deliberately so:
    // the conformance seam validates with zod, which keeps its config and its schema registry on
    // globalThis, so the bundle installs those two names as well (QO110 — John, 2026-09-01, asked
    // whether the leak is accepted: "yes absolutely"). They are inert to the Python caller, which
    // reads only the function. Naming them EXPLICITLY is what keeps the gate worth having: one
    // more global, from zod or from anything else, still fails here.
    assert.deepEqual(added.sort(), ['__zod_globalConfig', '__zod_globalRegistry', 'driverYmlToOpenisdAndWdr']);
    assert.equal(vm.runInContext('typeof globalThis.driverYmlToOpenisdAndWdr', ctx), 'function');
    assert.equal(vm.runInContext('typeof globalThis.__zod_globalRegistry', ctx), 'object');
  });

  it('converts a real driver.yml record to openisd.yml + .wdr, JSON-enveloped, CRLF-preserved', () => {
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const yamlText = readFileSync(REAL_OPENISD_YML, 'utf8');

    const ctx = createMiniRacerLikeContext();
    vm.runInContext(bundleSource, ctx);
    ctx.YAML_TEXT = yamlText;
    const raw = vm.runInContext('globalThis.driverYmlToOpenisdAndWdr(YAML_TEXT)', ctx);

    assert.equal(typeof raw, 'string', 'the exposed global must return a JSON string, not an object');
    const parsed = JSON.parse(raw as string) as { openisd: string | null; wdr: string | null; errors: unknown[] };
    assert.deepEqual(Object.keys(parsed).sort(), ['errors', 'openisd', 'wdr']);
    assert.equal(Array.isArray(parsed.errors), true);
    assert.equal(typeof parsed.wdr, 'string');

    const wdr = parsed.wdr as string;
    // Looks like a .wdr/INI: the [Driver] header and at least one real WinISD key.
    assert.equal(wdr.startsWith('[Driver]\r\n'), true);
    assert.equal(/^Fs=/m.test(wdr), true);
    // CRLF preserved byte-for-byte across the V8 boundary — a bare LF anywhere would silently
    // corrupt every regenerated .wdr in the library (Windows INI format).
    assert.equal(wdr.includes('\r\n'), true);
    assert.equal(/[^\r]\n/.test(wdr), false, 'a bare LF (no preceding CR) survived the boundary');
  });

  it('returns wdr:null with a non-empty errors array for a blocking parse failure', () => {
    const ctx = createMiniRacerLikeContext();
    vm.runInContext(bundleSource, ctx);
    ctx.YAML_TEXT = ': : : not yaml : :';
    const raw = vm.runInContext('globalThis.driverYmlToOpenisdAndWdr(YAML_TEXT)', ctx) as string;
    const parsed = JSON.parse(raw) as { wdr: string | null; errors: { level: string; field: string; message: string }[] };
    assert.equal(parsed.wdr, null);
    assert.equal(parsed.errors.length > 0, true);
    for (const e of parsed.errors) {
      assert.deepEqual(Object.keys(e).sort(), ['field', 'level', 'message']);
      assert.equal(['error', 'warn'].includes(e.level), true);
    }
  });

  it('returns a warn entry ALONGSIDE a good wdr for an entered-zero field', () => {
    // openisdDriver.ts's toWinISDDriver() pushes a 'warn' (not 'error') when an
    // entered field's value is 0 — a successful conversion that still carries a warning,
    // which is exactly the case the JSON envelope (over a bare-string return) exists to keep
    // visible to the Python caller.
    const yamlText = `
uuid: {value: 00000000-0000-4000-8000-000000000000}
quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
manufacturer: {value: Acme, origin: manufacturer_datasheet, definition: d}
brand: {value: Acme, origin: manufacturer_datasheet, definition: d}
model: {value: Widget, origin: manufacturer_datasheet, definition: d}
sku: {value: acme-widget, grounds: [{origin: manufacturer_datasheet, reading: acme-widget}]}
driver_type: {value: woofer, origin: manufacturer_datasheet, definition: d}
data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}}
authoritative: {value: manufacturer_datasheet}
provided_by: {value: '', origin: manufacturer_datasheet}
comment: {value: '', origin: manufacturer_datasheet}
added: {value: '2026-09-01', origin: manufacturer_datasheet}
specs:
  woofer:
    Re:
      origin: manufacturer_datasheet
      definition: DC voice coil resistance
      readings:
        manufacturer_datasheet: {actual_reading: '0 Ohm', read_value: 0, read_precision: 0.05}
`;
    const ctx = createMiniRacerLikeContext();
    vm.runInContext(bundleSource, ctx);
    ctx.YAML_TEXT = yamlText;
    const raw = vm.runInContext('globalThis.driverYmlToOpenisdAndWdr(YAML_TEXT)', ctx) as string;
    const parsed = JSON.parse(raw) as { wdr: string | null; errors: { level: string; field: string; message: string }[] };
    assert.equal(typeof parsed.wdr, 'string');
    assert.equal(parsed.errors.some(e => e.level === 'warn' && e.field === 'Re'), true,
      `expected a 'warn' on field Re, got: ${JSON.stringify(parsed.errors)}`);
  });
});
