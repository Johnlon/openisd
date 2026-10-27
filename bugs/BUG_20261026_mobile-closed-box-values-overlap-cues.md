# Closed-box values paint under the WinISD difference buttons on test

**Status:** FIXED IN T607 WORKTREE — live defect reproduced; not deployed.

## Same-project comparison

Captured the same complete-driver fixture project, switched to Closed through the UI, on
production `v20261025T2233Z` and test `v20261026T1705Z`, at 374×705 and 1280×900.
Raw captures and DOM records: `build/ui-contract/closed-box/` in T607.

On the phone, test's Fsc and Qtc digits paint underneath their ≠W buttons. Production's
left-aligned values remain readable. Both sites use the same 170×34 input starting at x=98,
14px left and 44px right padding, and the same cue at x=198.5625–220. Test changes computed
text-align from start to right; that moves the displayed digits into the cue.

Desktop does not reproduce this particular overlap. Its changes include right-aligned
numbers and a grey bordered underlined unit chip. These must be assessed separately rather
than described as fixing the phone overlap.

## Why existing tests missed it

The phone sweep checks row height, input left edges, left padding, chip containment and
selected overflow. All of those facts remain true with the bad text alignment. The
unit/adornment test models input text as its padded content rectangle rather than measuring
the displayed value's glyph positions; that is not an assertion of actual text placement.
Changing or updating a screenshot baseline cannot establish that the new result is beneficial.

The existing unit/adornment audit takes its cases from `visual/screens.ts`. That list includes
all six desktop box types, but the phone's project Box tab uses only the default vented
fixture. It does not open the phone closed-box page with the Fsc/Qtc cues. Thus the very state
that regressed was absent from that audit.

## Red evidence and generalisation

`build/test-logs/20261026-195457-2254328.log`: before UI source changes, the new closed-box
test fails for Fsc (glyphs x=185.99–223, cue x=198.56–220) and Qtc (glyphs x=183.90–223,
same cue range). Desktop passes. Console and network diagnostics are clean.

`build/test-logs/20261026-195611-2257996.log`: the unchanged checker was then applied to
57 other screen cases, without looking at their images. It found two more collisions on
phone Advanced: Sound velocity and Air density text intersects their fixed unit chips.
The other 56 cases pass this particular contract; this does not certify all UI standards.

## Regression test

`field-visual-contract.browser.spec.ts` uses one shared rendered-content measurement for
all recognised field values and compares the value glyph bounds with units, steppers and
warning/deviation buttons. It reports missing recognised field controls instead of silently
omitting rows. First run only the closed-box tests and record the real failure; then apply
the same check to other listed screens without inspecting their screenshots first.

## Acceptance

- The reported phone Fsc/Qtc collision must fail the shared test before any UI source fix.
- Production must be measured by the same checker, with any existing failures recorded.
- Apply the same test across other screens; keep every new failure as an open finding.
- Fix the underlying layout, verify red-to-green, and personally inspect final captures
  against production, accounting for every difference before requesting Gemini critique.

## Implemented resolution and comparison

The general content/border assertions are in `packages/ui/test/fixtures/fieldVisualContract.ts`,
used by `field-visual-contract.browser.spec.ts` across the shared screen list, every phone
box type, all four Driver Editor tabs in both skins, and a populated narrow-phone case.
The final normal-build comparisons are in `build/ui-contract/reviewed-comparison/`
(local v20261026T2119Z), with identical project SHA and verified served build IDs.
Gallery: http://lap:8000/winisd/openisd-t607/build/ui-contract/ .

Fixed labels are transparent, so they preserve both the border and the underlying surface;
this supersedes the first inset-only candidate rejected by Gemini. Clickable chips retain
their divider, mandatory outline thickness, full control height and enough room for their
own unit glyphs. Values follow production's left alignment. The useful wider phone readouts
remain; they no longer trade their visible borders for width. Every final captured view
has zero content and border findings. Final broad verification and independent critique
are recorded in `tasks/T607-progress.md`; original red logs above remain unchanged.


## Fresh live comparison during Argon review,27 October2026

Same project SHA256d7f7694b360561bf2001dcd7ceb884137c4610b37686d7850cd744f7dbb9531b,
phone374×705, Closed Box only, Qtc entered0 then focus moved to the Box tab. Production
v20261025T2233Z and live test v20261026T2106Z are compared in the new immutable gallery
build/ui-contract/closed-box-focus-v1/. Live test still has a serious readability failure:
its right-aligned Qtc0 is covered by the internal model cue; Fsc71.95 also collides with
its cue. The fresh screenshot and Argon's4-image criticism independently identify this.
The branch's outside-cue layout separates the glyphs, but broader proposed appearance is
not approved or deployed by this observation. Current user-facing live test remains wrong.

The focused gallery initially understated this as a different inner cue placement. Caption
corrected to name the hidden0 and obscured Fsc digits explicitly. Its DOM state assertion
(value0) is now expressly distinguished from visual text visibility. Zero JavaScript errors
and the right underlying value are not evidence of readable control content.
