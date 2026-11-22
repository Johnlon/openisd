# Release test, 15 Oct 2026

Build: https://openisd.app/test/ · label in About "test · Oct 15 15:42Z" (release candidate, snapshot 20261015T1542Z); the toolbar no longer shows it
P = phone, D = desktop. Sync on both, signed in as the same Google account.

## 1. Boot
| # | Where | Step | Expect |
|---|---|---|---|
| 1.1 | P, D | Open https://openisd.app/test/ | App loads; desktop toolbar fits the window at 1880 and 1280 px, no scroll bar |
| 1.2 | P, D | Menu → About | "test · Oct 15 15:42Z" and "Running from https://openisd.app/test/" |

## 2. Data survives
| # | Where | Step | Expect |
|---|---|---|---|
| 2.1 | P, D | Open a project, change Volume, Save, close the tab, reopen /test/ | Project listed, Volume kept |
| 2.2 | P, D | Menu → Diagnostics → Copy diagnostics, paste | "openisd_projects" under 100 KB per 10 projects; no "dq_calculated" in any key |

## 3. Cloud sync
| # | Where | Step | Expect |
|---|---|---|---|
| 3.1 | D | Save a new project "SyncD" | Status "synced" within 10 s, pending 0 |
| 3.2 | P | Open /test/ (or Sync now) | "SyncD" in Open project |
| 3.3 | P | Edit SyncD Volume, Save | Status "synced" |
| 3.4 | D | Sync now, open SyncD | P's Volume |
| 3.5 | D | Menu → Cloud sync | "Recent activity" list, newest first: ↑ Project "SyncD" sent, ↓ Project "SyncD" received; survives a reload. Diagnostics carries the same lines |
| 3.6 | P + D | Edit the same My Drivers driver on both, then sync both | Banner names the driver and the other device; My Drivers shows it twice, one row "<model> (conflict, 14 Oct 2026, <device>)"; the other device shows the marked copy after its sync |
| 3.7 | P | Airplane mode, Save | "Offline. 1 change not synced"; back online → "synced" |

## 4. Bin
| # | Where | Step | Expect |
|---|---|---|---|
| 4.1 | D | Open project → SyncD → Move to Bin → confirm | Gone from list; Bin (1) |
| 4.2 | P | Sync now → Open project → Bin | SyncD listed, with D's device name |
| 4.3 | P | Restore | Back in P's list; after sync, back in D's list |
| 4.4 | D | Move to Bin → Delete forever → confirm | "The Bin is empty"; after sync, gone from P too |

## 5. Your data tab
| # | Where | Step | Expect |
|---|---|---|---|
| 5.1 | P, D | Options | One tab "Your data"; no Backup or Storage history tab; groups Storage (used of about 5 MB, breakdown, Empty Bin, Delete all backups), Backups ("Keeps the newest 3 backups"), Export / Import |
| 5.2 | D | Back up now ×4 | At most 3 rows of this version |
| 5.3 | D | Row → Restore one project → pick → Restore | "<name> (restored 14 Oct 2026)" in Open project |
| 5.4 | D | Row → Delete → confirm | Row gone |
| 5.5 | P | Options → Your data | Three tabs fit the tab row; rows and buttons fit; no sideways scroll |
| 5.6 | D | Storage → Empty Bin (with one binned project) → confirm | Bin size 0; project gone |

## 6. Files
| # | Where | Step | Expect |
|---|---|---|---|
| 2.3 | P, D | Open project: type part of a name in the search box; switch sort Newest first / Name A–Z | List filters and reorders; footer shows Import, Export all, bin icon "Bin (n)"; no sideways scroll |
| 6.1 | D | File → Export .owpr; File → Import it | Same project back, same name, same numbers |

## 7. Other browsers
| # | Where | Step | Expect |
|---|---|---|---|
| 7.1 | Firefox, DuckDuckGo on P | Open /test/; swipe up, swipe down | Bottom tab bar always on screen, no gap |
