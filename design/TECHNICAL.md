# TECHNICAL design — openisd (the app)

_How the app is implemented._ A **hub** linking the authoritative specs. See
[`INDEX.md`](INDEX.md).

## Architecture & process

- **`../ARCHITECTURE.md`** — architecture decisions (ADRs).
- **`../STATE_MODEL.md`** — layered project state (ground → modified → what-if + edit);
  chart reactivity priority; what-if vs edit dialog semantics. Target design.
- **`../CONTRACT.md`** — engine ↔ consumer stable API/data contract.
- **`../DEVELOPMENT.md`** — testing contract + 3-layer architecture practices.
- **`../SDLC.md`** — human/agent/tooling operating manual.
- **`../CLAUDE.md`** — agent rules / quality gates.

## Data model & file formats

- **`../WDR_SCHEMA.md`** — the `.wdr` + `_meta.yml` format spec (canonical WDR SSOT);
  includes the "Appendix — file model & link-field workflows" (merged 2026-07-20 from
  WDR_FILE_MODEL_AND_WORKFLOWS.md).
- **`../WINISD_WPR_FILE_SCHEMA.md`** — reverse-engineered `.wpr` project-file schema.
- **`../DRIVER_ADT_DESIGN.md`** — driver-model ADT (E/C/N provenance).
- **`../drivers/sources.schema.md`** — `sources.json` registry schema.

## App behaviour rules (agent context)

- `../.claude/context/{js-patterns,driver-data-rules,engine-rules}.md`,
  `../.claude/context/{testing-js-core,testing-js-ui}.md`.
- Standing coding patterns live in `../DEVELOPMENT.md` §8 (merged 2026-07-20 from
  CODING_PATTERNS.md).
