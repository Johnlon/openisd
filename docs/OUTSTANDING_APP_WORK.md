# Outstanding app work (2026-10-09)

App changes only; infrastructure is not listed. "Landed" means on `origin/main`; users get a change
when `release` moves, after a green post-land full run.

| Item | State | Owner | Bug / task |
|---|---|---|---|
| PR added mass: a clear gives 0, tuning calculated | Built, tests pass, not landed | maryu | `bugs/archive/BUG_20261009_pr-added-mass-can-be-cleared-to-blank.md` |
| Port diameter / height / area: a clear gives a 50 mm round port (or a slot sized from the driver) | Being built, test first | maryu | same bug file, John's rulings |
| Port width: a clear gives the driver's Dd | Being built | maryu | same |
| PR count and driver count: a clear gives 1 | Being built | maryu | same |
| Rg: a clear goes back to 0.1 ohm | Being built | maryu | same |
| Readings as Usable or Rejected: schema, `.wdr` import, VCCon, converter, UI shows the printed text | Bug filed, not started | bob | T017, `bugs/archive/BUG_20261008_non-numeric-reading-is-dropped-or-refused.md` |
| `selectOrigin`: majority means more than half of the survivors; Rejected readings filtered first; the doc comment is the one statement of the rule | Not started | bob | T018 |
| Schema doc comment with examples (Sd "N/A", "banana", "143c cm²", a field nobody printed, "21 Hz"); `docs/FIELD_REFERENCE.md` links to it | Not started | with T017 | same bug file |
| Chart click before the first draw is dropped (`GraphPanel.vue:106`) | Bug filed, not fixed | unassigned | `bugs/archive/BUG_20261009_chart-click-before-first-draw-is-dropped.md` |
| Per-coil impedance check in `corroborate()` | Not started | unassigned | |
| Clears not yet ruled by John: PR and vented volumes, bandpass / ABC values, Ql / Qa / Qp / Qicl, port end correction, filters | Waiting on John | John | sweep in the added-mass bug file |
| Driver categories and `driver_type` list | Separate worker | not maryu | |

## Open bug files (gone over 2026-10-09)

App bugs, not in the table above:

| Bug file | Symptom | State |
|---|---|---|
| `BUG_20261007_advanced-link-opens-every-chamber-losses.md` | On a two-chamber box (4th-order bandpass, 6th-order bandpass, ABC) each chamber panel's "Advanced" link opens every chamber's losses | OPEN; bob's bp6 area, check whether bp6 steps 9-12 closed it |
| `BUG_20261007_bp6-abc-box-volumes-show-zero.md` | New 6th-order bandpass or ABC project: Vb (rear) and Vf (front) show 0, Frc and Ffc blank | OPEN; same check |
| `BUG_20261007_bp6-abc-front-tuning-edits-the-vented-box.md` | On 6th-order bandpass / ABC the Front chamber tuning box (Ffc) shows and edits the vented box's tuning | OPEN; same check |

Infrastructure bugs (not app work, listed so none is lost):

| Bug file | State |
|---|---|
| `BUG_20261007_ci-fails-on-fixtures-from-winisd-drivers.md` | Closes when T022 (pinned driver snapshot) lands |
| `BUG_20261009_wsl-mirrored-route-churn-aborts-browser-specs.md` | Fix is the Windows-side .wslconfig change (NAT networking), with John; 0 flaps since |
| `BUG_20261009_post-land-unit-red-skips-browser-specs.md` | Fixed by T020; mark resolved |
| `BUG_20261009_land-commit-subject-says-work-in-progress.md` | Fixed by T021; mark resolved |
| `BUG_20261007_browser-processes-die-mid-suite.md` | OPEN; probable cause tools' watchdog killing Chrome |
| `BUG_20261007_installed-hooks-are-untracked-copies-and-drift.md` | OPEN, fix later |
| `BUG_20261007_shared-main-moved-under-a-running-commit-hook.md` | OPEN, fix later; land.sh and fast hooks probably end it |

Landed today: vent pair (T016, bob), lap host (T019, bob).
