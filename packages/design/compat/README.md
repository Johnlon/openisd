# Compatibility suite

Long-running checks, run rarely and one screen or feature at a time. They are **not** part of the
pre-commit suite or `scripts/health-check.sh`.

Three kinds of check, named by what is compared:

| Kind | Compares | How | Cost | Where |
|---|---|---|---|---|
| OpenISD consistency | OpenISD with itself by two routes: a value loaded from a `.wpr` vs the same value entered by hand | domain setters, no WinISD | seconds | `packages/design/compat/` (this folder), run with `scripts/compat.sh` |
| WinISD consistency | WinISD with itself by two routes: a value loaded from a file vs typed into its UI | the real WinISD under Wine, headless | minutes | `winisd_research/toys/probe_*.py` (see `winisd_research/AGENTS.md`) |
| OpenISD vs WinISD compat | OpenISD against WinISD's own numbers | captured chart points, the parity register | minutes to hours | `docs/research/WINISD_EQUIVALENCE.md`, `winisd_research/runs/` |

A consistency test never needs the other app. It finds linkage bugs: an edit that does not reach the
calculation. A compat test finds calculation differences. When a WinISD consistency test fails,
WinISD has the linkage bug and OpenISD must not copy it.

## Why consistency

The same value entered by hand and loaded from a file should give the same results. When it does
not, an edit is not reaching the calculation. That is one strong signal, not the only one. Found
this way (2026-10-03): in OpenISD, editing a passive radiator's Fs, Vas or Qms did nothing, because
only the `.wpr` import derived Mms, Cms and Rms from them. WinISD has the same kind of bug for the PR
Sd box (`bugs/BUG_20261003_winisd-pr-sd-edit-ignored.md`, found by a WinISD consistency test). The
rule for copying WinISD behaviour is in `CLAUDE.md` ("WinISD controls behave as native WinISD").

## Run OpenISD consistency

    bash scripts/compat.sh --list        # areas and case counts
    bash scripts/compat.sh pr            # one area
    bash scripts/compat.sh pr sealed     # several
    bash scripts/compat.sh all

It prints one markdown table per area and exits 1 if any case disagrees or errors.

| Column | Meaning |
|---|---|
| hand edit moves results | the hand-edited project's sweep or max curves differ from the base project |
| file load moves results | the loaded project's sweep or max curves differ from the base project |
| hand vs load | worst relative difference between the two projects' numbers |
| verdict | `agree` when both move or neither moves and the numbers match to 1e-9; `DISAGREE` otherwise |

A field that moves nothing either way (PR Xmax: only the excursion limit and Max SPL use it) is
`agree`. Read such rows anyway: a field you expect to matter that moves nothing in both columns is
its own signal.

## Add an OpenISD consistency case

Each area is one file in `consistency/areas/`, listed in `areas/index.ts`. A case names the golden
`.wpr` (from `packages/design/test/winisd/fixtures/winisd-parity/goldens/`), the section and key to
change, the new value (different from the file's), and the domain setter the UI uses:

    {label: 'sealed Ql', wprFile: 'sealed-small.wpr', section: 'Box', key: 'Qlr', value: 5,
     hand: (p, v) => p.box.sealed.losses.Ql.set(v)}

Use a value that differs from the file's own, or the case moves nothing and proves nothing.
`wprFile` is relative to the goldens folder, so a fixture beside it is `'../../bp6-w5-1.wpr'`. A field
whose `.wpr` value is text (a filter's `;`-joined params) uses a `TextConsistencyCase`: `rawValue`
instead of `value`, and `hand: (project, engine)` builds the edited value (see `areas/filters.ts`).
A key WinISD writes as a readout and ignores on load (a tuned port's `len`) is a
`ReadoutConsistencyCase` in `readoutCases`: its file route saves the hand-edited project and loads
it back (see `areas/vents.ts`).

## Add a WinISD consistency probe

Copy `winisd_research/toys/probe_pr_sd_edit.py` (a UI edit with chart screenshots before and after)
and run it with `winisd_research/scripts/headless.sh`. Load the same project with the value already
changed to get the file route. Findings go in `winisd_research/PROBE_FINDINGS.md`; differences from
OpenISD go in `docs/research/WINISD_PARITY.md`. A WinISD linkage bug also gets a
`bugs/BUG_*_winisd-*.md` file and a row in the "fixed by default" section of
`docs/research/ACCURACY_IMPROVEMENTS.md`.
