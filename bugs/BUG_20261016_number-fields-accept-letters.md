# BUG_20261016_number-fields-accept-letters

**Status:** OPEN

## Symptom
Letters can be typed or pasted into a number field. John, 16 Oct 2026: "I can type letters into
number fields using paste and maybe keyboard, how can this be prevented?"

Repro (John): put the cursor at the end of a number field and paste text. The text is added
after the number.

## Evidence (code read 16 Oct 2026)
- `packages/ui/src/ui/components/NumInput.vue:369`: the box is `type="text"` with an
  `inputmode`. Phone keyboards follow `inputmode`; a desktop keyboard and paste are not limited.
- `NumInput.vue:298-310` `onInput`: any text is put in the box. Text that fails
  `NUMBER_SHAPE` (`/^-?\d*[.,]?\d*$/`, line 104) is marked bad and not stored, but it stays visible.
- No `beforeinput` or `paste` handler in `packages/ui/src`.

## Cause
The field checks text after it is in the box. Nothing stops the text from going in.

## Fix
- `beforeinput` on NumInput: work out the text the edit would leave. If it is not a number or the
  start of one (`-`, `.`, `,`, digits), cancel the edit. Letters never appear.
- Paste: take the number from the pasted text ("12.5 Hz" gives 12.5, "1,5" gives 1.5). With no
  number in it, the paste is cancelled. The check is on the whole text after the paste, at the
  cursor or over a selection: pasting "abc" after "12" is cancelled and the field keeps 12.
- The rule (what is a number, what a paste becomes) lives in `packages/design`, not the UI
  (`.claude/rules/ui.md`).
- Every number field on both skins goes through NumInput; check that UIField does too.

## Verification
- Unit tests in packages/design for the accept/extract rule.
- A browser spec per skin: type "a" into a number field and nothing appears; paste "12.5 Hz" and
  12.5 appears; paste "abc" and the field keeps its value; with the cursor at the end of "12", paste "abc" and
  the field still shows 12.
