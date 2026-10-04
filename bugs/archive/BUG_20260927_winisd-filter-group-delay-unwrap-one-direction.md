# BUG_20260927_winisd-filter-group-delay-unwrap-one-direction

**Status:** WONTFIX

## Symptom

WinISD's filter group delay unwraps a phase jump in one direction only. Each filter's group delay is a central difference of its phase at f ± d, d = (f+1e-10)−f. The
unwrap step subtracts 2π when the difference exceeds π, then immediately adds it back, so only a
−2π jump is corrected. A +2π jump between the two points would give a huge spike. With a 1e-10 Hz
step this almost never happens in practice.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_filter_group_delay_unwrap_fixes_one_direction_only.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_filter_group_delay_unwrap_fixes_one_direction_only.md?html).

## OpenISD

Not copied. OpenISD's filter group delay (`sweep.ts` `groupDelayAtMs`, relative step 1e-6)
matches WinISD's to its rounding noise over every capture (`filters-winisd.test.ts`); the broken
branch needs a +2π phase jump inside a 2e-10 Hz step and was never seen in 34 000 logged points.
Revisit only if a capture shows a spike.

## Checked by hand (QO170, 2026-10-04)

NOT SEEN, not reachable by hand. A spike needs a plotted point within 1e-10 Hz of a phase wrap, and the
Allpass wrap at 106 Hz is smooth. It stays a disassembly-only claim. Screenshot:
`winisd_research/runs/qo170-allpass/allpass_1_n2…png`.
