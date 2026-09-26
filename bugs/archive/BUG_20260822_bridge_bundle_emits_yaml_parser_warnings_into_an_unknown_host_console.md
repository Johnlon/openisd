# The V8-bridge bundle emitted yaml parser warnings into a host console no caller can read

Status: FIXED — `openisdYamlToWdr` parses at `logLevel: 'error'`

## Symptom

`packages/model/src/openisdYamlToWdr.ts` called `parse(yamlText)`, taking the `yaml` package's
default `logLevel: 'warn'`. On any parser warning (duplicate keys, YAML 1.1 quirks) the package
calls `console.warn(...)`. Bundled into `openisd-bridge.js` and run inside py-mini-racer, that
writes into a host runtime the function knows nothing about, and whose output no caller can
observe — the Python side sees nothing on stdout or stderr.

## Evidence

The bridge-bundle property test asserted the built artifact contains no `console.` reference and
failed on the inlined `yaml` code. Measured in real py-mini-racer 0.14.1 by the winisd_tools
session: `typeof console` → `object`, `typeof console.warn` → `function`, `console.warn("probe")`
returns `undefined` and does NOT throw; a warning raised inside a called function returns
normally (`ctx.call("f")` → `'returned-ok'`). mini-racer injects a full console (debug, error,
info, log, warn, dir, table, trace, group, …).

So the effect is unreadable noise, not a failure. An earlier draft of this record claimed a
`ReferenceError` crash in bare V8. That claim was inferred from "bare V8 has no console" — true
of raw V8, false of this EMBEDDER — and measurement disproved it. `winisd_tools/DESIGN.md` §12.5
carried the same wrong assumption in its forbidden-globals row.

## Cause

A boundary function took a library default suited to a browser/node host, in code whose whole
purpose is to run inside an embedded engine.

## Fix

`parse(yamlText, { logLevel: 'error' })`. Diagnostics leave through the returned `errors` array,
which is the only channel that reaches the caller across V8.

NOT `logLevel: 'silent'`: that level also stops the parser THROWING on malformed input. Applied
first and caught immediately by `openisdToWdr.test.ts`'s "reports malformed YAML as an error,
does not throw" — a broken document parsed to a partial record and converted to a hollow `.wdr`
full of empty fields instead of being reported. Warnings off, errors still raised.

A no-op `console` polyfill inside the bundle was rejected: shimming the global would hide any
future `console` reference entering the dependency graph, which is the signal the property test
exists to catch.

## Verification

`npx vitest run packages/winisd/test/openisdToWdr.test.ts` → 16/16, including both malformed-input
cases. `npx tsc -p packages/model --noEmit` clean. The bridge property test's no-`console.`
assertion passes against a rebuilt artifact (rebuild pending the A6 rework going green).

Standing consequence for the property test: it asserts the BUNDLE does not REFERENCE
`console`/`setTimeout` — never that the runtime lacks them, which is false for mini-racer.
