# Driver editor field labels wrap mid-word (USPL as USP / L)

## Symptom
John, 8 Nov 2026 04:36, desktop driver editor, Parameters tab, Miscellaneous row: "Field labels are wrapping". USPL shows as "USP" over "L", SPL as "SP" over "L". 04:38, Advanced tab, Figure of merits: SPLmaxLF -> "SPLmaxL / F", SPLmax -> "SPLma / x", Rme -> "Rm / e", gamma -> "gamm / a" (four columns, 1920 wide). 04:40: "These are new corruptions, openisd.app does not have these problems." 04:50: "openisd.app doesn't show the field wrapping but test. does."

## Evidence
- Measured with Playwright (sample project, 1366x900, 1920x1080, 1536, 1440, 1280, 1100; dev server lap:4727, https://test.openisd.app, https://openisd.app): every `.de-fld label` computes `white-space: normal; overflow-wrap: anywhere`. clientWidth equals scrollWidth and one line (14 px) everywhere. The wrap did NOT reproduce here on prod, test or this tree.
- Source of `normal`/`anywhere`: `packages/ui/src/ui/joined-fields.css` line 13 (added by T607, 29 Oct 2026, so it is in prod too). It out-ranks the driver editor's intended `white-space: nowrap` (`.de-desktop .de-fld :deep(label)`, DriverEditorModal.vue). Any narrowing of the label track then breaks a word at any letter.
- `git diff snap-20261108T0032Z HEAD` touches no field CSS, no joined-fields.css, no driver editor grid. Only OriginalProjectList.vue, OriginalWhatIf.vue, OriginalShell.vue, MobileSheet.vue, NumInput-hooks.ts changed under packages/ui/src. The commit that made the track narrower on John's screen is NOT found; the trigger on his machine is unknown.

## Cause
The driver editor label has no `nowrap` that wins: the shared joined-field rule (T607) allows wrapping anywhere in a word, so any squeeze of the label track splits the word.

## Fix
`.de-desktop .de-fld label` in DriverEditorModal.vue: `white-space: nowrap`, `overflow-wrap: normal`, `max-width: none`, all `!important`. No box width changed.

## Test
`packages/ui/test/ui/driver-editor-label-nowrap.browser.spec.ts`: all four tabs, 1366x900 and 1920x1080, every field label one line and clientWidth >= scrollWidth. It passes before and after the fix (no repro of the wrap), so it guards only.
