# Classic (WinISD) skin — review

Fidelity and functional review of the `classic` shell against the real WinISD
0.7.0.950 reference (`docs/winisd/*.png`, principally
`view_1_driver_drivers_standard.png`).

Comparison basis: live app screenshot `build/live-classic.png` (re-shot against
the running dev server, matches the committed state) vs. the WinISD reference
images. Code references are to the current tree.

## Severity summary

| #   | Issue                                              | Kind             | Severity |
| --- | -------------------------------------------------- | ---------------- | -------- |
| 1   | Filters don't affect the graph                     | Functional (bug) | High     |
| 2   | Color picker is inert                              | Functional (bug) | High     |
| 3   | Advanced & Project tabs are empty                  | Functional (gap) | High     |
| 4   | Settings / Options button does nothing             | Functional (gap) | Medium   |
| 5   | Layout is a ruled 4-quadrant grid                  | Fidelity         | High     |
| 6   | Plot area too short (should be ~75% of height)     | Fidelity         | High     |
| 7   | Trace only fills top ~30% of plot (Y autoscale)    | Fidelity         | High     |
| 8   | Cursor Hz/dB readout shows em-dashes               | Fidelity         | High     |
| 9   | Black readout box on the white chart               | Fidelity/bug     | Medium   |
| 10  | In-plot F3/F6/F10 legend clutter                   | Fidelity         | Medium   |
| 11  | Trace thin & blue (WinISD: thick yellow-green)     | Fidelity         | Medium   |
| 12  | Toolbar icons flat/mono; wrong speaker glyph       | Fidelity         | Low      |
| 13  | Chart selector is a bordered web `<select>`        | Fidelity         | Low      |
| 14  | Brand/Model greyed; missing cross-section art      | Fidelity         | Low      |
| 15  | Non-WinISD additions (compare button, skin picker) | Fidelity         | Low      |

## Functional defects

### 1. Filters don't affect the graph — High

Editing a filter's `fc`/`Q`, or adding/removing a filter, does not redraw the
curve. The engine itself is fine — `sweep()` applies the chain at
`packages/engine/src/sweep.ts:62` (`applyFilters(f, P.filters)`). The break is in
the store's reactivity:

- `syncedP` is a computed that shallow-spreads params:
  `const p = { ...state.P, eg };` (`packages/ui/src/store.ts:108`).
- The spread only reads the top-level `state.P.filters` **array reference**; it
  never iterates the array or reads any `filter.fc` / `filter.Q`.
- The re-sweep is driven by `watch([driver, syncedP, () => state.box], …)`
  (`store.ts:127`). Because `syncedP` never took a reactive dependency on nested
  filter values or on the array's length/indices, mutating `state.P.filters[i].fc`
  (FiltersPanel, e.g. `FiltersPanel.vue:35`) or `push`/`splice`
  (`FiltersPanel.vue:13,17`) does **not** recompute `syncedP` → the watcher never
  fires → no re-sweep.

Tell-tale symptom of exactly this cause: filter changes _do_ appear the moment
some other input forces a re-sweep (change the driver, box, or a T/S param), which
re-reads the now-mutated `filters` array. So filters are computed correctly but
never trigger their own redraw.

Fix direction: make `syncedP` depend on filter contents — e.g. snapshot the
filters into the returned params (`p.filters = state.P.filters.map(f => ({ ...f }))`,
the same deep-copy already done in `pinCompare` at `store.ts:156`), which forces
the computed to read every filter field and thus track it. Add a red→green test in
the engine/store suite that edits a filter and asserts the sweep output changes.

_Scope note: this is a shared-store bug, not classic-specific — it affects any
skin that edits `state.P.filters`._

### 2. Color picker is inert — High

The classic "Color" control is a static display, not a picker:

```
<div class="cl-color" …><span class="cl-sw" :style="{ background: DPAL[0] }"></span>Color</div>
```

(`ClassicShell.vue:170-172`). It has no `@click`, no `<input type="color">`, and
binds to the hardcoded `DPAL[0]`. In WinISD the "Color" button opens a chooser and
sets the current design's trace colour. There is **no** colour-picker component
anywhere in the app (`grep` for `ColorPicker` / `input type="color"` → none), so
per-design trace colour is unimplemented app-wide; the classic skin exposes a
control that implies otherwise.

Fix direction: add a real colour control (native `<input type="color">` is enough)
writing a per-design colour into the store, and thread it into `currentDesign.color`
instead of `DPAL[0]`.

### 3. Advanced & Project tabs are empty — High

The classic tab rail lists `Driver, Box, Passive Radiator, Filters, Signal,
Advanced, Project` (`ClassicShell.vue:40`), but only the first five have panels.
`Advanced` and `Project` fall through to the catch-all:

```
<div v-else class="cl-todo">The <b>{{ projectTab }}</b> tab isn't modelled in OpenISD yet.</div>
```

(`ClassicShell.vue:224`). No `AdvancedPanel` / `ProjectPanel` components exist
(`ls packages/ui/src/components` → none), so selecting either tab shows only a
faint grey italic "not modelled" line — reads as blank. WinISD's Advanced holds
driver advanced params and Project holds project-level settings; both are populated.

