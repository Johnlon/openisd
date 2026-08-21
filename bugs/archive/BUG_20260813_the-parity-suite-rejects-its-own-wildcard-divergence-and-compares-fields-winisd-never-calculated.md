# Two defects in the parity suite itself: it rejects its own `*` divergence, and it compares fields WinISD never calculated

# Status
FIXED 2026-08-13


**Found** 2026-08-13, bucketing `packages/winisd/test/winisd-parity.test.ts`.
**Severity** test-only. Neither affects a number the app produces; both produce failures that
are the suite being wrong rather than the app.
**Status** FIXED in the same session, as tests.

---

## 1. The guard rejects the `scenario: "*"` form the file itself defines

**Symptom.** `every known divergence still names a scenario and a field that exist` fails with
`divergence names unknown scenario *`, on the one entry `divergences.json` currently holds.

**The code.** `packages/winisd/test/winisd-parity.test.ts:198`

    assert.ok(scenarios.some(s => s.id === d.scenario), `divergence names unknown scenario ${d.scenario}`);

while the type it is guarding, at `:80`, defines the form:

    /** A scenario id, or `*` for a difference that is a property of the code rather than the case. */
    scenario: string;

and the lookup at `:142` honours it:

    return divergences.find(d => (d.scenario === scenario || d.scenario === '*') && d.field === field);

**Root cause.** The guard was written against the per-scenario form and never updated when `*`
was added. Two readers of one field disagree about its grammar.

**Fix.** Accept `*` in the guard, the same way the lookup does.

---

## 2. It compares fields WinISD did not calculate, only echoed

**Symptom.** `Mcost` fails on 14 of the 15 goldens with *"openisd produced no Mcost at all, but
WinISD wrote 0"*.

**What the golden actually says.** `Mcost` is `Rme·(1 + Xmax/min(Hc,Hg))`, and every one of
those 14 scenarios has `Hc = Hg = 0`, so the divisor is zero and there is no answer to have.
WinISD's `0` is not its answer: on all 14 the golden's **ParState slot 36 reads `E`**, and
`lib/wdr.py`'s `write_wpr` (the harness that built the input) writes ONLY the keys the scenario
names — `Mcost` is not one of them. WinISD defaulted an absent field to 0 and marked it stated.

The contrast is decisive and comes from the same suite. On `gap-geometry`
(Hc 12 mm, Hg 6 mm, Xmax 3 mm) WinISD marks **slot 36 `C`** and writes
`Mcost=13.18359375` — and openisd's formula reproduces it exactly:
`8.7890625 × (1 + 0.003/0.006) = 13.18359375`. So the rule is right, and the 14 red rows are
the suite comparing openisd's honest "no answer" against a WinISD default.

The same shape is what `s-mcost.wdr` shows independently: `Mcost=123` typed into WinISD marks
slot 36 `E`, confirming the slot and that the field is enterable.

**Root cause.** The suite treats every value in a golden's `[Driver]` block as a WinISD
calculation. A golden also carries echoed inputs and defaults for absent keys, and ParState is
the golden's own statement of which is which — the suite reads ParState for the `ParState` row
and nowhere else.

**Fix.** In the branch that already handles "openisd produced no number", also accept the case
where the golden says WinISD produced no number either: the field's ParState slot is `E` and
the scenario did not enter the key. This fires ONLY when openisd has no value, so it cannot
mask a wrong number — `c` and `roo` are also slot-`E` in these goldens, and because openisd
does produce numbers for them they keep failing, which is correct (they are a real defect,
`bugs/BUG_20260813_winisd-compatibility-air-returns-truncated-rho-and-c-not-winisds-own-pair.md`).

**Not** a tolerance change and **not** a skip: a field WinISD genuinely calculates still has to
match to 1e-9, and `gap-geometry`'s `Mcost` is compared and passes.

---

## Verification

`npx vitest run --project winisd packages/winisd/test/winisd-parity.test.ts` — the divergence
guard passes with the existing `*` entry, `gap-geometry`'s `Mcost` is compared and green, and
the 14 vacuous `Mcost` rows stop being reported as openisd defects.
