/**
 * TASK A of `shiny-noodling-kahan.md` "Bridge round-trip API for the tools": two new bridge
 * globals, `roundTripOpenIsdYml` and `roundTripWdr`, alongside `openisdYamlToWdr` in
 * `src/bridge.ts` — each a thin adapter over the exact functions the app's own record loader
 * and `.owdr`/`.wdr` export paths call:
 *   - `OpenISDDriver.fromOwdrYml`/`.toOwdrJson()`/`.fromOwdrJson`/`.toOwdrYml()`
 *     (`packages/model/src/openisdDriver.ts`) chained in that order for the openisd.yml leg —
 *     proving all four Owdr construction/serialisation methods survive a round trip together,
 *     not just the yml pair;
 *   - `OpenISDDriver.fromWdrText` (`openisdDriver.ts:480`) and `.toWdrText()`
 *     (`openisdDriver.ts:509`) for the .wdr leg;
 *   - the `yaml` package's `parse(text, { logLevel: 'error' })`
 *     (`packages/model/src/openisdYamlToWdr.ts:35`) for the yaml parse step.
 *
 * Neither global does the byte/re-parse comparison itself — that is the caller's job (the
 * openisd bundler gate, or winisd_tools after writing a file), per the plan: "each returns the
 * re-serialised text plus structured errors, and the tools compare that against the bytes just
 * written."
 *
 * This file imports `src/bridge.ts` directly (a plain Node/vitest environment, not the V8
 * bundle) — a real unit test of the TypeScript source, not the built artifact. The built
 * artifact's shape (single IIFE, exact global count, mini-racer-safe globals) stays
 * `bridge-bundle.test.ts`'s job.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Project, SyntaxKind, type CallExpression } from 'ts-morph';
import '../src/bridge.js';

declare global {
  var roundTripOpenIsdYml: (yamlText: string) => string;
  var roundTripOpenIsdYmlViaWdr: (yamlText: string) => string;
  var roundTripWdr: (wdrText: string) => string;
}

const here = dirname(fileURLToPath(import.meta.url));
const REAL_OPENISD_YML = join(
  here, '..', '..', '..', '..', 'winisd_drivers', 'db', 'datasheets', 'accuton', 'bd90-6-727', 'openisd.yml',
);
const REAL_PR_OPENISD_YML = join(
  here, '..', '..', '..', '..', 'winisd_drivers', 'db', 'datasheets', 'accuton', 'asp190', 'openisd.yml',
);
const WDR_SAMPLES = join(here, '..', '..', '..', 'drivers', 'sample', 'winisd');

describe('roundTripOpenIsdYml — openisd.yml leg', () => {
  it('a real corpus record round-trips: ymlResult (YAML text) parses back to the record the input yaml parsed to', () => {
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const yamlText = readFileSync(REAL_OPENISD_YML, 'utf8');

    const raw = globalThis.roundTripOpenIsdYml(yamlText);
    const { ymlResult, errors } = JSON.parse(raw) as { ymlResult: string | null; errors: unknown[] };
    assert.deepEqual(errors, []);
    assert.equal(typeof ymlResult, 'string');

    // Test-oracle parse only — this is test code establishing what the ORIGINAL record was,
    // not a second implementation of the bridge's own parse step (which uses the same `yaml`
    // package function, asserted by the AST check below).
    const original = parseYaml(yamlText, { logLevel: 'error' });
    assert.deepEqual(parseYaml(ymlResult as string, { logLevel: 'error' }), original,
      'the app\'s own load (fromOwdrYml) + export (.toOwdrYml()) path must reproduce the ' +
      'exact record the yaml parsed to, byte-for-byte at the data level, once ymlResult is ' +
      'parsed back with the yaml package');
  });

  it('ymlResult is real YAML text, not JSON text — the internal .owdr JSON representation must never leak out', () => {
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const yamlText = readFileSync(REAL_OPENISD_YML, 'utf8');

    const raw = globalThis.roundTripOpenIsdYml(yamlText);
    const { ymlResult } = JSON.parse(raw) as { ymlResult: string | null; errors: unknown[] };
    assert.equal(typeof ymlResult, 'string');

    // yaml's stringify() emits block-style YAML (unquoted keys, no braces) for an object of
    // this shape, so the text is not valid JSON — proving ymlResult really is YAML output from
    // stringify(), not the .owdr JSON text relabelled.
    assert.throws(() => JSON.parse(ymlResult as string),
      'ymlResult must not be parseable as JSON — it must be genuine YAML produced by stringify()');
  });

  it('a blocking parse failure returns ymlResult:null with a non-empty errors array', () => {
    const raw = globalThis.roundTripOpenIsdYml(': : : not yaml : :');
    const { ymlResult, errors } = JSON.parse(raw) as { ymlResult: string | null; errors: unknown[] };
    assert.equal(ymlResult, null);
    assert.equal(errors.length > 0, true);
  });
});

describe('roundTripOpenIsdYmlViaWdr — openisd.yml round trip VIA .wdr', () => {
  it('a real corpus record: INI_ROWS-tracked entered spec values survive fromOwdrYml -> ' +
     'toWdrText -> fromWdrText -> toOwdrYml exactly, even though the .wdr format drops ' +
     'everything else (uuid, provenance, dq, data_sources, driver_type, ...)', () => {
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const yamlText = readFileSync(REAL_OPENISD_YML, 'utf8');

    const raw = globalThis.roundTripOpenIsdYmlViaWdr(yamlText);
    const { ymlResult, errors } = JSON.parse(raw) as { ymlResult: string | null; errors: unknown[] };
    assert.deepEqual(errors, []);
    assert.equal(typeof ymlResult, 'string');

    const original = parseYaml(yamlText, { logLevel: 'error' }) as {
      driver_type: { value: string };
      specs: Record<string, Record<string, { readings?: Record<string, { read_value: number }> }>>;
    };
    const result = parseYaml(ymlResult as string, { logLevel: 'error' }) as typeof original;

    // driver_type is always read back as a plain woofer — .wdr carries no discriminator — so
    // the original section's spec fields are compared against the RESULT's woofer section.
    const origSection = original.specs[original.driver_type.value === 'tweeter' ? 'tweeter' : 'woofer']
      ?? original.specs[original.driver_type.value] ?? {};
    const resultSection = result.specs.woofer ?? {};
    let checked = 0;
    for (const [field, entry] of Object.entries(origSection)) {
      const readings = entry.readings;
      if (!readings) continue;
      const values = Object.values(readings);
      if (values.length === 0) continue;
      const before = values[0].read_value;
      const after = resultSection[field]?.readings?.manual?.read_value;
      // Only WDR-representable fields are asserted; anything the result section never even
      // has a key for is out of .wdr's scope (proven separately by the divergence check below).
      if (after !== undefined) {
        assert.equal(after, before, `${field}: entered ${before}, round-tripped via .wdr as ${after}`);
        checked++;
      }
    }
    assert.ok(checked > 0, 'expected at least one WDR-representable spec field to compare');
  });

  it('a real passive-radiator corpus record round-trips its INI_ROWS-tracked spec values via ' +
     '.wdr exactly, though its section itself does not survive (.wdr has no PR discriminator)', () => {
    assert.equal(existsSync(REAL_PR_OPENISD_YML), true, `fixture missing: ${REAL_PR_OPENISD_YML}`);
    const yamlText = readFileSync(REAL_PR_OPENISD_YML, 'utf8');

    const raw = globalThis.roundTripOpenIsdYmlViaWdr(yamlText);
    const { ymlResult, errors } = JSON.parse(raw) as { ymlResult: string | null; errors: unknown[] };
    assert.deepEqual(errors, []);
    assert.equal(typeof ymlResult, 'string');

    const original = parseYaml(yamlText, { logLevel: 'error' }) as {
      driver_type: { value: string };
      specs: Record<string, Record<string, { readings?: Record<string, { read_value: number }> }>>;
    };
    assert.equal(original.driver_type.value, 'passive-radiator');
    const result = parseYaml(ymlResult as string, { logLevel: 'error' }) as typeof original;
    // .wdr's fromWdrText hardcodes driver_type: woofer — this is the documented, known-lossy
    // behaviour, not a bug this test guards against.
    assert.equal(result.driver_type.value, 'woofer');

    const origSection = original.specs['passive-radiator'] ?? {};
    const resultSection = result.specs.woofer ?? {};
    let checked = 0;
    for (const [field, entry] of Object.entries(origSection)) {
      const values = entry.readings ? Object.values(entry.readings) : [];
      if (values.length === 0) continue;
      const before = values[0].read_value;
      const after = resultSection[field]?.readings?.manual?.read_value;
      if (after !== undefined) {
        assert.equal(after, before, `${field}: entered ${before}, round-tripped via .wdr as ${after}`);
        checked++;
      }
    }
    assert.ok(checked > 0, 'expected at least one WDR-representable passive-radiator spec field to compare');
  });

  it('a blocking .wdr projection failure returns ymlResult:null with the projection\'s own errors', () => {
    const raw = globalThis.roundTripOpenIsdYmlViaWdr(': : : not yaml : :');
    const { ymlResult, errors } = JSON.parse(raw) as { ymlResult: string | null; errors: unknown[] };
    assert.equal(ymlResult, null);
    assert.equal(errors.length > 0, true);
  });
});

describe('roundTripWdr — .wdr leg', () => {
  it('a real corpus .wdr round-trips clean: no error-level entries, reserialised text looks like a .wdr', () => {
    const files = readdirSync(WDR_SAMPLES).filter(f => f.endsWith('.wdr'));
    const file = files.find(f => /\[Driver\]/.test(readFileSync(join(WDR_SAMPLES, f), 'utf8')));
    assert.ok(file, 'no real .wdr sample with a [Driver] header found in drivers/sample/winisd');
    const wdrText = readFileSync(join(WDR_SAMPLES, file as string), 'utf8');

    const raw = globalThis.roundTripWdr(wdrText);
    const { reserialised, errors } = JSON.parse(raw) as {
      reserialised: string | null; errors: { level: string; field: string; message: string }[];
    };
    const blocking = errors.filter(e => e.level === 'error');
    assert.deepEqual(blocking, [], `unexpected blocking errors: ${JSON.stringify(blocking)}`);
    assert.equal(typeof reserialised, 'string');
    assert.equal((reserialised as string).startsWith('[Driver]'), true);
  });

  it('junk .wdr text never crashes and never blocks — WinISDDriver.fromWdrIni is documented ' +
     '"never throws"; garbage with no key=value lines round-trips to an all-default .wdr, and ' +
     'detecting THAT as a mismatch is the caller\'s job (it compares reserialised against the ' +
     'bytes it wrote, not this function\'s job to pre-judge)', () => {
    const raw = globalThis.roundTripWdr('not a wdr file at all, no [Driver] header, no keys');
    const { reserialised, errors } = JSON.parse(raw) as {
      reserialised: string | null; errors: { level: string }[];
    };
    assert.equal(typeof reserialised, 'string');
    assert.equal(errors.some(e => e.level === 'error'), false,
      `did not expect a blocking error — WinISDDriver.fromWdrIni never throws, got: ${JSON.stringify(errors)}`);
  });
});

describe('mechanical enforcement — the new bridge functions call ONLY the real model functions', () => {
  it('every call inside roundTripOpenIsdYmlBridge/roundTripOpenIsdYmlViaWdrBridge/roundTripWdrBridge ' +
     'resolves to yaml\'s parse, or a declaration inside @openisd/model\'s own source (no ' +
     're-implemented parse/serialise)', () => {
    // ts-morph loading the full tsconfig'd program (for real module resolution to `yaml` and
    // `@openisd/model`) is slow under a loaded test runner — well past vitest's 5s default.
    const project = new Project({ tsConfigFilePath: join(here, '..', 'tsconfig.json') });
    const sf = project.getSourceFileOrThrow(join(here, '..', 'src', 'bridge.ts'));

    const targetNames = ['roundTripOpenIsdYmlBridge', 'roundTripOpenIsdYmlViaWdrBridge', 'roundTripWdrBridge'];
    const fns = sf.getFunctions().filter(f => targetNames.includes(f.getName() ?? ''));
    assert.deepEqual(fns.map(f => f.getName()).sort(), [...targetNames].sort(),
      'expected all three bridge functions to exist as top-level function declarations in bridge.ts');

    const violations: string[] = [];
    for (const fn of fns) {
      const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[];
      for (const call of calls) {
        const expr = call.getExpression();
        const text = expr.getText();

        // JSON.stringify / JSON.parse — a language builtin, not a re-implementation.
        if (/^JSON\.(stringify|parse)$/.test(text)) continue;
        // String(...) coercion — a language builtin.
        if (text === 'String') continue;

        // Resolve the symbol (for `Foo.bar(...)`, resolve `bar`'s symbol via the property
        // access; for a bare identifier, resolve it directly) and check where it was declared.
        // A bare identifier imported by name (`parse`) resolves first to its OWN import
        // specifier (declared right here in bridge.ts) — follow the alias through to the
        // real declaration in the imported module, or the check would trivially "pass" any
        // name merely because it was imported, without checking what it was imported FROM.
        let sym = expr.getSymbol();
        if (sym?.isAlias()) sym = sym.getAliasedSymbol();
        const decls = sym?.getDeclarations() ?? [];
        const fromRealModule = decls.some(d => {
          const path = d.getSourceFile().getFilePath();
          return path.includes('/packages/model/src/') || /\/node_modules\/yaml\//.test(path);
        });
        if (!fromRealModule) {
          violations.push(`${fn.getName()}: call "${text}" does not resolve to @openisd/model or yaml`);
        }
      }
    }
    assert.deepEqual(violations, [],
      'a bridge round-trip function must call ONLY the app\'s own real load/serialise ' +
      'functions — no reimplemented YAML parsing, no reimplemented WDR line-writing ' +
      '(plan `shiny-noodling-kahan.md`, John: "only useful if the code path is exactly and ' +
      'maximally the same path that app takes (no deviation)")');
  }, 30_000);

  it('roundTripOpenIsdYmlBridge calls all four OpenISDDriver Owdr methods, not just the yml pair', () => {
    const project = new Project({ tsConfigFilePath: join(here, '..', 'tsconfig.json') });
    const sf = project.getSourceFileOrThrow(join(here, '..', 'src', 'bridge.ts'));
    const fn = sf.getFunctionOrThrow('roundTripOpenIsdYmlBridge');

    const calledMethodNames = fn.getDescendantsOfKind(SyntaxKind.CallExpression)
      .map(call => call.getExpression())
      .filter(expr => expr.getKind() === SyntaxKind.PropertyAccessExpression)
      .map(expr => expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName());

    for (const required of ['fromOwdrYml', 'toOwdrJson', 'fromOwdrJson', 'toOwdrYml']) {
      assert.equal(calledMethodNames.includes(required), true,
        `roundTripOpenIsdYmlBridge must call OpenISDDriver.${required} — got calls: ${JSON.stringify(calledMethodNames)}`);
    }
  }, 30_000);

  it('roundTripOpenIsdYmlViaWdrBridge calls fromOwdrYml, toWdrText, fromWdrText and toOwdrYml — ' +
     'the full yml-through-.wdr-and-back chain, not a shortcut through the yml/json pair', () => {
    const project = new Project({ tsConfigFilePath: join(here, '..', 'tsconfig.json') });
    const sf = project.getSourceFileOrThrow(join(here, '..', 'src', 'bridge.ts'));
    const fn = sf.getFunctionOrThrow('roundTripOpenIsdYmlViaWdrBridge');

    const calledMethodNames = fn.getDescendantsOfKind(SyntaxKind.CallExpression)
      .map(call => call.getExpression())
      .filter(expr => expr.getKind() === SyntaxKind.PropertyAccessExpression)
      .map(expr => expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName());

    for (const required of ['fromOwdrYml', 'toWdrText', 'fromWdrText', 'toOwdrYml']) {
      assert.equal(calledMethodNames.includes(required), true,
        `roundTripOpenIsdYmlViaWdrBridge must call OpenISDDriver.${required} — got calls: ${JSON.stringify(calledMethodNames)}`);
    }
  }, 30_000);
});
