# Phone Filters tab: the add-filter buttons run off the screen

Status: RESOLVED (T788, 11 Nov 2026): the strip is a carousel again. T734's wrapping chips went against John's ruling. Found by T690's field layout rules gate (`field-layout-rules.browser.spec.ts`), 5 Nov 2026.

John (chat, 8 Nov 2026) ruled: "not a bug, the strip is a carousel". T734 then made the chips wrap anyway; that was wrong. T788 restores the carousel (one row, sideways scroll inside the strip only, the ‹ › buttons, `data-carousel`), with the arrows beside the strip so they never overlap a chip, and the text at 13 px (John, 11 Nov: "make the font a little smaller"). The field layout gate treats a `data-carousel` strip as designed.

On the phone Filters tab the add-filter buttons (+ Peak HP, + Gain, + DLP, + LS, + HS) sit in a strip that scrolls sideways by 371 px at 374 x 705; four of the five are cut at the right edge, and two buttons overlap by about 20 x 44 px. Rules 2 and 7.

Rule: `.claude/rules/field-layout.md`. The gate lists this fault as a known one and turns red when it is fixed; then delete the entry in KNOWN.
