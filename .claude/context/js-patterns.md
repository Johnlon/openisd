# JS error handling — Go-inspired pattern

All functions that perform I/O, validation, or calculations that can partially fail **must** return `{ value, errors }` rather than throwing or returning bare values.

## Shape

```js
// errors is always an array — empty means clean, never omit it
{ value: <result or null>, errors: [{ level: 'error'|'warn', field, message }, ...] }
```

## Rules

- **Return value even when errors are present** where the data is still partially usable. Reserve `value: null` for truly unrecoverable failures (e.g. parse fails completely). Degraded data + warnings is better than null + error for chart rendering.
- **Caller always checks `errors`** — never silently discard. A caller that ignores errors must do so explicitly: `const { value } = fn(); // errors intentionally ignored — display handled upstream`.
- **`level: 'error'`** — value is unusable; caller must not render or use it.
- **`level: 'warn'`** — value is usable but degraded; caller should surface the warning to the user.
- **Per-point invalidity** — when a calculation produces invalid results for a subset of points (not all), set those positions to `null` in the value array (renderer draws gaps) and include a `level: 'warn'` entry describing the affected range. Do not set `value: null` for partial failures.
- **Never throw from engine or extractor functions** — throw only from pure parsers where the input is structurally invalid (e.g. `parseWdr` on non-WDR text). Calculation functions catch their own errors internally and return them in `errors`.

## Where this applies

- `engine.js` — `loadDriver`, `extractSpl`, `extractExcursion`, `extractMaxSpl`, etc.
- Any future function that reads files, calls external APIs, or runs calculations that can produce NaN/Infinity.
- Does **not** apply to pure math functions in `src/core/` — those remain plain return-value functions. The engine layer wraps them and owns the error contract.
