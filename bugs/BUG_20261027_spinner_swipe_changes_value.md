# Touching a spinner to scroll changes its value

27 October 2026, T607. John reports that a vertical drag starting on ▲ or ▼ must scroll without stepping.

Reproduced with real touch input: all four up/down swipe and Increase/Decrease combinations fail (log124717). Starting at1.000 leaves1.010 or0.990. The hook calls beginRepeat immediately on pointerdown, before the browser recognises scrolling or sends pointercancel. Cancellation stops later repeats but cannot undo the initial unwanted edit.

Required behavior: a stationary touch release steps once; a stationary hold repeats with existing digit/limit/acceleration rules; moving beyond the gesture tolerance or pointercancel before activation changes nothing and allows native vertical scrolling. Mouse and keyboard behavior remain covered by existing tests. Keep the fix in shared NumInput behavior, not individual pages.

Implemented in shared NumInput: touch-down arms a provisional gesture and does not edit
or prevent native pan-y. Stationary touch release steps once. A stationary hold activates
after the existing400ms hold threshold and uses existing selected-digit/bounds/repeat rules.
Movement of8px in either axis or pointercancel cancels an unactivated touch, all hold timers
and repeats. Mouse keeps immediate press stepping; input/button focus transfers preserve
the established scroll pin and stop old repeats without cancelling the new touch gesture.

Evidence: four original swipe failures124717 then eight tap/hold/swipe passes124954;
real multi-filter native scrolling and cancelled-touch/no-delayed-repeat2pass125116;
broader spinner run26pass125417 with1outdated readonly-span assertion. That old assertion
was corrected under John's production-style readonly-box selection: Bandpass Fsc is a
native readonly input with no spinner and rejects typing, green125737. Desktop4cases
also pass125848 after preserving clearRepeat on input blur. Domain/pinning87pass125528.
The missing old coverage was gesture arbitration: existing tests tapped and held stationary
buttons but never began a vertical pan on one. Stopping repeats on pointercancel cannot
undo an edit emitted prematurely on pointerdown.

Final keyboard-dismissal pinning130050, strict changed-file lint130058 and typecheck130053 pass.


Independent criticism exposed a double hold delay in the first repair. Deterministic
clock test red130655 required the first touch step at400ms and the next near733ms;
the second was incorrectly postponed to800ms. Touch now passes the actual press timestamp
into the shared repeat loop, which uses the existing cadence for the next tick once hold
activation has elapsed. Its acceleration also uses the actual touch start. Small sideways
thumb drift inside an activated hold was separately red130809; the8px threshold now only
arbitrates unactivated gestures, while leaving an activated button/native pointercancel
still stops it. Focused draft swipes preserve both exact draft1.00 and input focus.
All15touch/pinning cases pass130914, then all17width/touch cases pass131158. Final source
passes strict lint131204 and typecheck131319. Full bundle131201 contains both fixes.
