# BUG_20261118_phone-chip-strip-shifts-when-scrolled

**Status:** FIXED on branch t897 (cause proven as a layout fact; link to the CI flake inferred, not reproduced).

## Symptom
Phone Filters tab: the row of "+ LP / + HP / ..." chips jumps 48 px sideways the moment it is scrolled off its start (and again at its end). A tap aimed at a far chip (+ Gain, + DLP) can land on its neighbour.
Main's suite failed twice on the phone Filters sweep (`filters-dependent-values.browser.spec.ts`, "every box follows its inputs"): run 44285719892 on "phone DLP ... fc" and run 44283779423 on "phone Gain ... Gain", both `TimeoutError: locator.evaluate: Timeout 20000ms` waiting for the number box of the filter just added, in the fresh reference page (`freshVisit`), at the first step. Both are chips that sit past the strip's visible edge; chips near the start never failed.

## Cause
`packages/ui/src/ui/shells/mobile/MobileFiltersTab.vue`, style rule `.mob-fstrip-wrap.at-start .mob-fstrip-prev, .mob-fstrip-wrap.at-end .mob-fstrip-next { display: none; }`: the arrow beside the strip was taken out of the layout. At the start the strip is 48 px wider (left edge x=8, width 296 at 374 px); the first scroll event flips `at-start` (script `readScroll`), the arrow appears and the strip becomes x=56, width 248. Every chip moves under the pointer one render after the scroll. Playwright (or a finger) that aimed at a chip before that render can hit the neighbour: a different filter is added, which has no box with the wanted label.

Evidence: the new test "scrolling the chips sideways does not move them" failed before the change with `left: 8 -> 56, width: 296 -> 248` at 374x705 (and 310 -> 248 at 360x740), and passes after.
Not shown: the CI failure itself did not reproduce locally (about 340 runs of the phone fc and Gain cases at 4 to 6 workers, restricted to 2 cores, with CPU throttling, before and after, all green), so the neighbour-chip tap is the inferred route.

## Fix
The arrow keeps its place and is greyed and `disabled` (aria-disabled; not clickable or focusable; opacity 0.4 as the other phone disabled buttons) at the end with nothing more to show, so the strip never changes width and leaves no hole. (A first try, `visibility: hidden`, left a blank 48 px slot at the start; the lead rejected it, 18 Nov 2026.) The old assertions that the arrow is hidden at the start became assertions that it is disabled.
The sweep fixture now checks that the card that appeared is the one tapped (`.mob-fcard-name` is the chip's short name), so a wrong tap names itself instead of timing out 20 s later.
