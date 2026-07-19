# TECHNICAL design — openisd (the app)

*How the app is implemented.* A **hub** linking the authoritative specs. See
[`INDEX.md`](INDEX.md).

## Architecture & process
- **`../ARCHITECTURE.md`** — architecture decisions (ADRs).
- **`../CONTRACT.md`** — engine ↔ consumer stable API/data contract.
- **`../DEVELOPMENT.md`** — testing contract + 3-layer architecture practices.
- **`../SDLC.md`** — human/agent/tooling operating manual.
- **`../CLAUDE.md`** — agent rules / quality gates.

## Data model & file formats
- **`../WDR_SCHEMA.md`** — the `.wdr` + `_meta.yml` format spec (canonical WDR SSOT).
- **`../WINISD_WPR_FILE_SCHEMA.md`** — reverse-engineered `.wpr` project-file schema.
- **`../DRIVER_ADT_DESIGN.md`** — driver-model ADT (E/C/N provenance).
- **`../drivers/sources.schema.md`** — `sources.json` registry schema.

## App behaviour rules (agent context)
- `../.claude/context/{js-patterns,driver-data-rules,engine-rules}.md`,
  `../.claude/context/{testing-js-core,testing-js-ui}.md`.

*(Plan §B: fold `WDR_FILE_MODEL_AND_WORKFLOWS.md` into `WDR_SCHEMA.md`; `CODING_PATTERNS.md`
into `DEVELOPMENT.md`.)*