Fix direction: either build the two panels, or (short term) hide the two tabs from
the rail so the skin doesn't advertise dead destinations.

### 4. Settings / Options button does nothing — Medium

_(Interpreting "settonhs" as the Settings/Options button — confirm if you meant
something else.)_ The wrench/Options toolbar button is rendered dimmed and inert:

```
<span class="cl-ico cl-dim" title="Options — not yet in OpenISD"> … </span>
```

(`ClassicShell.vue:111-113`). It's a `<span>`, not a button, with no handler.
WinISD's wrench opens the Options dialog (`docs/winisd/options_general.png`,
`options_plot_window.png`). Currently there's nothing behind it.

Fix direction: either wire an options dialog, or drop the icon until there's a
destination (leaving a visibly-dead control hurts more than omitting it).

## Fidelity defects

### 5. Layout is a ruled 4-quadrant grid — High

`ClassicShell.vue:269` lays the body out as a rigid 2×2 grid:

```css
.cl-body {
  display: grid;
  grid-template-columns: 322px 1fr;
  grid-template-rows: 1fr auto;
}
```

and then draws structural rules on the cells — `.cl-tl`/`.cl-bl` both get
`border-right` (full-height vertical line) and `.cl-bl`/`.cl-br` both get
`border-top` (full-width horizontal line) (`store` styles lines 270-273). The two
rules cross into a `+` that quarters the window, and the grid forces the left rail
to split at the same row as the graph/form split.

WinISD has **no** structural divider rules at all — the layout is freeform
whitespace, borders appear only on individual controls (the Projects list-box, the
plot frame, each input). Critically the left rail (Projects → Signal Generator →
Project tabs) is one continuous column, and the graph/params split on the right
lines up with nothing on the left.

Fix direction: two columns (left rail | right column), each an independent flex
column; drop the crosshair borders; separate with whitespace only.

### 6. Plot area too short — should be ~75% of height — High

The graph sits in the `1fr` top row while the driver form is the `auto` bottom row
(`grid-template-rows: 1fr auto`, `ClassicShell.vue:269`). The form's natural height
(~430px) starves the graph to ~48% of the body; WinISD gives the plot ~75%.

Fix direction: give the plot a fixed majority — `grid-template-rows: minmax(0,3fr)
minmax(0,1fr)` — and let `.cl-br` scroll internally.

### 7. Trace only fills the top ~30% of the plot — High

Even inside its box, the SPL curve hugs the top and leaves a large empty band
below, because the Y auto-scale window is loose (coarse 20 dB steps, e.g.
`-40 … 80`). WinISD uses a tight window (`42 … 102`, gridded every 2 dB) so the
trace fills the panel. Combined with #6 the plot looks doubly starved.

Fix direction: tighten the SPL auto-scale to fit the visible curve with a modest
margin (the fit logic is in `packages/ui/src/utils/series.ts`, SPL branch ~lines
30-45).

### 8. Cursor Hz/dB readout shows em-dashes — High

The top-right readout renders `— Hz` and a blank second line until the cursor is
placed (`ClassicShell.vue:125-128`). WinISD always shows live values
(`38.01 Hz` / `-9.896 dB`). Empty dashes are the most obvious "not the real thing"
tell. Seed it with the pinned/default frequency so it's never blank.

### 9. Black readout box on the white chart — Medium

The in-chart cursor box `.gread` (`GraphPanel.vue:348`) is styled with a hardcoded
near-black background at `packages/ui/src/style.css:33`:

```css
.gpanel .gread { … background: rgba(10,14,20,.82); … }
```

Correct for the dark modern skin, wrong on the white classic chart — a black box
top-right of the plot, with text in `--fg` (dark in classic) → unreadable, and
un-WinISD (WinISD shows plain dark text, no box).

Fix direction: make it a variable — `background: var(--readout-bg, rgba(10,14,20,.82))`
— and set `--readout-bg` light in `.classic-root`, matching the existing
`--chart-bg` / `--chart-grid` theming pattern (no fork).

### 10. In-plot F3/F6/F10 legend clutter — Medium

The classic chart stamps `SPL / F3 = 36 Hz / F6 = 32 Hz / F10 = 29 Hz` as dashed
lines and a text legend in the top-left over the plot. WinISD's reference has none
of this — a single clean trace. Remove it (or move it out of the plot) for the
classic skin.

### 11. Trace thin and blue — Medium

WinISD's default trace is a thick yellow-green; ours is a thin blue line
(`DPAL[0]` / `TABS` SPL colour `#4fb0ff`, `series.ts:9`). Internally consistent
with our Color swatch, but the default reads wrong and the stroke is too light.

### 12. Toolbar icons flat/mono; wrong speaker glyph — Low

Icons are flat line-art (`ClassicShell.vue:95-116`) vs. WinISD's full-colour Win32
glyphs. The "choose driver" icon is a concentric target/ring, not a speaker-driver
silhouette. WinISD also has dropdown carets on both the open-file and info buttons;
we have neither.

