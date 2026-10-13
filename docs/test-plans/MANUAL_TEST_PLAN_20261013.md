# Manual test plan, next release (13 Oct 2026)

Build under test: snapshot **20261013T1911Z** at https://openisd.app/snap/20261013T1911Z/ (phone and desktop). The live release stays v20261013T1842Z until this passes.

Before you start, on each device: open the snapshot URL, close the tab, open it again (the second open runs the new worker). About must show "Snapshot 13 Oct 2026, …". If it shows an older stamp, open it once more.

Report: one line per failure, "step N: what you saw". For anything odd, menu → Diagnostics → Copy diagnostics, paste it.

Legend: P = phone (Chrome Android, Mobile skin), D = desktop (Original skin).

## 1. Boot and version (T066, T070)

| # | Where | Step | Expect |
|---|---|---|---|
| 1.1 | P, D | Open the snapshot URL | App loads, no loading hang |
| 1.2 | P, D | Menu → About | Versions section: "Snapshot 13 Oct 2026, hh:mm", button **All releases**, link **Snapshot builds** (snapshot build only) |
| 1.3 | P, D | Tap All releases | https://openisd.app/v/ opens, lists 1438Z, 1646Z, 1709Z, 1842Z |
| 1.4 | P | Open http://lap:4173/ (local preview, if running) | App loads over plain http (used to hang) |

## 2. Diagnostics dialog (T071)

| # | Where | Step | Expect |
|---|---|---|---|
| 2.1 | P, D | Menu → Diagnostics with nothing wrong | Title **Diagnostics**, text "Nothing to report…", buttons Copy diagnostics / Dismiss |
| 2.2 | P, D | Copy diagnostics | Clipboard holds a report with "stored keys" and sizes |

## 3. Saving and backups (T075, T076)

| # | Where | Step | Expect |
|---|---|---|---|
| 3.1 | P, D | Open a project, change volume, Save | Saves with no "Browser storage is full" |
| 3.2 | P, D | Options → Backups | List shows the whole-store backups with date and size; sizes well under 1 MB each |
| 3.3 | P, D | Copy diagnostics after 3.1 | Each `openisd_backup_…` entry is smaller than `openisd_projects` + `openisd_open_sessions` + drivers together, never 3× |
| 3.4 | P, D | Close the app, reopen | All projects and My Drivers still there |
| 3.5 | D | Make a change, do not save, reload | Unsaved work handled as before (no regression) |

## 4. Mobile chart list and axes (T077, T082)

| # | Where | Step | Expect |
|---|---|---|---|
| 4.1 | P | Graph tab, tap the chart name button | List opens |
| 4.2 | P | Tap on the chart below the list | List closes, selected chart unchanged |
| 4.3 | P | Open list, tap a chart name | That chart shows alone, list closes |
| 4.4 | P | Open list, tick two boxes, tap the name button | List closes, 2 charts stacked |
| 4.5 | P | 2+ charts per screen; drag up/down on a chart's left axis numbers, in its top third, middle, bottom third | Range stretches (top/bottom) or moves (middle); the page does not scroll |
| 4.6 | P | Drag up/down on the bottom frequency numbers | Page does not scroll |
| 4.7 | P | Swipe on the plot area itself | Page scrolls to the next chart |
| 4.8 | D | Drag left axis and bottom axis with the mouse in each zone; double-click an axis | Zoom/move as before; double-click resets |

## 5. Mobile Box tab (T074)

| # | Where | Step | Expect |
|---|---|---|---|
| 5.1 | P | Box tab, box type Vented | No line "Vents and enclosure details … are on the Vented tab"; tab bar shows a **Vented** tab |

## 6. F3 and F10 on the transfer function chart (T084, T093)

| # | Where | Step | Expect |
|---|---|---|---|
| 6.1 | D | Chart menu → Transfer function magnitude, hover the chart | Readout has a second line "F3 .. Hz  F10 .. Hz" |
| 6.2 | D | Right-click the chart | Menu lists **Jump to F3** and **Jump to F10** under the peak/trough items |
| 6.3 | D | Click Jump to F3, move the mouse away | Cursor stays on the F3 frequency; readout's first number equals the F3 figure |
| 6.4 | D | Right-click, Jump to F10 | Cursor moves lower in frequency |
| 6.5 | D | SPL and Impedance charts | No F3/F10 line, no Jump items |
| 6.6 | D | A flat design that never falls 10 dB | "F10 not reached", its Jump item greyed |
| 6.7 | P | Transfer function chart: tap to pin the cursor; long-press for the menu | F3/F10 line visible? Menu appears? **Untested by anyone, record what happens** |

## 7. Usage stats (T072, T092, T102)

Dashboard: on the private links page. Top line says "You are viewing from visitor xxxxxxxx".

| # | Where | Step | Expect |
|---|---|---|---|
| 7.1 | P, D | Open the dashboard on the same device and network as the app | Note your visitor key; that Visitors row is yellow, marked "you" |
| 7.2 | P, D | Open the snapshot app, do sections 3 to 6, close the tab, reload the dashboard | Your row's launches +1; Charts viewed lists the charts you looked at; Features used lists whatif / filters / vents / options / diagnostics / export |
| 7.3 | D | Pick a driver from the catalogue, close the tab, reload the dashboard | Drivers picked shows that driver's name |
| 7.4 | P | Same on mobile data instead of wifi | A different visitor key appears (expected: the key follows the network) |

## 8. Regression basics

| # | Where | Step | Expect |
|---|---|---|---|
| 8.1 | P, D | New project, pick a driver, Sealed → Vented → Bandpass | Charts update, no errors |
| 8.2 | P, D | Vented: change vent count and diameter | Vent length and air speed update |
| 8.3 | D | File → Export .owpr, then Import it | Same project back, name kept |
| 8.4 | P | Chrome menu → Install app (or address-bar icon) | Installs; the installed app opens to the same projects |
| 8.5 | P, D | Options → change a unit, close, reopen | Unit kept |

## Not in this build

Google Drive sync: groundwork only, nothing visible. Developer label with commit time: dev builds only.
