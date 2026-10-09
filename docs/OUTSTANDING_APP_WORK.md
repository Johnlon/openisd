# Outstanding app work (2026-10-09)

App changes only; infrastructure is not listed. "Landed" means on `origin/main`; users get a change
when `release` moves, after a green post-land full run.

| Item | State | Owner | Bug / task |
|---|---|---|---|
| PR added mass: a clear gives 0, tuning calculated | Built, tests pass, not landed | maryu | `bugs/BUG_20261009_pr-added-mass-can-be-cleared-to-blank.md` |
| Port diameter / height / area: a clear gives a 50 mm round port (or a slot sized from the driver) | Being built, test first | maryu | same bug file, John's rulings |
| Port width: a clear gives the driver's Dd | Being built | maryu | same |
| PR count and driver count: a clear gives 1 | Being built | maryu | same |
| Rg: a clear goes back to 0.1 ohm | Being built | maryu | same |
| Readings as Usable or Rejected: schema, `.wdr` import, VCCon, converter, UI shows the printed text | Bug filed, not started | bob | T017, `bugs/BUG_20261008_non-numeric-reading-is-dropped-or-refused.md` |
| `selectOrigin`: majority means more than half of the survivors; Rejected readings filtered first; the doc comment is the one statement of the rule | Not started | bob | T018 |
| Schema doc comment with examples (Sd "N/A", "banana", "143c cm²", a field nobody printed, "21 Hz"); `docs/FIELD_REFERENCE.md` links to it | Not started | with T017 | same bug file |
| Chart click before the first draw is dropped (`GraphPanel.vue:106`) | Bug filed, not fixed | unassigned | `bugs/BUG_20261009_chart-click-before-first-draw-is-dropped.md` |
| Per-coil impedance check in `corroborate()` | Not started | unassigned | |
| Clears not yet ruled by John: PR and vented volumes, bandpass / ABC values, Ql / Qa / Qp / Qicl, port end correction, filters | Waiting on John | John | sweep in the added-mass bug file |
| Driver categories and `driver_type` list | Separate worker | not maryu | |

Landed today: vent pair (T016, bob), lap host (T019, bob).
