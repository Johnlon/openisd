# Radiator pick replaces a stated Cms and Mms with ones worked out from Vas and Fs (QO451)

Symptom: P173 on test.openisd.app states Cms 1.01 and Mms 15 g. The wizard step and the project page Box tab show Cms 1.0011 and Mms 15.05, blue (calculated), with ≠W.
Cause: `adoptDatasheetFigures` in packages/design/domain/passiveRadiator/openIsdPassiveRadiatorSpec.ts cleared a stated Cms when Vas was stated and a stated Mms when Fs was stated; `resolve` then worked them out (the 31 Oct rule, now replaced).
Ruling: John, QO451, 8 Nov 2026: a stated figure is never replaced by a worked-out one.
Fix: only Rms is still dropped (when Qms is stated). Cms and Mms stay entered; a stated pair that disagrees keeps both with the conflict mark from `resolve`.
Test: packages/design/test/domain/pr-adopt-datasheet-figures.test.ts (P173 keeps 0.00101 and 0.015 entered).
Docs: ≠W rows in docs/research/WINISD_PARITY.md and docs/research/ACCURACY_IMPROVEMENTS.md.
Later edits (QO463, John 8 Nov 2026, B): the figure typed last wins. Typing Vas, Fs, Qms or Sd works out again the stated Cms, Mms, Rms it moves, and back; typing into a worked-out box makes it E again. Rule: docs/design/FIELD_CLEAR_RULE.md "Passive radiator pairs". Test: packages/design/test/domain/pr-typed-value-wins.test.ts. Tests of the T703 "typed Cms beside stated Vas, both marked" rule now assert this one.
Verification: design PR unit tests, OriginalNewProject hooks, 7 radiator browser specs pass (8 Nov).
