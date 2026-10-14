# Manual test plan, next release (14 Oct 2026)

Build under test: snapshot **20261014T0948Z** at https://openisd.app/snap/20261014T0948Z/ (phone and desktop). The live release stays v20261013T1842Z until this passes.

Before you start, on each device: open the snapshot URL, close the tab, open it again (the second open runs the new worker). About must show "Snapshot 14 Oct 2026, …" and the footer label "Oct 14 09:48Z". If it shows an older stamp, open it once more.

Report: one line per failure, "step N: what you saw". For anything odd, menu → Diagnostics → Copy diagnostics, paste it.

Legend: P = phone (Chrome Android, Mobile skin), D = desktop (Original skin), FF = Firefox Android, DDG = DuckDuckGo Android.

## 1. Boot and version (T066, T070)

| # | Where | Step | Expect |
|---|---|---|---|
| 1.1 | P, D | Open the snapshot URL | App loads, no loading hang |
| 1.2 | P, D | Menu → About | Versions section: "Snapshot 14 Oct 2026, hh:mm", button **All releases**, link **Snapshot builds** (snapshot build only) |
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

## 9. Bottom bar on other browsers (T111, T118)

| # | Where | Step | Expect |
|---|---|---|---|
| 9.1 | FF, DDG | Open the snapshot URL | Bottom tab bar fully on screen on load, no page scroll needed |
| 9.2 | FF, DDG | Swipe up so the browser's address bar hides, then swipe down so it shows | Bottom bar stays glued to the screen bottom both ways, no gap above it, no bar under the browser's own bar |
| 9.3 | P | Same swipes in Chrome | Unchanged |
| 9.4 | FF, DDG | Rotate to landscape and back | Bar still on screen |

## 10. Version label (T113)

| # | Where | Step | Expect |
|---|---|---|---|
| 10.1 | P, D | Read the version label (footer / About) | "Oct 14 09:48Z", the Z present, the time equal to the snapshot stamp, not your local time |

## 11. Chart legend and traces (T106, T114, T116)

| # | Where | Step | Expect |
|---|---|---|---|
| 11.1 | P, D | One project, Transfer function chart | Legend lists the project name first, not "Transfer function", then 0 dB and −3 dB |
| 11.2 | P, D | Two projects open, Transfer function / SPL / Impedance / Group delay | Legend lists "ProjectA", "ProjectB" first, then the dB lines; no chart name after a project |
| 11.3 | P, D | Two projects, click a project row to make it active | The active project's trace is clearly thicker than the other |
| 11.4 | P | Same, legend at the top-left of the chart | Readable, not clipped |

## 12. Phase charts (T115)

| # | Where | Step | Expect |
|---|---|---|---|
| 12.1 | P, D | Transfer phase (or Impedance phase on a design whose phase crosses ±180°) | No solid vertical line at the wrap; a faint dotted segment joins the two ends |
| 12.2 | P, D | A phase chart with no wrap | Nothing extra drawn |

## 13. Edit Driver layout (T122, T125)

| # | Where | Step | Expect |
|---|---|---|---|
| 13.1 | D (Chrome and Firefox) | Open a project, Driver, Edit; visit General, Parameters, Advanced, Dimensions | No horizontal scrollbar on the editor body on any tab |
| 13.2 | D | Editor footer | One thin row Entered / Calculated / Not entered on top; below it Export, Import, Copy to My Drivers at the left and OK, Reset, Cancel at the right |
| 13.3 | P | Edit Driver | Tab titles General, Parameters, Advanced, Dimensions all visible in one row, no sideways scroll |
| 13.4 | P | Editor footer | Legend row (wraps if narrow), then Export/Import/Copy, then OK/Reset/Cancel; nothing past the screen edge |

## 14. Value legend row on other screens (T124)

| # | Where | Step | Expect |
|---|---|---|---|
| 14.1 | D | Open a project | Thin row at the very bottom of the window: Entered / Calculated / Not entered with green, blue, grey swatches, one line |
| 14.2 | D | Open Driver, then What-if? | The same row at the bottom of each panel |
| 14.3 | P | Box, Signal, Enclosure tabs | The row sits between the content and the bottom tab bar |
| 14.4 | P | Driver, Filters, Graph tabs | No legend row |

## 15. Cloud sync, first sign-in (T112, T128, T129, T131, T133, T134)

Only on openisd.app (Google refuses plain http except localhost). Your Google account must be a test user on the consent screen. Same account on both devices. Google shows an "unverified app" warning in Testing; continue through it.

| # | Where | Step | Expect |
|---|---|---|---|
| 15.1 | D | Open the snapshot | Grey cloud icon in the toolbar after Options; menu has "Cloud sync…"; hover says "Sync your work across devices through your Google Drive. Tap to turn on." |
| 15.2 | D | Click the icon | "Cloud sync" dialog: Google Drive section "Cloud sync is off", one explainer line, button **Connect Google Drive** |
| 15.3 | D | Connect Google Drive, allow at Google | Back in OpenISD: "Connecting…", "Syncing…", then "Synced <time>", green icon; dialog shows the account, **Sync now**, **Disconnect** |
| 15.4 | D | Save a project | Within ~3 s the icon shows "1 change not synced", then "Synced <new time>" |
| 15.5 | P | Open the snapshot | Cloud icon in the header; long press shows the same tooltip |
| 15.6 | P | Tap it, Connect Google Drive, same account | "Synced <time>"; the desktop's project is in the list, with My Drivers, favourites and Options |
| 15.7 | P → D | Save a change on the phone; on the desktop switch back to the tab or press Sync now | The change appears |
| 15.8 | P, D | Both "Synced"; phone to airplane mode | Phone icon shows "Offline" |
| 15.9 | P, D | Edit and save the same project on both with different values; phone back online | Phone syncs; icon amber with badge 1; banner "1 item changed on two devices. Both kept." with **View** |
| 15.10 | P | View, then Open | Dialog lists it under "Conflict copies" as "Both versions kept"; Open opens the copy; badge and banner go; list holds the original and "<name> (conflict, <device>, <date, time>)"; nothing lost |
| 15.11 | D | Second launch on a desktop that never connected | "Sync your projects across devices?" with **Turn on** / **No thanks**; Turn on opens the dialog; No thanks hides it for good |
| 15.12 | P, D | Disconnect | Asks "Disconnect Google Drive?"; work stays in this browser and in Drive |
| 15.13 | P, D | Splash and About | Feature list includes "Cloud sync, if you want it" |

Fail if: any error text; sign-in loops back to Google; saved work disappears; "Syncing…" for over a minute.

Known, not blocking: the device in a conflict copy's name is a 32-character code (readable name coming).

## Not in this build

Privacy section on /about and the dialog's privacy lines: coming. Edit Driver tab and background colours: unchanged (no detail given yet). Developer label with commit time: dev builds only.
