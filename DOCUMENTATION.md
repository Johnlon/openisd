# Documentation index

## Start here

| Document                                                           | What it covers                                                                   |
|--------------------------------------------------------------------|----------------------------------------------------------------------------------|
| [README.md](README.md)                                             | What OpenISD is, and how to run it                                               |
| [ARCHITECTURE.md](ARCHITECTURE.md)                                 | Layers, domain model, solving, state, formats, coupling rules, testing, WinISD comparison |
| [RESEARCH.md](RESEARCH.md)                                         | The theory, what WinISD is built on, WinISD's measured behaviour, probing and goldens |
| [OPENISD_WINISD_GAPS_AND_BUGS.md](OPENISD_WINISD_GAPS_AND_BUGS.md) | Open behaviour differences from WinISD                                           |
| [FEATURES.md](FEATURES.md)                                         | What ships, and what is planned                                                  |
| [BACKLOG.md](BACKLOG.md)                                           | Agreed work not yet started                                                      |
| [BUGS.md](BUGS.md)                                                 | Known open bugs                                                                  |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md)                         | How the app is tested                                                            |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                 | How to contribute                                                                |
| [AGENTS.md](AGENTS.md)                                             | Rules for agents working in this repository                                      |

`questions.yml` is the decision ledger. Read and write it only through `~/.claude/bin/inbox.py`.

## Specifications

| Document                                             | What it covers                                                          |
|------------------------------------------------------|-------------------------------------------------------------------------|
| [docs/spec/SPEC_ENGINE.md](docs/spec/SPEC_ENGINE.md) | What the engine computes, and its formulas                              |
| [docs/spec/SPEC_UI.md](docs/spec/SPEC_UI.md)         | What the UI presents                                                    |
| [docs/FIELD_REFERENCE.md](docs/FIELD_REFERENCE.md)   | Every field: meaning, unit, and the source of its definition            |

## Design

| Document                                                                     | What it covers                                           |
|------------------------------------------------------------------------------|----------------------------------------------------------|
| [docs/design/WINISD_SCHEMA.md](docs/design/WINISD_SCHEMA.md)                 | The `.wdr` and `.wpr` formats, reverse-engineered        |
| [docs/design/WDR_LOGIC.md](docs/design/WDR_LOGIC.md)                         | How `.wdr` files are loaded and saved                    |
| [docs/design/STATE_MODEL.md](docs/design/STATE_MODEL.md)                     | Dialog drafts, commit and cancel rules                   |
| [docs/design/REACTIVITY.md](docs/design/REACTIVITY.md)                       | How domain changes reach Vue                             |
| [docs/design/BUNDLED_CATALOGUE_API.md](docs/design/BUNDLED_CATALOGUE_API.md) | The catalogue index and on-demand records                |
| [docs/design/BROWSER_STORAGE_KEYS.md](docs/design/BROWSER_STORAGE_KEYS.md)   | Every browser storage key                                 |
| [docs/design/NEW_PROJECT_WIZARD.md](docs/design/NEW_PROJECT_WIZARD.md)       | The New Project wizard                                   |
| [docs/design/TESTING_FIXTURES.md](docs/design/TESTING_FIXTURES.md)           | Why fixtures are generated, not hand-written             |

Other files in [docs/design/](docs/design/) record individual rulings and proposals.
Superseded ones are in [docs/design/_archive/](docs/design/_archive/).

## Research

| Document                                                                           | What it covers                                            |
|------------------------------------------------------------------------------------|-----------------------------------------------------------|
| [docs/research/REFERENCES.md](docs/research/REFERENCES.md)                         | Literature, oracles and cross-check tools                 |
| [docs/research/VENTED_ALIGNMENT_FORMULAS.md](docs/research/VENTED_ALIGNMENT_FORMULAS.md) | WinISD's vented alignments, recovered and validated  |
| [docs/research/PROBE_W5_SEALED_20260924.md](docs/research/PROBE_W5_SEALED_20260924.md) | Every chart, WinISD against OpenISD, on one project   |
| [docs/research/WINISD_PARITY.md](docs/research/WINISD_PARITY.md)                   | Field-by-field UI parity (dated 2026-08-13)               |
| [docs/research/UNIT_BOUNDARY_AUDIT.md](docs/research/UNIT_BOUNDARY_AUDIT.md)       | Where units convert                                       |
| [docs/research/COMPETITIVE_LANDSCAPE.md](docs/research/COMPETITIVE_LANDSCAPE.md)   | Other tools in this space                                 |
| [docs/winisd_helpfiles/](docs/winisd_helpfiles/)                                   | WinISD's own help                                         |
| [docs/winisd_screenshots/](docs/winisd_screenshots/)                               | WinISD's screens, and sample files it wrote               |

The WinISD reverse-engineering work lives in the sibling `winisd_research` repository; see
[RESEARCH.md](RESEARCH.md#winisd-behaviour-research).

## Plans

Active plans are in [docs/plans/](docs/plans/); finished ones are in [docs/plans/archive/](docs/plans/archive/).

| Plan                                                                               | Purpose                                                |
|------------------------------------------------------------------------------------|--------------------------------------------------------|
| [PLAN_WINISD_GAPS.md](docs/plans/PLAN_WINISD_GAPS.md)                              | Close the open WinISD behaviour gaps                   |
| [PLAN_WIZARD_AND_TESTS.md](docs/plans/PLAN_WIZARD_AND_TESTS.md)                    | Finish the sealed New Project wizard                   |
| [FIX_WIZARD_VENTED-remains.md](docs/plans/FIX_WIZARD_VENTED-remains.md)            | What the vented wizard work left open                  |
| [PLAN_RELEASE_HARDENING.md](docs/plans/PLAN_RELEASE_HARDENING.md)                  | Production release checklist                           |
| [PLAN_STATE_STORAGE_SPLIT.md](docs/plans/PLAN_STATE_STORAGE_SPLIT.md)              | Split view state into project and app state            |
| [PLAN_LAYER_REORGANIZATION.md](docs/plans/PLAN_LAYER_REORGANIZATION.md)            | Layer reorganisation (draft)                           |
| [PLAN_FIELD_KEY_CONSOLIDATION.md](docs/plans/PLAN_FIELD_KEY_CONSOLIDATION.md)      | One domain-named field-key enum                         |
| [PLAN_RETIRE_CALCS_FROM_SCRAPERS.md](docs/plans/PLAN_RETIRE_CALCS_FROM_SCRAPERS.md) | Move calculation and DQ out of the scrapers           |

## Records

- [bugs/](bugs/): one file per defect, with symptom, evidence, cause, fix and verification.
- [docs/LOG.md](docs/LOG.md): change log.
- [docs/handover/](docs/handover/): session handovers.
- [docs/_archive/](docs/_archive/): superseded documents, including the previous architecture document.
