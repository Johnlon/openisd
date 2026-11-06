# Desktop PR tab: Num. of PRs dropdown is 150 px, not 90 px

Status: fixed in T699 (awaiting landing)

## Symptom
On the desktop Passive Radiator tab the "Num. of PRs" dropdown is 150 px wide. John ruled desktop short dropdowns are 90 px (QO428), as "Num. of drivers" on the Driver tab.

## Evidence
`field-layout-rules.browser.spec.ts` measured the `#og-pr-count` select at 150 px on main (the old test pinned 150).

## Cause
`.pr-controls` sets `--joined-box:150px` for every field in the group (`joined-fields.css`), the number boxes and the count dropdown alike. The Driver tab's 90 px comes from `.short-pick-fields`, which the PR group does not use.

## Fix
Two CSS rules in `joined-fields.css`: the field holding `#og-pr-count` gets `--joined-box:90px` and its pick list `--pick-width:94px`. Number boxes in `.pr-controls` keep 150 (QO433 narrows them later). Phone unchanged. The R4 audit (`fieldLayoutAudit.ts`) now lets a pick list be narrower than the widest box in its column when its text fits.

## Verification
`field-layout-rules.browser.spec.ts`: "Num. of PRs is 90 px, nothing cut off" red before (150), green after; field-visual-contract and visual specs run.
