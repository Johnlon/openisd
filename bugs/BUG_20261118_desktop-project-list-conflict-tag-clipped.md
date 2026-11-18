# BUG_20261118_desktop-project-list-conflict-tag-clipped

**Status:** FIXED in T899

## Symptom
In the desktop Projects list a conflict copy's tag is cut at "conflict, 18 Nov 2026," (full: "conflict, 18 Nov 2026, Linux desktop").
Picture: scratchpad/t892/3-conflict-notice-device-B.png.

## Cause
`OriginalProjectList.vue` `.project-tag` was `white-space: nowrap; flex: none`: wider than the list's row, it ran past it and the row
(`.project-identity`, overflow hidden) cut it. The name beside it wraps (`overflow-wrap: anywhere`).

## Fix
The tag wraps like the name: `white-space: normal; overflow-wrap: anywhere; min-width: 0; max-width: 100%; flex: 0 1 auto`.

## Verification
`project-list-conflict-tag-not-clipped.browser.spec.ts`: failed before (tag right edge 218 px, row edge 189 px), passes after.
