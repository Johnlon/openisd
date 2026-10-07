# BUG_20261007_advanced-link-opens-every-chamber-losses

**Status:** OPEN

## Symptom
On a two-chamber box (4th-order bandpass, 6th-order bandpass, ABC), each chamber panel's "Advanced->"
link opens the same Box losses popup with both chambers' losses in it. In WinISD, each chamber panel's
Advanced-> opens only that chamber's losses.

## Evidence
Checked 2026-10-07:
- Desktop: both links set the same flag, `boxLossesOpen = true` (`OriginalShell.vue:319` and `:341`),
  and the popup loops over every set from `Box.lossGroupsOf`.
- Mobile: a single "Box losses ->" button (`MobileBoxTab.vue:88`) opens every set.
- WinISD: each chamber panel has its own Advanced-> menu listing that chamber's Q values
  (winisd_research `PROBE_FINDINGS.md`, commit e7c754c; John's live test 2026-07-29).

## Cause
The popup state is one boolean, not "which chamber is open". A link carries no chamber.

## Fix
Each chamber's link opens the popup for its own chamber only: the open state names the chamber set
(a typed value from `lossGroupsOf`, not a string), and the popup shows that set. Mobile gets one
button per chamber panel on two-chamber boxes. One-cabinet boxes are unchanged.

## Verification
Browser specs, desktop and mobile: on bp4, bp6 and ABC, the rear link shows only the Rear chamber
rows and the front link only the Front chamber rows; Reset resets only that chamber.
