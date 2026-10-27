# Rendition branch exposes desktop pane height and scrolling failures

Status: open. The selected controls are now34px tall in40px rows; the old shell sizing/layout still assumes the smaller fields.

Evidence: original-shell-layout.browser.spec.ts fails3/17 cases in build/test-logs/20261027-042241-3023676.log: bottom-panel height after reload differs397.828125 versus380.4375; the stable-height guard expects less than240 but observes380; Advanced overflows horizontally at the tested short window (scrollWidth1149/clientWidth1140). No tests are skipped or relaxed.

The first comparison also caught a clipped frequency control in the175px sidebar. A general ancestor-clipping test fails against the frequency input, both spinner buttons and Hz. A300px minimum expanded sidebar and no space for its absent label/cues fix the two targeted containment cases at1280/1024, while keeping the standard control sizes. This is provisional: the wider sidebar reduces graph width and influences hidden-pane wrapping, so the full shell needs adaptation before all changes can be called beneficial.

Open work: adapt parent columns to the new control widths; check all control edges against their own rows and clipping ancestors; restore stable natural pane height; preserve access to all controls in short windows. Update the full-page comparisons and request Gemini visual criticism after repair.

## Gemini preliminary visual criticism

Read-only Gemini4 Argon High review completed successfully after directly inspecting all six PNGs. Full report: build/ui-contract/rendition-branch/closed-box/gemini-review.txt. Verdict: not ready for signoff or deployment.

Findings to investigate individually, rather than accepting approximate screenshot coordinates as measurements:

- The Alignment link collides with the box diagram. Visually apparent in the retaken desktop picture; existing per-field internals checker excludes this sibling link/diagram collision. Add a general sibling-content test.
- The bottom-pane collapse control keeps its old horizontal offset inside the widened sidebar. Add a boundary-anchor test and fix its position.
- The chamber header/row containment needs measurement; Gemini claims both header overflow and a protruding Fsc cue. Verify exact DOM edges before treating each claim as fact.
- Graph area shrinks and the blank bottom band grows. This agrees with the recorded pane-height failures; Gemini's approximate area/pixel numbers are not accepted as exact DOM measurements.
- Qtc's unitless spinners/model cue sit left of those on unit-bearing rows. This follows the current compact reference's omitted unit slot; the recommendation to retain an empty unit placeholder is a design criticism of the reference, not approval to invent a new rendition. Keep tracked for a mixed-group catalogue decision.
- Phone right-edge spacing is tight. Check320/360/374 widths and simultaneous DQ/unit/spinner/model states, including long unit glyphs, rather than inferring actual clipping from appearance alone.
- DQ comes after the value/unit in DOM order but is positioned left by the grid. DOM order by itself does not establish a visual bug. Existing catalogue both-cue tests check left placement; real DQ-bearing pages and keyboard reading order need explicit proof.

No finding is waived by the earlier empty issue arrays. The next conformance layer must measure group alignment, parent row containment, link/diagram intersections and pane control anchors in addition to individual field paint.

## Current measured state after repairs

The Alignment collision/header bounds and stale splitter anchor have both passed new regressions (043715). Full-control row containment now passes the catalogue and existing phone pages; the deliberately narrowed row proves the oracle detects outward controls (043829 red,043928 green33 cases). Label typography was still14px; an independent reference test failed13px-versus14px (045202), then passed with13px Arial applied.

The tall Driver explanation was moved below its fields across the full pane; legacy extra wrapper margins were removed because the reference40px row already has vertical spacing. The stored-height test now preserves other view settings and its reload equality passes. The latest full shell/reference run045354 has29 passes and2 failures: PR pane247px versus226px for other types; Vented scrollWidth1112 versusclientWidth1057 in the short-window fixture. Advanced no longer fails after the reference label correction. The under240px and equal-height assertions are intact.

The attempted readonly-only environment selector was removed: actual sound speed/density defaults are writable, and making them readonly to save space would be wrong. The two remaining real parent-layout failures and the full nonnumeric/intrinsic-state migration are still open. The published pictures and Gemini report intentionally retain the earlier captured snapshot until the next complete retake. They are not claimed to depict the latest two geometry repairs.
