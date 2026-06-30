# TODO — Engine hardening (HIGH PRIORITY)

**Priority: HIGH.** The engine silently emits `NaN`/`Infinity` on incomplete or
degenerate input, producing blank/garbage graphs with no error. This undermines
the one thing the tool exists to do: produce trustworthy numbers.

**Status: awaiting human sign-off.** This touches `src/core/` (calculation-stability
rule). The guard work is purely additive — **no formula changes** — but it stays
gated until approved. Items marked ⚠ change computed output and need separate
explicit approval.

Background + rationale: `CODE_REVIEW/ENGINE_HARDENING.md`.
Findings: `CODE_REVIEW/CODE_REVIEW.md` §16-21, §10-11. Tracked as task **#10**.

---

## The design: two cheap layers (defence in depth)

An input guard alone does **not** prove `div/0` can't happen mid-sweep —
denominators are frequency-dependent and a singularity (or float overflow) can
appear even with valid inputs. So pair two layers:

- **Precondition** — validate inputs once at the engine entry; throw a named error
  for the common, input-caused failures.
- **Postcondition** — after the sweep, one pass over the output; if anything is
  non-finite, fail loud. This catches whatever the precondition couldn't foresee.

`Number.isFinite()` catches both `NaN` (`0/0`) and `±Infinity` (`x/0`, overflow).

---

## Actions

### P0 — additive guards (no formula change, safe once approved)

- [ ] Add `assertValidDriver(d)` — require `Fs>0, Sd>0, Re>0`; require enough Q
      params to derive `Bl` (Vas + one Q, or any two of Qts/Qes/Qms); require
      `Qms > Qts` when both present. Throws a plain-English `EngineError`.
      Fixes §16 (Vas-without-Qms `NaN`) and §11 (`Qms == Qts` → ∞).
- [ ] Add `assertValidParams(P, box)` — require `Vb > 0` (and `Vf > 0` for
      bandpass), `Sp > 0` for vented, PR params present for `pr`. Fixes §18.
- [ ] Call both at the entry of `deriveDriver` / `sweep` / `maxCurves` (once per
      design, not per frequency bin — keep the hot path branch-free).
- [ ] Add postcondition: after `sweep`/`maxCurves`, assert all output arrays are
      finite; throw `EngineError('non-finite result — degenerate parameters?')`.
      Net for §17 and any unforeseen mid-sweep singularity.
- [ ] Wire the UI call site in a `try/catch` to show the `EngineError` message
      **instead of a blank graph**. Guard `maxCurves` when `Xmax` absent (§10):
      skip the Xmax limit, use the Pe limit only.

### ⚠ Sign-off gated — these change computed numbers

- [ ] §19 `sweep.js:98` `(drv.Pe || 50)` — stop fabricating a silent 50 W. Either
      require `Pe`, or surface "assumed 50 W (no datasheet rating)" in the UI.
- [ ] §20 `constants.js:11-12` — `C=345.0`, `RHO=1.184` are labelled 20 °C but are
      ~24 °C values. Pick one reference temperature; correct the values or the
      comment. Verify exact textbook figures (20 °C ≈ 343.2 m/s, ≈1.204 kg/m³) first.

### Maintainability (no behaviour change)

- [ ] §21 `driver.js:110` — document or name the 48-char `ParState` magic string.

---

## Acceptance criteria

- [ ] A driver with `Vas`+`Qts` but no `Qms` produces a **clear error**, not a
      blank graph.
- [ ] `Vb = 0` (or unset) produces a clear error, not `Infinity`-poisoned curves.
- [ ] No code path in `sweep`/`maxCurves` can return a non-finite value to the UI
      without an `EngineError` being raised first.
- [ ] All existing physics tests still pass unchanged (`npm test`); the math for
      valid inputs is **bit-identical** to today.
- [ ] New unit tests in `test/` cover each rejection case with a human-readable
      scenario name (per `DEVELOPMENT.md`).
