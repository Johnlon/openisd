# JS error handling — Go-inspired pattern

All functions that perform I/O, validation, or calculations that can partially fail **must** return `{ value, errors }` rather than throwing or returning bare values.

**Throws are an antipattern in production code.** No production function may throw to signal a validation or calculation failure. This includes parsers — even a parser that receives malformed input must return `{ value: null, errors: [...] }` rather than throwing. Throws that escape a function boundary make error handling unpredictable and break composition.

**Third-party code that throws must be wrapped.** Any call to an external library or API that may throw (e.g. `fetch`, `JSON.parse`, third-party parsers) must be wrapped in a try/catch that converts the thrown value to a `{ value: null, errors: [...] }` return. The throw must never escape to the caller.

**Exception — test infrastructure only.** `assert.throws`, `throw new Error(...)` inside test setup guards, and test framework machinery are not production code. Throw-based test failure signalling is the framework contract and is correct there.

## Shape

```js
// errors is always an array — empty means clean, never omit it
{ value: <result or null>, errors: [{ level: 'error'|'warn', field, message }, ...] }
```

`field` is a string naming the specific input field that caused the problem (e.g. `'Fs'`, `'Pe'`). Use `null` for errors that don't correspond to a single field. `message` must be human-readable text that describes the problem in plain language a user can act on.

## Rules

- **Return value even when errors are present** where the data is still partially usable. Reserve `value: null` for truly unrecoverable failures (e.g. a required field is missing). Degraded data + warnings is better than null + error for chart rendering.
- **Caller always checks `errors`** — never silently discard. A caller that intentionally ignores errors must say so explicitly: `const { value } = fn(); // errors intentionally ignored — surfaced upstream`.
- **`level: 'error'`** — value is unusable for the purpose; caller must not render or use it.
- **`level: 'warn'`** — value is usable but degraded; caller should surface the warning to the user.
- **Per-point invalidity** — when a calculation produces invalid results for a subset of points (not all), set those positions to `null` in the value array (renderer draws gaps) and include a `level: 'warn'` entry describing the affected range. Do not set `value: null` for partial failures.
- **Compose upward** — low-level functions return `{ value, errors }`; higher-level functions unwrap, accumulate errors, and re-wrap. The chain of `{ value, errors }` propagates all the way to the UI.

## Where this applies

- `engine/src/driver.ts` — `deriveDriver`, `parseWdr`, `toWdr`
- `engine.js` — `loadDriver`, `extractSpl`, `extractExcursion`, `extractMaxSpl`, etc.
- Any future function that reads files, calls external APIs, or runs calculations that can produce NaN/Infinity.
- Does **not** apply to pure math functions in `packages/engine/src/` — those remain plain return-value functions. The engine layer wraps them and owns the error contract.

## Caller pattern for test fixtures (the only place throws are allowed)

When a test uses `deriveDriver` or `parseWdr` to set up a fixture, errors must be made explicit and must fail the test with field-level messages rather than silently producing null and crashing downstream:

```js
const { value: DRV, errors: _drvErrors } = deriveDriver(RAW_DRIVER);
if (!DRV) throw new Error('Test fixture invalid: ' + _drvErrors.filter(e => e.level === 'error').map(e => `${e.field}: ${e.message}`).join('; '));
```
