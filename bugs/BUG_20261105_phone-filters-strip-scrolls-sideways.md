# Phone Filters tab: the add-filter buttons run off the screen

Status: OPEN. Found by T690's field layout rules gate (`field-layout-rules.browser.spec.ts`), 5 Nov 2026.

On the phone Filters tab the add-filter buttons (+ Peak HP, + Gain, + DLP, + LS, + HS) sit in a strip that scrolls sideways by 371 px at 374 x 705; four of the five are cut at the right edge, and two buttons overlap by about 20 x 44 px. Rules 2 and 7.

Rule: `.claude/rules/field-layout.md`. The gate lists this fault as a known one and turns red when it is fixed; then delete the entry in KNOWN.
