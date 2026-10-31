# BUG_20261016_mobile-project-sort-tabs-cramped

**Status:** FIXED (T239)

## Symptom
The phone's Projects list has five sort tabs. At phone width "Largest first" wrapped onto two lines and the
text touched the tab edges (screen-shot regression run shots-regress-20261016, screen 20, mobile).

## Cause
The tabs used the desktop drop-down's long labels ("Last edited", "Oldest first", "Name A–Z", "Driver",
"Largest first") in a row that was allowed to wrap, and the tabs were 40 px tall.

## Fix
- Each sort order in packages/design carries a short label: Newest, Oldest, Name, Driver, Size. The phone
  shows the short label (the long one is its tooltip); desktop keeps the long labels in its drop-down.
- One row of five equal tabs, no wrap, each at least 44 px tall.
- Test: packages/ui/test/ui/mobile-projects-pane.browser.spec.ts checks at 360 and 390 px that no tab
  wraps or overflows and that every tab is at least 44 px tall.
