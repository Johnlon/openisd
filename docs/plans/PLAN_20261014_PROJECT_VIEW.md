# Project view — design proposal, 14 Oct 2026

Status: PROPOSED, awaiting John. Scope: everything a user sees to manage projects, both skins.
Rules held: UI display-only (rows, wording, sorting, sizes, conflict logic all in `packages/design` /
hooks); mobile panes are full-screen dialogs with a Close footer; dates "5 Oct 2026, 23:32"; touch ≥ 44 px.

## 1. Today

Two lists exist per skin: **Open projects** (in memory, drawn on the graph) and **Saved projects**
(browser store, the "Open project" dialog). They look unrelated; nothing says a saved project is open.

| Can the user… | Original: Open projects panel | Original: Open project dialog | Mobile: menu "Open projects" | Mobile: Open project sheet |
|---|---|---|---|---|
| Open saved | – | tap row | – | tap row |
| Switch active | click row | – | tap name | – |
| Hide/show trace | checkbox | – | checkbox | – |
| Colour | toolbar "Color" button, active only | – | swatch per row | – |
| Rename | Project tab, Name field | – | Project pane, Name field | – |
| Duplicate | "+ Copy" | – | – | – |
| Close | "✕ Close", active only | – | ✕ per row | – |
| Delete | – | – (maryu adding) | – | – |
| Sort | insertion order | store order | insertion order | store order |
| Search | – | – | – | – |
| Saved time | – | yes | – | yes |
| Driver · box · volume | – | yes (summary) | – | yes |
| Size | – | – | – | – |
| Sync state | header badge only | – | header badge only | – |
| Unsaved mark | yellow row, italic | – | dot | – |
| Import / Export all | toolbar | buttons | menu | button |

## 2. Problems

- No delete anywhere; 35 projects × 22 KB accumulate forever. (Delete in flight: maryu.)
- Saved and open lists are two views of one thing; user cannot see which saved projects are open, or the active one's saved time.
- No duplicate, no colour per row, no close per row on Original; Mobile has colour/close per row but no duplicate. Skins disagree.
- Rename only via the Project details form; no rename from the list.
- Open projects row shows name only: no driver, box, date, size, sync mark.
- Conflict copies "(conflict, Android phone, 14 Oct 2026, 11:05)" will land as plain rows with no way to compare or resolve; the only path is the Cloud sync dialog.
- Hidden trace = strike-through + 45 % opacity; reads as "deleted", not "hidden".
- Colour cycles blindly through a palette; no picker, no way to see the colour on Original rows.
- Nothing scales: no sort, no search, no section heads at 35+ rows; store order is arbitrary.
- Empty states: "No saved project yet" with no next step; "No projects open" offers nothing.
- Unreadable saved records show a name and blank summary with no explanation or action.
- Mobile open-projects rows live inside the hamburger menu: cramped, no touch-size guarantee, closed by any tap.

## 3. Design

One model, two skins: a single **Projects** list of saved projects. An open project is a saved row with
an "open" state (swatch filled, checkbox live). "Open" and "Close" become row states, not separate lists.

### 3.1 Row (both skins; `packages/design` supplies every field as text)

`[●swatch] [☑show] Name (conflict…)  ·unsaved  ☁mark      Driver · Box type · Volume      5 Oct 2026, 23:32   22 KB   [⋯]`

