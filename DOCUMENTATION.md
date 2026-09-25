# Documentation index

Every document in this repo, and what it is for. A doc not listed here is invisible to anyone
who does not already know it exists — add new ones as they are written.

Links are served: `http://localhost:8000/openisd/<path>?html` renders Markdown with live
Mermaid diagrams.

## Start here

| Doc                                                                   | What it is for                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [README.md](http://localhost:8000/openisd/README.md?html)             | What OpenISD is, and how to run it                                                                                             |
| [AGENTS.md](http://localhost:8000/openisd/AGENTS.md?html)             | The rules an agent must follow in this repo. Read before changing anything                                                     |
| [ARCHITECTURE.md](http://localhost:8000/openisd/ARCHITECTURE.md?html) | The layering (`UI -> LOGIC -> SERVICE -> domain/STORAGE/io`), module responsibilities, and the numbered Architecture Decisions |
| [HANDOVER.md](http://localhost:8000/openisd/HANDOVER.md?html)         | Where the work stands, for the next session                                                                                    |

## Planning and tracking

| Doc                                                           | What it is for                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [BACKLOG.md](http://localhost:8000/openisd/BACKLOG.md?html)   | Work that is agreed but not started                                                          |
| [WIP.md](http://localhost:8000/openisd/WIP.md?html)           | Work in flight                                                                               |
| [LOG.md](http://localhost:8000/openisd/LOG.md?html)           | The VALUE a change delivered — benefit first. The one sanctioned place for history           |
| [FEATURES.md](http://localhost:8000/openisd/FEATURES.md?html) | What the app does today                                                                      |
| [REVIEW.md](http://localhost:8000/openisd/REVIEW.md?html)     | Review notes                                                                                 |
| `questions.yml`                                               | The decision ledger. Read and write it ONLY through `~/.claude/bin/inbox.py` — never by hand |

## Specifications

| Doc                                                                                     | What it is for                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/spec/SPEC_ENGINE.md](http://localhost:8000/openisd/docs/spec/SPEC_ENGINE.md?html) | What `@openisd/engine` computes, and the formulas it owns                                                                                                                                                      |
| [docs/spec/SPEC_UI.md](http://localhost:8000/openisd/docs/spec/SPEC_UI.md?html)         | What the UI presents                                                                                                                                                                                           |
| [docs/FIELD_REFERENCE.md](http://localhost:8000/openisd/docs/FIELD_REFERENCE.md?html)   | **The help page.** Every driver, radiator, box, loss, vent and environment field — meaning, unit, and where the definition comes from (WinISD's own help, Claus Futtrup's DPC formulas, and our decompilation) |

## Design

| Doc                                                                                                     | What it is for                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [docs/design/WINISD_SCHEMA.md](http://localhost:8000/openisd/docs/design/WINISD_SCHEMA.md?html)         | The `.wdr` and `.wpr` file formats, reverse-engineered. §12 is the machine-verified `c`/`roo` resolution rule |
| [docs/design/DRIVER_ADT_DESIGN.md](http://localhost:8000/openisd/docs/design/DRIVER_ADT_DESIGN.md?html) | The driver model's design                                                                                     |
| [docs/design/STATE_MODEL.md](http://localhost:8000/openisd/docs/design/STATE_MODEL.md?html)             | Ground / committed / what-if layering, and what each means                                                    |

## Plans

Active plans in [docs/plans/](http://localhost:8000/openisd/docs/plans/). Completed or superseded
plans live in [docs/plans/archive/](http://localhost:8000/openisd/docs/plans/archive/) — kept for
history, never for direction.

| Plan                                                                                                                                       | What it is for                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md?html)     | Sweep diagnostics name the blocking field. Complete (2026-09-20); S8 dropped, S10 sealed cascade landed                         |
| [PLAN_LAYER_REORGANIZATION.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_LAYER_REORGANIZATION.md?html)                                 | DRAFT — the design→backend rename and finishing the layer split. Q1/Q3 await John                                               |
| [PLAN_LAYER_REORGANIZATION_LOWLEVEL.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_LAYER_REORGANIZATION_LOWLEVEL.md?html)               | File-by-file execution strategy for the above; scope lock pending                                                               |
| [PLAN_RELEASE_HARDENING.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_RELEASE_HARDENING.md?html)                                       | Production-release checklist. 15 items still open; written against `dev` on 2026-08-28, so re-verify each before working it    |
| [PLAN_STATE_STORAGE_SPLIT.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_STATE_STORAGE_SPLIT.md?html)                                   | QO130 — view state split into project state (saved in `.owpr`) and app state. Not started                                       |
| [PLAN_QO129_BROWSER_EVALUATION_TO_VITEST.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_QO129_BROWSER_EVALUATION_TO_VITEST.md?html)     | QO129 — migrate browser-tab arithmetic evaluations into Vitest and consolidate Tier-3 acceptance scenarios                      |
| [PLAN_WIZARD_AND_TESTS.md](http://localhost:8000/winisd/openisd/docs/plans/PLAN_WIZARD_AND_TESTS.md?html)                                | ACTIVE — finish the sealed New-Project wizard: commit checkpoint, fix the 4 unit failures (select rule, architecture edges, DiagnosticsModal env), extract DriverEditorModal DQ functions, browser specs under the real runner, coverage raised per task. Tasks 6–8 scenarios DITCHED (John 2026-09-21); QO80 edge needs John's ruling |

## Research

| Doc                                                                                                                 | What it is for                                      |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [docs/research/WINISD_PARITY.md](http://localhost:8000/openisd/docs/research/WINISD_PARITY.md?html)                 | Where OpenISD agrees and disagrees with real WinISD |
| [docs/research/UNIT_BOUNDARY_AUDIT.md](http://localhost:8000/openisd/docs/research/UNIT_BOUNDARY_AUDIT.md?html)     | Where units convert, and where they must not        |
| [docs/research/COMPETITIVE_LANDSCAPE.md](http://localhost:8000/openisd/docs/research/COMPETITIVE_LANDSCAPE.md?html) | Other tools in this space                           |
| [docs/research/REFERENCES.md](http://localhost:8000/openisd/docs/research/REFERENCES.md?html)                       | The acoustics literature this project relies on     |
| [docs/papers/](http://localhost:8000/openisd/docs/papers/)                                                          | Source papers, e.g. Portlengths                     |

## Bugs

[bugs/](http://localhost:8000/openisd/bugs/) — 81 records, one file per defect, named
`BUG_YYYYMMDD_<description>.md`. Each carries Symptom / Evidence / Cause / Fix / Verification,
and a `Status:` line (`OPEN` / `RESOLVED` / `DEFERRED` / `WONTFIX`) read by
`~/.claude/bin/inbox.py bugs`.

**A bug record is written BEFORE the bug is reported and BEFORE it is fixed** — a fix applied
first destroys the evidence that makes it reviewable.

## Reference material

| Path                                                                               | What it is                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/winisd_screenshots/](http://localhost:8000/openisd/docs/winisd_screenshots/) | Real WinISD screens, and sample `.wdr`/`.wpr` files it wrote                                                                                                |
| [docs/winisd_helpfiles/](http://localhost:8000/openisd/docs/winisd_helpfiles/)     | WinISD's own shipped help                                                                                                                                   |
| `packages/winisd/test/fixtures/winisd-parity/goldens/`                             | Project files WinISD itself wrote under the wine harness. The ONLY admissible oracle — `provenance.json` pins the exe hash, harness commit and capture time |
