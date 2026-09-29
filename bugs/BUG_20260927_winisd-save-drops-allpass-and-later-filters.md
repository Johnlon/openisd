# BUG_20260927_winisd-save-drops-allpass-and-later-filters

**Status:** RESOLVED

## Symptom

WinISD's save loses an Allpass filter and every filter after it. Save a project whose filter list holds an Allpass. The `.wpr` gets the full `Count=N` but stops
writing entries at the first Allpass. Reopen it: the Allpass and every filter after it come back as
WinISD's default Lowpass (Butterworth, n=2, fc=50 Hz, ticked). Silent data loss.

This is a WinISD bug. Evidence and mechanism: [winisd_research/bugs/BUG_20260927_winisd_save_drops_allpass_and_every_filter_after_it.md](http://localhost:8000/winisd/winisd_research/bugs/BUG_20260927_winisd_save_drops_allpass_and_every_filter_after_it.md?html).

## OpenISD

Not copied: OpenISD never loses filters on save (CLAUDE.md: WinISD warts yes, data loss no).
Export writes every filter, Allpass included.

Import of a `.wpr` WinISD truncated this way: load each missing entry as WinISD does (default
Lowpass Butterworth n=2, 50 Hz, ticked) and warn, naming the filter index. Done: `WinIsdProjectConverter#importFilters` (packages/design/domain/winIsdProjectConverter.ts).

## ⚠ Human re-verification pending (QO170)

Found by debugger, disassembly and scripted runs only. Not yet reproduced by hand in WinISD's own
window. Treat as unconfirmed until John and an agent check it together (QO170); record the result
here.

## Verification (2026-09-29)
`packages/design/test/winisd/openIsdProjectToWinIsdProject.test.ts` (52/52): "an entry whose filter<i>type/params keys are both missing loads as WinISD's own default lowpass, with a warn", and the allpass export/import round-trip cases. The QO170 hand check of WinISD's own behaviour is still pending; it does not change OpenISD's handling.
