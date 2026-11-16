# BUG_20261115_qes-qms-qts-help-sentence-ambiguous

**Status:** OPEN (copy; found reviewing the T793 driver editor help pictures; not fixed there)

## Symptom
The Qes, Qms and Qts help ends "All three do not need manual entry." Read plainly it says none of the three is ever entered, while the sentences before say to enter any two.
The intended meaning is "you do not need to enter all three". (The outside review quoted "do not manual entry"; the source text, `packages/design/fields/phoneText.ts` line 251, has the word "need".)

## Fix
Not done in T793: "You do not need to enter all three."