### 13. Chart selector is a bordered web `<select>` — Low

The chart-type control is a bordered `<select>` reading "SPL response"
(`ClassicShell.vue:118-124`). WinISD is a borderless toolbar button reading the
short "SPL" with a caret menu; ours reads as a form control.

### 14. Brand/Model greyed; missing cross-section art — Low

Brand/Model are rendered `readonly`/greyed (`ClassicShell.vue:179-180`); WinISD's
are active white inputs. The parameter area is faithful otherwise, but WinISD's
small driver cross-section diagram is only roughly approximated (`cl-glyph`,
`ClassicShell.vue:207-209`).

### 15. Non-WinISD additions — Low

"+ Add current to comparison" (`ClassicShell.vue:146`) and the "SKIN" picker
top-right (`SkinPicker`, `ClassicShell.vue:129`) are our features, absent from
WinISD. Fine as product; they're the two most out-of-place elements if strict
fidelity is the goal.

## Suggested order of work

1. **#1 Filters reactivity** — real correctness bug, shared store, test-first.
2. **#5/#6/#7** — layout restructure + plot height + Y autoscale (one pass; they
   compound).
3. **#8/#9/#10** — cursor readout live + themed light + drop in-plot legend.
4. **#2/#3/#4** — colour picker, empty tabs, options button (decide build vs.
   hide).
5. **#11-#15** — icon/trace/field polish.

## Further observations (direct `view_1_driver_drivers_standard.png` diff)

Additional gaps found comparing the committed classic against WinISD's actual Driver
view. Some sharpen items above; the numbering continues from the table.

| #   | Issue                                                     | Kind             | Severity |
| --- | --------------------------------------------------------- | ---------------- | -------- |
| 16  | Chart X axis starts at 1 Hz (WinISD starts at 10 Hz)      | Fidelity         | Medium   |
| 17  | Left rail too wide — 322px vs WinISD ~180–200px           | Fidelity         | Medium   |
| 18  | Advanced options greyed "not modelled" vs WinISD active   | Fidelity/honesty | Medium   |
| 19  | Placement radios are default HTML, not WinISD filled-blue | Fidelity         | Low      |
| 20  | Toolbar has 2 save variants; WinISD shows 3               | Fidelity         | Low      |
| 21  | Y-axis label/grid density coarse vs WinISD every 2 dB     | Fidelity         | Medium   |

### 16. Chart X axis starts at 1 Hz — Medium

The classic plot's X axis runs `1, 2, 5, 10, 20 …`; WinISD's starts at **10 Hz**
(`10, 20, 50, 100, 200, 500`). Sub-10 Hz decade is wasted width and reads wrong.
The range is the shared `state.P.fmin`/`fmax` — give classic a WinISD-style default
(fmin 10) without changing modern's default.

### 17. Left rail too wide — Medium

`.cl-body { grid-template-columns: 322px 1fr }` (`ClassicShell.vue`). WinISD's left
column (Projects list + Signal Generator + Project tab rail + Color) is ~180–200px —
noticeably narrower, giving the plot more width. Distinct from #5 (which is about the
crosshair border rules): even without borders, 322px is too wide. Narrow to ~200px and
tighten the Projects list / rail / Color to match.

### 18. Advanced options greyed vs WinISD active — Medium

WinISD's Driver tab shows **Voice coil temp rise** (0.00 K), **Voice coil resistance
TC** (3.9000 · 1000/K) and **Added mass to cone** (0.00000 kg) as **active white
inputs**. The classic skin greys them with a "not modelled" affordance because OpenISD
does not model them. This is a genuine **fidelity-vs-honesty** tension: showing live-
looking inputs that do nothing violates the project's "no fake inputs" rule; greying is
honest but diverges from the screenshot. Decision needed — recommend keeping them
read-only/greyed with the honest affordance, and documenting the divergence, rather than
faking function.

### 19. Placement radios not WinISD-styled — Low

Standard / Iso-Barik use default browser radios; WinISD renders filled blue radios
(● Standard). Small CSS polish, classic-scoped.

### 20. Toolbar save variants — Low

WinISD's toolbar has three floppy-family icons (save, save-as/edit, save); the classic
toolbar currently shows save + save-as (two). Add the third to match the icon rhythm.

### 21. Y-axis label/grid density — Medium

Reinforces #7. WinISD labels and gridlines every **2 dB** across a tight `42…102`
window, so the plot reads as a dense engineering grid. `canvas.ts` `niceTicks` gives a
handful of coarse ticks. A classic (WinISD) tick mode with a fixed ~2 dB step would
match — a per-skin option on the shared renderer, default off so modern is unchanged.

### Cross-cutting

The P1/Medium chart items (#10, #11, #16, #21, plus #7) all need the shared
`GraphPanel` / `series.ts` / `canvas.ts` to accept a per-skin **`winisd`/`minimal`
chart mode** (bare thick yellow trace, no reference legend, dense 2-dB grid, 10 Hz
start). That single seam is the biggest fidelity lever and must default off so the
modern skin is byte-for-byte unchanged.
