# Engine hardening — a boundary guard instead of `NaN`

**Status: proposal for human approval. No `src/core/` code has been changed.**
Anything here that affects computed output (constants, the `Pe` default) is
sign-off gated under the calculation-stability rule.

This document explains the engine robustness findings (`CODE_REVIEW.md` §16-21,
§10-11) and proposes a fix. It is written to be understandable without prior
knowledge of the codebase.

---

## The problem, in plain terms

The physics engine (`src/core/`) is made of **pure functions**: same inputs →
same outputs, no side effects. That is good. But pure does not mean *safe*. When
a function is handed incomplete or nonsensical data, it doesn't stop — it keeps
doing arithmetic and produces `NaN` ("not a number") or `Infinity`.

Concrete example (finding §16): a driver file that has `Vas` and `Qts` but no
`Qms` is **accepted** by the parser, but the derivation can't compute `Bl`
(force factor) from those alone, so:

```
Bl = √(… / Qes)     and Qes is undefined  →  Bl = NaN
```

That single `NaN` then flows into every later calculation.

### Why `NaN` is the worst possible way to fail

1. **It's contagious.** Any arithmetic involving `NaN` returns `NaN`.
   `NaN + 5`, `NaN * 0`, `log10(NaN)` — all `NaN`. One bad value 20 steps back
   silently turns the entire SPL curve into nothing.
2. **It's silent.** No error, no log, no stack trace. The graph just goes blank
   or flat. You're left guessing which of a dozen inputs caused it — which is
   literally "impossible to debug" (Version B item 5).
3. **It breaks comparisons.** `NaN > 0`, `NaN < 0`, and even `NaN === NaN` are
   **all `false`**. So a guard like `if (excAt283 > 0)` silently takes the wrong
   branch when the value is `NaN`, hiding the problem further.
4. **It fails far from the cause.** The blank graph shows up in the UI; the real
   cause was a missing field in a file parsed seconds earlier and three modules
   away.

So `NaN` is the opposite of good failure. Good failure is **fast, loud, and near
the cause, with a message that names the cause.**

---

## The better pattern: validate at the boundary

The fix is not to sprinkle `NaN` checks through the math. That would slow the hot
path (the sweep runs the solver ~400× per redraw) and scatter the logic. The fix
is a single **guard at the entry point** — the "boundary" between untrusted input
data and the trusted pure core.

> **Establish the invariant once, at the door. Then the hot path can trust it.**

This is the standard "precondition / guard clause" pattern. The engine *declares
its contract* ("I need Fs>0, Sd>0, Re>0, and enough Q parameters to derive Bl")
and *enforces it once*, instead of letting bad data wander in and rot into `NaN`.

### What it looks like (proposed — not applied)

A small validator the engine calls before any math:

```js
// proposed: src/core/validate.js  (NOT YET ADDED)
export function assertValidDriver(d) {
  const need = ['Fs', 'Sd', 'Re'];
  for (const k of need)
    if (!(d[k] > 0)) throw new EngineError(`driver.${k} must be > 0 (got ${d[k]})`);

  const qs = ['Qts', 'Qes', 'Qms'].filter(k => d[k] > 0).length;
  if (!(d.Vas > 0 && qs >= 1) && qs < 2)
    throw new EngineError('driver needs Vas + one Q, or any two of Qts/Qes/Qms, to derive Bl');

  if (d.Qms != null && d.Qts != null && d.Qms <= d.Qts)
    throw new EngineError(`Qms (${d.Qms}) must exceed Qts (${d.Qts})`); // else Qes → ∞
}
```

`deriveDriver`/`sweep` call `assertValidDriver(d)` on entry. The UI wraps the call
in `try/catch` and shows the message ("driver needs Vas + one Q…") **instead of a
blank graph**. The math inside is unchanged and stays branch-free and fast.

### Why throw, rather than return a `Result` object?

There are two respectable options:

| Pattern | How it works | Trade-off |
| --- | --- | --- |
| **Throw + try/catch** (recommended here) | Guard throws `EngineError`; UI catches once at the call site | Simplest; keeps every math function's signature clean; matches `parseWdr` which already throws |
| **Result type** `{ok, value} \| {ok, error}` | Every function returns success-or-error; caller must check | More explicit (impossible to ignore), but viral — every signature and every caller changes |

For an app this size, **throw-with-a-clear-message at the boundary** gives ~95% of
the benefit (fast, loud, named cause) for a fraction of the churn. The pure core
stays pure; only the entry point gains a guard.

### But an input guard can't prove `div/0` never happens mid-sweep

Important caveat: the precondition checks *inputs*, but the denominators inside the
solver are frequency-dependent intermediates computed ~400× per sweep. A
singularity (or float overflow) can in principle appear even with valid inputs —
a lossless system, `f = 0`, or parameters that happen to cancel. You can't prove
it away cheaply. So add a **second layer**:

- **Precondition** — validate inputs once at entry; throw a named error for the
  common, input-caused failures.
- **Postcondition** — after the sweep, one pass over the output; if anything is
  non-finite, fail loud. This is the net for whatever the precondition couldn't
  foresee.

```js
// proposed: after sweep()/maxCurves()
if (!result.spl.every(Number.isFinite))
  throw new EngineError('non-finite result — degenerate parameters?');
```

`Number.isFinite()` catches both `NaN` (`0/0`) and `±Infinity` (`x/0`, overflow)
in one check. It doesn't *prevent* the singularity — it guarantees you never
*trust* a result that hit one.

### And the primitive ops (`cDiv`/`cInv`, finding §17)?

Leave them branch-free for speed. A divide-by-zero there is only reachable if a
zero denominator gets that far — the precondition stops the input-caused cases and
the postcondition catches anything else. Defence at the door and at the exit, not
in the hot loop. (Optionally, assert-on-zero in `cDiv`/`cInv` in **dev builds
only**, staying branch-free in production.)

---

## Items that change numbers (separate approval)

These are **not** robustness — they change computed output, so they need explicit
sign-off and are listed only for decision, not action:

- **§19 `Pe || 50`** — better than a silent fabricated rating: require `Pe`, or
  label it in the UI ("assumed 50 W — no datasheet rating") so it is not presented
  as fact.
- **§20 constants** — `C`/`RHO` are labelled 20 °C but are ~24 °C values. Decide a
  single reference temperature and correct either the values or the comment.
  Verify exact textbook figures first.

---

## Summary

- The engine is pure and correct — keep it that way.
- `NaN` is silent, contagious, and fails far from the cause: the worst failure
  mode for a tool whose whole job is producing trustworthy numbers.
- Add **one boundary guard** that throws a named error before the math runs; let
  the UI show the message. Pure core unchanged, hot path unchanged.
- Treat number-changing items (`Pe` default, temperature constants) as separate,
  sign-off-gated decisions.
