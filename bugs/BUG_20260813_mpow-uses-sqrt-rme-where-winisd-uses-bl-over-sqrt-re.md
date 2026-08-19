# `Mpow` uses √Rme where WinISD uses Bl/√Re — the two were indistinguishable until now

# Status
BLOCKED 2026-08-13 — needs a human ruling


**Found** 2026-08-13, on the `inconsistent-fs` parity golden captured the same day.
**Severity** wrong number on any record whose stored `Fs` disagrees with its own `Mms`·`Cms` —
41 % on the fixture that separates them. Zero on a self-consistent driver, which is why it
survived.
**Status** ⛔ **NOT FIXED — blocked on the human.** `packages/engine/src/driver.ts` formula,
`AGENTS.md` §"Calculation logic — permission gate".

## Symptom

`inconsistent-fs` is `sealed-small` with `Fs` written at exactly twice its true
`1/(2π√(Mms·Cms))` — a scenario built to separate routes that agree on any consistent record.

| | `Rme` | `Mpow` |
| --- | --- | --- |
| WinISD 0.7.0.0 (`…/goldens/inconsistent-fs.wpr`, ParState slots 34/35 = `C`,`C`) | `17.578125` | `2.96463530640786` |
| openisd | `17.578125` ✅ | `4.192627457812105` ❌ (relative 4.142e-1) |

`√17.578125 = 4.1926…`; `Bl/√Re = 7.5/√6.4 = 2.96463530640786`, matching WinISD to the last
digit. WinISD's own `Rme` and `Mpow` are therefore **not** related by a square root on this
record — the identity openisd pins is not one WinISD holds.

On `sealed-small` both routes give `2.96463530640786`, which is why 14 of the 15 goldens agree.

## The code

`packages/engine/src/driver.ts:267-271`

    // Mpow = Bl/√Re = √Rme. Stated as √Rme so it cannot contradict the Rme actually produced
    // … ⚠ WinISD's own choice between the two is unverified; this one is chosen because it
    // keeps the pinned identity Mpow = √Rme true of our output.
    if (r.Mpow == null && r.Rme != null && r.Rme > 0) setVal('Mpow', Math.sqrt(r.Rme));

The comment names the choice as unverified and states the reason for it. The oracle now
answers, and it answers the other way.

## What is NOT wrong

`Rme`'s route is confirmed correct by the same golden: WinISD's `17.578125` is
`2π·Fs·Mms/Qes` on the STORED (doubled) `Fs`, i.e. the motional route the engine already
prefers at `driver.ts:261-266`, not `Bl²/Re` (which is `8.7890625` here). The existing
precedence stands; only `Mpow` is wrong.

Which also means openisd's own "`Mpow = √Rme`" invariant must be dropped, not preserved:
WinISD carries an `Rme` and an `Mpow` that are independently sourced, and reproducing WinISD
means reproducing that independence.

## Fix, if authorised

    if (r.Mpow == null && r.Bl != null && r.Re != null && r.Re > 0) setVal('Mpow', r.Bl / Math.sqrt(r.Re));

with `√Rme` retained only as the fallback for a record that has no `Bl`, and the comment's
"unverified" note replaced by the citation to `goldens/inconsistent-fs.wpr`.

## Verification, once authorised

`npx vitest run --project winisd packages/winisd/test/winisd-parity.test.ts` — the
`inconsistent-fs` `Mpow` row goes green and the other 14 stay green. `solve-from-q-pair`'s
`Mpow` row is a DIFFERENT cause (the truncated air constants, via `Mms`) and is not touched by
this — see
`bugs/BUG_20260813_winisd-compatibility-air-returns-truncated-rho-and-c-not-winisds-own-pair.md`.
