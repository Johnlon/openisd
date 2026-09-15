---
paths:
  - "packages/engine/src/**/*"
  - "packages/ui/src/logic/**/*"
  - "packages/ui/src/db/**/*"
  - "packages/ui/src/diagnostics/**/*"
  - "packages/ui/src/logging/**/*"
  - "packages/design/winisd/**/*"
---

# openisd — the `Result` contract for JS error handling

Every function that performs I/O, validation, or a calculation that can partially fail
returns `{ value, errors }` rather than throwing or returning a bare value.

```ts
// errors is always an array — empty means clean, never omit it
{ value: <result or null>, errors: [{ level: 'error' | 'warn', field, message }, ...] }
```

`field` names the specific input field that caused the problem (`'Fs'`, `'Pe'`); use `null`
for errors that do not correspond to a single field. `message` is human-readable text
describing the problem in plain language a user can act on.

## Throwing is an antipattern in production code

- **No production function throws to signal a validation or calculation failure.** This
  includes parsers — a parser handed malformed input returns `{ value: null, errors: [...] }`.
  A throw that escapes a function boundary makes error handling unpredictable and breaks
  composition.
- **Third-party code that throws is wrapped.** Any call to an external library or API that
  may throw (`fetch`, `JSON.parse`, third-party parsers) is wrapped in a try/catch that
  converts the thrown value into a `{ value: null, errors: [...] }` return. The throw never
  reaches the caller.
- **Test infrastructure is the one exception.** `assert.throws`, `throw new Error(...)` in a
  test setup guard, and test-framework machinery are not production code; throw-based failure
  signalling is the framework contract and is correct there.

## Rules

- **Return a `value` even when errors are present**, wherever the data is still partially
  usable. Reserve `value: null` for a truly unrecoverable failure such as a missing required
  field. For chart rendering, degraded data plus warnings beats null plus an error.
- **The caller always checks `errors`** — never silently discard them. A caller that
  intentionally ignores them says so explicitly:
  `const { value } = fn(); // errors intentionally ignored — surfaced upstream`.
- **`level: 'error'`** — the value is unusable for the purpose; the caller must not render or
  use it.
- **`level: 'warn'`** — the value is usable but degraded; the caller surfaces the warning to
  the user.
- **Per-point invalidity** — when a calculation is invalid for a subset of points rather than
  all of them, set those positions to `null` in the value array (the renderer draws gaps) and
  add a `level: 'warn'` entry describing the affected range. A partial failure never becomes
  `value: null`.
- **Compose upward** — low-level functions return `{ value, errors }`; higher-level functions
  unwrap, accumulate errors, and re-wrap, so the chain propagates all the way to the UI.

## Where it applies

`packages/engine/src/driver.ts` (`deriveDriver`, `parseWdr`, `toWdr`), the engine loaders
(`loadDriver`, `extractSpl`, `extractExcursion`, `extractMaxSpl`), and any function that reads
files, calls an external API, or runs a calculation that can produce `NaN`/`Infinity`.

**Pure math functions in `packages/engine/src/` are excluded** and stay plain-return. They take
an already-validated `Driver` and stay clean and fast — `Result` is not threaded through the
per-frequency hot loop. The engine layer validates at the boundary and owns the error contract.

## Test fixtures — the only place a throw is allowed

A test that uses `deriveDriver` or `parseWdr` to build a fixture makes errors explicit and
fails with field-level messages, rather than silently producing `null` and crashing downstream:

```js
const { value: DRV, errors: _drvErrors } = deriveDriver(RAW_DRIVER);
if (!DRV)
  throw new Error(
    'Test fixture invalid: ' +
      _drvErrors
        .filter((e) => e.level === 'error')
        .map((e) => `${e.field}: ${e.message}`)
        .join('; '),
  );
```
