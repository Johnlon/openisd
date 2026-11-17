# Passive radiator editor shows Date added in two formats

**Status:** FIXED (T852)
**Issue:** https://github.com/portingle/openisd/issues/157
**Reported by:** John, 16 Nov 2026 (test site v20261116T1935Z).

There are two forms of Date added, the dash-less stamp (20261116) and the dashed day (2026-09-12). A newly defined radiator was written as the stamp, existing catalogue records hold the dashed day, and the editor showed each as stored.

Fix (display only): `isoDay` in `packages/design/fields/format.ts` turns a stored stamp into the dashed day. Every place Date added is shown goes through it: the passive radiator editor, the driver editor, the passive radiator Info page and the driver preview panel. Stored stamps are unchanged: catalogue records store the dashed day, user-defined records store the dash-less stamp. A single stored form is an open question for John.
Tests: `packages/design/test/fields/format-date.test.ts`, `packages/ui/test/hooks/passiveRadiatorEditor.test.ts`, `packages/ui/test/hooks/passiveRadiatorActions.test.ts`, `packages/ui/test/logic/driverDisplay.test.ts`.
