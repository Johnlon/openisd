# Fixed unit backgrounds hide the borders of phone values

**Status:** FIXED IN T607 WORKTREE — live Driver defect reproduced; not deployed.

## Same-project comparison

The same complete-driver project, switched to Closed, at 374×705 on production
`v20261025T2233Z` and test `v20261026T1705Z`. Served JavaScript contains those build IDs.
Captures and DOM records: `build/ui-contract/driver/` in T607.

On test's Driver page the Re value box loses its top and bottom outline underneath the white
fixed Ω unit. Production keeps the outline visible. Test also expands readouts from 170px to
260px and moves their units 90px right, using the unused stepper space. That extra readout
space is useful, but does not justify destroying the surrounding border.

## Cause and why tests missed it

The value span still declares a solid 1px border. The separate unit span sits above it in the
same grid row, at the full 34px height. Fixed units have an opaque white background and no
border of their own. Their paint covers the value's top and bottom border. A computed-style
check of the value alone would therefore pass. The row sweep checks height, left edges,
padding, containment and overflow; none establish that the declared border is actually visible.

The unit-affordance audit explicitly expects a white fixed-unit background, but does not check
whether that background obscures a required field border. Existing checks of an individual
editable input's border style do not prove every readout's outline remains visible.

## General regression

Extend the shared field checker with a border-perimeter test. Require the declared border,
scroll the control into view, then check the stack of elements at samples along each edge.
A joined unit may supply the visible border itself. An opaque borderless sibling covering the
edge must fail even though the underlying value's computed border remains 1px solid.

First prove failure on Driver. Then apply the unchanged check to the other listed screens and
Driver Editor tabs, before inspecting those screenshots or changing source.

## Red evidence and generalisation

The live checker passes production's five Driver readouts and fails test's Re top/bottom
edges, matching the screenshot. `build/test-logs/20261026-200437-2293859.log` reproduces
that same failure in the worktree before the border fix.

The broad sweep (`20261026-200530-2334294.log`) also detects covered edges on phone Signal,
Box's Velocity limit, Advanced, and Driver Editor Parameters/Advanced. That first sweep
also exposed checker/setup faults: background controls beneath dialogs were included,
desktop Edit's pencil prefix was missing from the locator, and fractional hit testing could
return an adjacent chip outside the sample point. Those were corrected using foreground
dialog scope and actual rectangle containment, without removing the required border checks.
The editor's direct-input General rows were added to the recognised inventory.

`20261026-201142-2368371.log` then verifies the checker corrections: wizard cases, the
adjacent desktop Frc chip, and desktop General pass; the real Driver, Advanced and phone
Editor Parameters defects still fail. Only after that run is the border source changed.

## Acceptance

- The Driver Re outline defect fails before any border fix.
- Use the same detector on production and test and record any pre-existing production issues.
- Run across the remaining screens and Driver Editor, keeping newly detected issues visible.
- Preserve the useful wider readout while restoring a continuous outer border.
- Verify red-to-green; compare final captures with production and justify every difference.

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