- Name: full, wraps to 2 lines max. Conflict suffix rendered as a grey tag after the name, not in the name text.
- Sync mark: ☁✓ synced, ☁↻ syncing, ☁! conflict, ☁– local only (cloud off → column absent).
- Unsaved: orange dot before name (keeps Original's yellow row tint).
- Hidden trace: swatch hollow + "Hidden" tag; no strike-through.
- Not open: swatch grey outline, checkbox absent; row click = open; already-open row click = make active.
- Unreadable: name + "Could not read" tag; menu offers Export and Delete only.

### 3.2 Original mockup (top-left quadrant, wider than today; column set collapses with width)

```
Projects                              [New] [Import] [Sort ▾] [Search…]
┌─────────────────────────────────────────────────────────────────────┐
│ ● ☑ W5-1138SMF 12L vented ·        ☁✓   Tang Band W5… · Vented · 12.0 L   5 Oct 2026, 23:32   22 KB  ⋯ │  ← active (blue)
│ ● ☐ Sealed try  Hidden              ☁✓   Tang Band W5… · Sealed · 8.0 L    4 Oct 2026, 09:10   21 KB  ⋯ │
│ ○   ND140-PR passive  [conflict, Android phone, 14 Oct 2026, 11:05] ☁!    …   14 Oct 2026, 11:05  23 KB  ⋯ │
│ ○   Old sub                         ☁–   Dayton RSS… · Vented · 60.0 L    2 Mar 2026, 18:40   22 KB  ⋯ │
└─────────────────────────────────────────────────────────────────────┘
35 projects · 770 KB · 2 open                                     [Export all]
```

- ⋯ menu per row: Open / Make active, Close, Show / Hide, Colour ▸ (palette grid + custom), Rename, Duplicate, Export (.owpr), Delete…, and on a conflict row: Resolve….
- Row right-click = same menu. Double-click name = rename inline.
- Sort ▾: Last edited (default), Name, Driver, Size. Search box appears when > 8 rows; filters live on name, driver, box.
- Footer: count, total size, open count; Export all moves here from the dialog.
- The old "Open project" dialog goes; toolbar Open focuses the Search box. "+ Copy" / "✕ Close" buttons become row-menu items.
- Empty: "No projects yet. [New project] [Import]".

### 3.3 Mobile mockup (full-screen pane "Projects", replaces the menu's Open projects section and the Open project sheet)

```
┌──────────────────────────────────┐
│ Projects              [Sort ▾] 🔍│
│ ┌──────────────────────────────┐ │
│ │ ● ☑ W5-1138SMF 12L vented  ⋯ │ │  row ≥ 56 px, two text lines
│ │     Tang Band · Vented · 12 L│ │
│ │     5 Oct 2026, 23:32 · ☁✓   │ │
│ ├──────────────────────────────┤ │
│ │ ○   ND140-PR passive       ⋯ │ │
│ │     [conflict · Android phone│ │
│ │      14 Oct 2026, 11:05]  ☁! │ │
│ └──────────────────────────────┘ │
│ 35 projects · 770 KB · 2 open    │
│ [New project]  [Import]          │
├──────────────────────────────────┤
│              Close               │
└──────────────────────────────────┘
```

- Tap row = open / make active and close the pane. Swatch tap = colour sheet. Checkbox = show/hide (44 px hit).
- ⋯ opens a bottom action sheet: Make active, Close, Show/Hide, Colour, Rename, Duplicate, Export, Delete…, Resolve… (conflict rows).
- Entry points: menu item "Projects" (replaces "Open project…" and the inline Open projects section); empty state "Open project" button; header title tap.
- Search field shown when > 8 rows; sort options as Original.

### 3.4 Delete (both skins; maryu's confirm + sync tombstone)

Confirm dialog: "Delete 'W5-1138SMF 12L vented'? It is removed from this device and from Google Drive. A backup is made first." [Cancel] [Delete]. Open project is closed first; unsaved changes block with the existing close challenge.

### 3.5 Conflicts

- Conflict copy is its own row, tagged, sorted next to its original (same name stem).
- Resolve… dialog: two columns Mine / Theirs, each with device, edited date, driver · box · volume, size; buttons **Keep mine**, **Keep theirs**, **Keep both** (strips tag, renames to "<name> (Android phone)").
- Keep mine/theirs deletes the other via the same Delete path (backup + tombstone). Cloud sync dialog's conflict count links to the list filtered to conflicts.

## 4. Tasks (in order, each user-visible)

| # | Task | Skin | Files |
|---|---|---|---|
| 1 | Design-side `ProjectRow` model: one list merging stored listings + open state, with name, conflict tag, driver/box/volume, edited date, size KB, sync mark, hidden/unsaved/active flags, sort keys, search filter, footer totals. | both | `packages/design/cloud` or new `packages/design/projects/projectRows.ts`; `packages/persistence/src/repos/projectRepo.ts` (size in listing); replaces `packages/ui/src/hooks/storedProjectRows.ts` |
| 2 | Original Projects panel: rows from task 1 with swatch, show, tags, columns, footer, sort, search, row ⋯ menu (open, close, show/hide, colour, rename, duplicate, export, delete); remove Open project dialog. | Original | `packages/ui/src/ui/shells/original/OriginalShell.vue` (new `OriginalProjectList.vue`), `packages/ui/src/hooks/OriginalShell-hooks.ts` |
| 3 | Mobile Projects pane: full-screen `MobileProjectsPane.vue` with Close footer, 56 px rows, action sheet, sort/search; menu and empty state point at it; old menu section and Open project sheet removed. | Mobile | `packages/ui/src/ui/shells/mobile/MobileShell.vue`, new `MobileProjectsPane.vue`, `packages/ui/src/hooks/MobileShell-hooks.ts` |
| 4 | Conflict rows and Resolve dialog (Keep mine / theirs / both) on top of maryu's Delete; Cloud sync dialog conflict count links to the filtered list. | both | `packages/ui/src/hooks/CloudSync-hooks.ts`, new `ConflictResolveDialog.vue` in `packages/ui/src/ui/components`, design-side resolve in `packages/design/cloud` |
| 5 | Colour picker (palette grid + custom) replacing blind cycle in both skins; Original toolbar "Color" button opens it for the active row. | both | `packages/ui/src/logic/presentationState.ts`, new `TraceColourPicker.vue`, both shells |

Dependencies: 2 and 3 need 1; 4 needs maryu's Delete; 5 independent.
