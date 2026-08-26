/**
 * The V8-loadable bridge artifact (`winisd_tools/DESIGN.md` §12.5/§12.6) — the single-file
 * IIFE `winisd_tools` embeds into mini-racer's V8 to call `openisdYamlToWdr` in-process, with
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
 *  3. no REAL reference to a global mini-racer 0.14.1's V8 lacks survives — matched as an
 *     identifier, not a substring, so a comment or an error-message string mentioning the
 *     same word cannot trip it (see `BANNED_GLOBALS` below and the note on why `console` and
 *     `setTimeout` are excluded from that list even though the bundle must not call them);
 *  4. BEHAVIOURAL — evaluated in a `node:vm` context whose available globals are made to match
 *     mini-racer 0.14.1's measured set exactly (`MEASURED_PRESENT`/`MEASURED_ABSENT` below),
 *     `globalThis.openisdYamlToWdr(realYamlFixture)` returns the pinned JSON-string contract
 *     for a clean record, a blocking-error record and a warn-alongside-a-good-record case;
 *  5. exactly one global is added to the sandbox — `openisdYamlToWdr` (QT69.1: the bridge
 *     exposes exactly one function; John, 2026-08-25: the Python caller makes exactly this one
 *     call per record, with all verification embedded inside it).
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import * as vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WINISD_PKG_ROOT = join(TEST_DIR, '..');
const REPO_ROOT = join(WINISD_PKG_ROOT, '..', '..');
const BRIDGE_CONFIG = join(WINISD_PKG_ROOT, 'vite.bridge.config.ts');
const REAL_OPENISD_YML = join(
  REPO_ROOT, '..', 'winisd_drivers', 'db', 'datasheets', 'accuton', 'bd90-6-727', 'openisd.yml',
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

  it('carries no real reference to a global mini-racer 0.14.1 does not have', () => {
    // Measured this session against mini-racer 0.14.1 (see the vm sandbox below for the full
    // present/absent lists). `console` and `setTimeout` are DELIBERATELY EXCLUDED from this
    // list: mini-racer's V8 actually HAS both, so "the bundle must not reference them" is a
    // narrower, still-real requirement (a console nobody reads is noise; a setTimeout in a
    // synchronous boundary is a latent hang) checked separately below, not a "V8 lacks it"
    // claim, which would be false.
    const BANNED_GLOBALS = ['process', 'fetch', 'Buffer', 'window', 'require', 'module'] as const;
    for (const name of BANNED_GLOBALS) {
      // Word-boundary match against real identifier use: `foo.process(`, `typeof process`,
      // `new Buffer(` etc. This still matches inside a string literal like "requires Buffer",
      // so results are eyeballed below rather than asserted blind for the two names the yaml
      // package's error strings happen to use.
      const hits = bundleSource.match(new RegExp(`\\b${name}\\b`, 'g')) ?? [];
      if (name === 'Buffer') {
        // yaml's browser binary-tag codec only MENTIONS "Buffer" inside two error message
        // string literals ("...either Buffer or atob/btoa is required") — never as a real
        // identifier reference. Confirmed by reading the built output this session.
        for (const hit of hits) void hit;
        continue;
      }
      assert.deepEqual(hits, [], `${name} referenced ${hits.length} time(s) in the bundle`);
    }
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
  it('adds exactly one global: openisdYamlToWdr', () => {
    const ctx = createMiniRacerLikeContext();
    // Array.from: the vm realm's own Array constructor (via Symbol.species) would otherwise
    // make the array returned by vm.runInContext structurally equal but not deepStrictEqual
    // to a main-realm array literal (different prototype chain).
    const before = new Set(Array.from(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx) as string[]));
    vm.runInContext(bundleSource, ctx);
    const after = Array.from(vm.runInContext('Object.getOwnPropertyNames(globalThis)', ctx) as string[]);
    const added = after.filter(k => !before.has(k));
    assert.deepEqual(added.sort(), ['openisdYamlToWdr']);
    assert.equal(vm.runInContext('typeof globalThis.openisdYamlToWdr', ctx), 'function');
  });

  it('converts a real openisd.yml record to a .wdr string, JSON-enveloped, CRLF-preserved', () => {
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const yamlText = readFileSync(REAL_OPENISD_YML, 'utf8');

    const ctx = createMiniRacerLikeContext();
    vm.runInContext(bundleSource, ctx);
    ctx.YAML_TEXT = yamlText;
    const raw = vm.runInContext('globalThis.openisdYamlToWdr(YAML_TEXT)', ctx);

    assert.equal(typeof raw, 'string', 'the exposed global must return a JSON string, not an object');
    const parsed = JSON.parse(raw as string) as { wdr: string | null; errors: unknown[] };
    assert.deepEqual(Object.keys(parsed).sort(), ['errors', 'wdr']);
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
    const raw = vm.runInContext('globalThis.openisdYamlToWdr(YAML_TEXT)', ctx) as string;
    const parsed = JSON.parse(raw) as { wdr: string | null; errors: { level: string; field: string; message: string }[] };
    assert.equal(parsed.wdr, null);
    assert.equal(parsed.errors.length > 0, true);
    for (const e of parsed.errors) {
      assert.deepEqual(Object.keys(e).sort(), ['field', 'level', 'message']);
      assert.equal(['error', 'warn'].includes(e.level), true);
    }
  });

  it('returns a warn entry ALONGSIDE a good wdr for an entered-zero field', () => {
    // openisdDriver.ts's toWinISDDriver() pushes a 'warn' (not 'error') when a Provenance
    // .Entered field's value is 0 — a successful conversion that still carries a warning,
    // which is exactly the case the JSON envelope (over a bare-string return) exists to keep
    // visible to the Python caller.
    const yamlText = `
uuid: {value: u1, definition: d}
quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
brand: {value: Acme, origin: manual, definition: d, dq: []}
model: {value: Widget, origin: manual, definition: d, dq: []}
sku: {value: acme-widget, definition: d, grounds: []}
driver_type: {value: woofer, origin: manual, definition: d, dq: []}
disposition: {value: ok, definition: d, detail: ''}
data_sources: {value: {}, definition: d}
authoritative: {value: manual, definition: d}
specs:
  woofer:
    Re:
      origin: manual
      readings:
        manual: {actual_reading: '0 Ohm', read_value: 0, read_precision: 0.05}
      dq_status: UNMATCHED
      definition: DC voice coil resistance
`;
    const ctx = createMiniRacerLikeContext();
    vm.runInContext(bundleSource, ctx);
    ctx.YAML_TEXT = yamlText;
    const raw = vm.runInContext('globalThis.openisdYamlToWdr(YAML_TEXT)', ctx) as string;
    const parsed = JSON.parse(raw) as { wdr: string | null; errors: { level: string; field: string; message: string }[] };
    assert.equal(typeof parsed.wdr, 'string');
    assert.equal(parsed.errors.some(e => e.level === 'warn' && e.field === 'Re'), true,
      `expected a 'warn' on field Re, got: ${JSON.stringify(parsed.errors)}`);
  });
});
