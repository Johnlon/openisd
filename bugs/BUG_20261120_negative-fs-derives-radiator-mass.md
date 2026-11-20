# Negative Fs gives a calculated radiator mass

**Status** Fixed.

With Fs of −1 Hz and a positive Cms, the passive-radiator solver calculated a positive moving mass. The shared route squared Fs before checking the result, so the negative input passed unnoticed.

The moving-mass route requires positive Fs and Cms. The regression test in `packages/design/test/engine/formulas.test.ts` checks that each zero or negative input leaves Mms unresolved.
