# `SPL` and `SPLref` are two names for one quantity

## Status
OPEN — blocked on the engine-wide rename, `docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md` Step 7.

## Symptom

A `.wdr` stating `SPL=90` yields `cell('SPL') = 90` beside `cell('SPLref') = 87.65`. Both name
reference sensitivity, 1 W at 1 m. `ARCHITECTURE.md` §5 "One name per field" forbids one quantity
carrying two names, and here the two names also carry two different numbers, so a reader has no
way to tell which the app means.

## Why the two numbers differ, and why that part is correct

WinISD carries a STATED reference sensitivity beside an INDEPENDENTLY calculated η₀
(`no`, ParState slot 22, marked `C`), and the two need not agree — that is how a real driver's
datasheet SPL sits beside its T/S-derived efficiency. `s-spl.wdr`
(`drivers/sample/winisd/s-spl.wdr`) is a WinISD-authored probe with `SPL=123` and every other
parameter `0`; its ParState is `NNNENNN…`, slot 3 `E` and every derived slot `N`. WinISD never
computed a sensitivity there — it recorded one that was typed.

So the two VALUES are legitimately distinct facts. The defect is that openisd exposes them under
two names for the same field rather than as a stated figure and a derived one.

## Fix

Collapse the two names across `@openisd/engine`'s solver, which is the Step 7 rename. This record
exists to keep the naming violation visible until that lands; it is not fixable locally, because
renaming one of the pair inside `@openisd/winisd` alone would leave the solver and the file
boundary disagreeing.

## Verification

One name reaches the UI and the file boundary for reference sensitivity, with the stated and
derived values distinguished by provenance rather than by field name, and
`packages/winisd/test/winisd-parity.test.ts` still green on the ParState slot-3 rows.
