# Outstanding app work — 9 Oct 2026

The one list of OpenISD app work still to do.

Order (lots' recommendation): A, then B starting with drivers other than the W5-1138SMF, then C.

## A. Open bugs (`bugs/`)

| Bug | State |
|---|---|
| BUG_20261009_land-commit-subject-says-work-in-progress | fixed by T021; mark RESOLVED |
| BUG_20261009_post-land-unit-red-skips-browser-specs | fixed by T020; mark RESOLVED |
| BUG_20261009_wsl-mirrored-route-churn-aborts-browser-specs | fixed by NAT networking; mark RESOLVED after one green browser run |
| BUG_20261008_non-numeric-reading-is-dropped-or-refused | T017 in flight |
| BUG_20261007_bp6-abc-box-volumes-show-zero | probably fixed by bp6 steps 1–12; verify |
| BUG_20261007_bp6-abc-front-tuning-edits-the-vented-box | probably fixed; verify |
| BUG_20261007_advanced-link-opens-every-chamber-losses | probably fixed; verify |
| BUG_20261005_no-common-ui-field-component | the remaining number-field conversions |
| BUG_20261007_browser-processes-die-mid-suite | likely the network churn; verify |
| BUG_20261007_driver-browser-ok-spec-click-times-out-under-load | likely the network churn; verify |
| BUG_20261007_ci-fails-on-fixtures-from-winisd-drivers | the pinned driver snapshot (T022) |
| BUG_20261007_installed-hooks-are-untracked-copies-and-drift | later |
| BUG_20261007_shared-main-moved-under-a-running-commit-hook | probably moot under land.sh; verify |

## B. WinISD parity (README "Remaining gaps"; 32 of 184 register cells open)

1. Drivers other than the W5-1138SMF.
2. Filters for 6th-order bandpass and ABC.
3. Amplifier load with Rg 1 Ω for vented, 4th-order bandpass and passive radiator.
4. SPL limited by Xmax, except sealed and vented.
5. Non-default air temperature, pressure and humidity, except sealed and vented.
6. More than one port, and slot ports.
7. Readouts: sealed Fsc and Qtc, vent length, key stats, bandpass Fr and Ff, the maximum-power/Xmax crossover.

## C. Backlog (`BACKLOG.md`)

- Wizard and design:
  - default vent diameter is 0.05 m; WinISD's is 4 in;
  - the alignment picker works only from the wizard;
  - no passive-radiator step;
  - end correction cannot be typed in;
  - no guided driver entry;
  - silent decisions are not explained.
- Charts: frequency presets; draggable panels; dB-per-division setting; drag Vb/Fb on the tuning chart; vent feasibility chart; box schematic.
- Phone: the layout does not fit a phone screen.
- Files: live URL bookmarking (undecided); Unibox import; saved drivers never re-sync with the catalogue; cloud storage; near-duplicate driver check; corpus regenerated-through-bridge check.
- Construction: 3D preview; cut list; STL export.
- Help: onboarding; help content; tutorial project.
- Engineering: `.wdr` round-trip gate in the build; ESLint plugin for the architecture rules; the speakerbox-lite scenario; Chrome DevTools MCP spike; curve-level parity.

## D. In flight

- T017 (non-numeric readings kept), T018 (picker: majority = more than half): bob.
- T022 (pinned driver snapshot): maryu.
