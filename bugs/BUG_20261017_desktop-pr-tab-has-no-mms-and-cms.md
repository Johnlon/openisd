# BUG_20261017_desktop-pr-tab-has-no-mms-and-cms

**Status:** FIXED (T338)

## Symptom
The desktop Passive Radiator tab has no Mms or Cms. Datasheets give them, and the phone tab has them (T275). On the desktop Mms could only be calculated from Fpr, Vas and Sd.

## John's words
17 Oct 2026 (via fable): why the desktop PR tab has no Mms when datasheets give it.

## WinISD
WinISD's PR tab has no Mms or Cms either: Vas, Fs, Qms, Sd, Xmax, Num. of PRs, Added mass, Fs with added mass (`winisd_research/runs/pr_addedmass_tab.png`). OpenISD shows them with a ≠W cue (help entry "WinISD has no Mms or Cms on the Passive Radiator tab"), on both skins.

## Fix (T338)
Mms and Cms rows on the desktop PR tab, the same fields as the phone's, linked by the clear rule; ≠W cues on both skins.

## Verification
`pr-difference-cues.browser.spec.ts` (both skins: both fields editable, cue opens its entry); `original-pr-tab.browser.spec.ts` (Mms typed is kept, Cms shown).
