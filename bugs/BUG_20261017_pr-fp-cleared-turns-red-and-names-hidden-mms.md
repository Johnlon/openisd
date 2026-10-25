# BUG_20261017_pr-fp-cleared-turns-red-and-names-hidden-mms

**Status:** FIXED (T275)

## Symptom
John, 17 Oct 2026, phone, passive radiator box (relayed by the coordinator):
- Clearing the target tuning (Fp) left it blank.
- Deleting Fp turned the field red with "Mms_kg cannot be calculated yet - state Mms = 1/((2π·Fs)²·Cms) (needs Fs_hz)." and "Conflicts with other values: Fs_hz, Mms_kg, Cms_m_per_N disagree by 6.5%… Every field in the group is marked".
- The messages use internal keys (Mms_kg, Fs_hz, Cms_m_per_N).
- The message names the radiator's Mms, but the phone shows only added mass: no way to see or enter Mms.

## John's rulings (17 Oct 2026, relayed by the coordinator)
- "The phone PR settings show the radiator's own figures as editable rows: its Mms (datasheets give it), Sd, and every other PR field the desktop skin shows. Add them now."
- "Internal names like Mms_kg, Fs_hz and Cms_m_per_N leak into user messages EVERYWHERE, not just on PR. Every user-facing message gets plain names from packages/design (e.g. "moving mass (Mms)"). Add a test that fails if any user message contains a field key pattern."

## Which PR fields the phone hides that the desktop shows
None. Both skins show Vas, Qms, Fpr, Sd, Xmax, the count, Fp, added mass and Fpr with added mass. Both hid the radiator's Mms and Cms, which the messages name.

## Fix
- Clearing Fp with no added mass stated enters the added mass as 0, so Fp is calculated (the natural tuning). Never blank.
- Every sentence a DqIssue carries goes through `plainNames` (packages/design/engine/issueText.ts): "moving mass (Mms)", "resonance (Fs)".
- The phone PR panel has Mms and Cms rows (T275).
- Tests: packages/design/test/domain/user-message-plain-names.test.ts, field-clear-rule.test.ts.
