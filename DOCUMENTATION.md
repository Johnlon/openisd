# Documentation index

Every document in this repo, and what it is for. A doc not listed here is invisible to anyone
who does not already know it exists — add new ones as they are written.

Links are served: `http://localhost:8000/openisd/<path>?html` renders Markdown with live
Mermaid diagrams.

## Start here

| Doc | What it is for |
|---|---|
| [README.md](http://localhost:8000/openisd/README.md?html) | What OpenISD is, and how to run it |
| [AGENTS.md](http://localhost:8000/openisd/AGENTS.md?html) | The rules an agent must follow in this repo. Read before changing anything |
| [ARCHITECTURE.md](http://localhost:8000/openisd/ARCHITECTURE.md?html) | The layering (`UI -> LOGIC -> SERVICE -> domain/STORAGE/io`), module responsibilities, and the numbered Architecture Decisions |
| [HANDOVER.md](http://localhost:8000/openisd/HANDOVER.md?html) | Where the work stands, for the next session |

## Planning and tracking

| Doc | What it is for |
|---|---|
| [BACKLOG.md](http://localhost:8000/openisd/BACKLOG.md?html) | Work that is agreed but not started |
| [WIP.md](http://localhost:8000/openisd/WIP.md?html) | Work in flight |
| [LOG.md](http://localhost:8000/openisd/LOG.md?html) | The VALUE a change delivered — benefit first. The one sanctioned place for history |
| [FEATURES.md](http://localhost:8000/openisd/FEATURES.md?html) | What the app does today |
| [REVIEW.md](http://localhost:8000/openisd/REVIEW.md?html) | Review notes |
| `questions.yml` | The decision ledger. Read and write it ONLY through `~/.claude/bin/inbox.py` — never by hand |

## Specifications

| Doc | What it is for |
|---|---|
| [docs/spec/SPEC_ENGINE.md](http://localhost:8000/openisd/docs/spec/SPEC_ENGINE.md?html) | What `@openisd/engine` computes, and the formulas it owns |
| [docs/spec/SPEC_UI.md](http://localhost:8000/openisd/docs/spec/SPEC_UI.md?html) | What the UI presents |

## Design

| Doc | What it is for |
|---|---|
| [docs/design/WINISD_SCHEMA.md](http://localhost:8000/openisd/docs/design/WINISD_SCHEMA.md?html) | The `.wdr` and `.wpr` file formats, reverse-engineered. §12 is the machine-verified `c`/`roo` resolution rule |
| [docs/design/DRIVER_ADT_DESIGN.md](http://localhost:8000/openisd/docs/design/DRIVER_ADT_DESIGN.md?html) | The driver model's design |
| [docs/design/STATE_MODEL.md](http://localhost:8000/openisd/docs/design/STATE_MODEL.md?html) | Ground / committed / what-if layering, and what each means |

## Plans

Nine plans in [docs/plans/](http://localhost:8000/openisd/docs/plans/). The two active ones:

| Plan | What it is for |
|---|---|
| [PLAN_QO60_LAYERING_REMEDIATION.md](http://localhost:8000/openisd/docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md?html) | **The current architecture work.** Access rules, deleting `state.P`, the catalogue index, the model↔winisd doc correction. 8 objectives. Authoritative where plans disagree |
| [PLAN_USEDESIGNIO_REMEDIATION.md](http://localhost:8000/openisd/docs/plans/PLAN_USEDESIGNIO_REMEDIATION.md?html) | QO61 — splitting `useDesignIO.ts`. Objective 6 of the above |

The rest — `MATH_MIGRATION`, `OPENISD_MODEL_MIGRATION_READINESS`, `OPENISD_TARGET_MIGRATION_PLAN`,
`PLAN_JS_CALC_CONSOLIDATION`, `PLAN_OPENISD_DRIVER_MODEL`, `PLAN_PROJECTION_PACKAGE`,
`PLAN_SBL_CROSSCHECK` — are earlier or narrower; check their own headers for standing.

## Research

| Doc | What it is for |
|---|---|
| [docs/research/WINISD_PARITY.md](http://localhost:8000/openisd/docs/research/WINISD_PARITY.md?html) | Where OpenISD agrees and disagrees with real WinISD |
| [docs/research/UNIT_BOUNDARY_AUDIT.md](http://localhost:8000/openisd/docs/research/UNIT_BOUNDARY_AUDIT.md?html) | Where units convert, and where they must not |
| [docs/research/COMPETITIVE_LANDSCAPE.md](http://localhost:8000/openisd/docs/research/COMPETITIVE_LANDSCAPE.md?html) | Other tools in this space |
| [docs/research/REFERENCES.md](http://localhost:8000/openisd/docs/research/REFERENCES.md?html) | The acoustics literature this project relies on |
| [docs/papers/](http://localhost:8000/openisd/docs/papers/) | Source papers, e.g. Portlengths |

## Bugs

[bugs/](http://localhost:8000/openisd/bugs/) — 81 records, one file per defect, named
`BUG_YYYYMMDD_<description>.md`. Each carries Symptom / Evidence / Cause / Fix / Verification,
and a `Status:` line (`OPEN` / `RESOLVED` / `DEFERRED` / `WONTFIX`) read by
`~/.claude/bin/inbox.py bugs`.

**A bug record is written BEFORE the bug is reported and BEFORE it is fixed** — a fix applied
first destroys the evidence that makes it reviewable.

## Reference material

| Path | What it is |
|---|---|
| [docs/winisd_screenshots/](http://localhost:8000/openisd/docs/winisd_screenshots/) | Real WinISD screens, and sample `.wdr`/`.wpr` files it wrote |
| [docs/winisd_helpfiles/](http://localhost:8000/openisd/docs/winisd_helpfiles/) | WinISD's own shipped help |
| `packages/winisd/test/fixtures/winisd-parity/goldens/` | Project files WinISD itself wrote under the wine harness. The ONLY admissible oracle — `provenance.json` pins the exe hash, harness commit and capture time |
