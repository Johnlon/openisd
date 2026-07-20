# Design index — openisd (the app)

Part of the OpenISD workspace design convention (a `design/` dir with aspect-named files in
every repo). Workspace-wide index: `../../winisd_tools/design/INDEX.md`.

`openisd/` is the Vue/TS speaker-box-modelling app + WDR data model. It has all three design
aspects. Each aspect file below is a **hub** that links the authoritative existing docs; it
does not duplicate them.

| Aspect | Hub | Question |
|---|---|---|
| TECHNICAL | [`TECHNICAL.md`](TECHNICAL.md) | how it's built (architecture, engine, data model, contracts) |
| FUNCTIONAL | [`FUNCTIONAL.md`](FUNCTIONAL.md) | what it does (features, calculations) |
| UX | [`UX.md`](UX.md) | how the user interacts + how it looks |

Consolidated companions (2026-07-20 doc rationalisation):
- [`../FEATURE_COMPARISON.md`](../FEATURE_COMPARISON.md) — feature/tool comparison,
  merged from FEATURES.md + WINISD_OPENISD_COMPARISON.md + OTHER_TOOLS.md +
  SPEAKER_TOOL_LANDSCAPE.md (FUNCTIONAL's reference companion).
- [`../UI_UX_DESIGN.md`](../UI_UX_DESIGN.md) — the UI/UX design SSOT entrypoint
  (UX's reference companion).
- [`../archive/`](../archive/README.md) — completed point-in-time plans/investigations
  (REMEDIATION_PLAN, PLAN_DRIVER_ADT, PLAN_SBL_CROSSCHECK, REPORT_ORACLE_CROSSCHECK,
  CLASSIC-SKIN-review, PLAN_CLASSIC_SKIN, OLD_MOCK_DESIGN, MOCK_PROMPTS); not current design.

Locked decisions are **inline** (a `🔒 LOCKED (<date>)` marker on the decision in its own
design doc), not a separate registry — find them with `grep -rn "🔒 LOCKED" design/`. None
recorded for openisd yet.

Note: `build/` snapshot copies of root docs and `packages/ui/test-results/**/error-context.md`
are generated artifacts, not design docs (both paths are gitignored).
