# Skill: codebase-map

Generate a compact knowledge map of the codebase — entry points, key modules, data flows, and important symbols — so future queries need far less file-reading to get oriented.

## When to use

- At the start of a large multi-file task when you need orientation
- When a new AI session needs to understand the codebase quickly
- When debugging a data flow across multiple modules
- Before architecture decisions that touch multiple packages

---

## What to produce

Output a structured map with these sections. Keep each entry to one line.

### 1. Package structure
```
packages/
  engine/   — T/S physics calculations, WDR parsing, driver loading
  ui/        — Vue 3 SPA, Vite, Playwright tests
scripts/    — dev-server/build scripts (Python scrapers + DQ check live in the sibling winisd_tools repo)
drivers/    — bundled WDR + _meta.yml files (demos/, matt/, winisd/, sample/); sources.json federates the rest from the sibling winisd_drivers repo
```

### 2. Engine entry points (packages/engine/src/)
For each key file: `filename — what it exports — what calls it`

### 3. UI entry points (packages/ui/src/)
For each key component/store: `filename — responsibility — key props/events`

### 4. Data flow
Trace the path from raw scraper HTML → WDR file → driver bundle → engine load → chart render. One line per step with the file responsible.

### 5. Key symbols
List the 10-15 most-referenced functions/constants/types across the codebase with their file locations. These are the ones a future query is most likely to ask about.

### 6. Hard constraints summary
One-line reminders of rules that affect multiple files:
- Schema: `wdr_meta_schema.py` (sibling `winisd_tools` repo) is the single source of truth
- No normalisation scripts on `drivers/`
- `matt/` is protected
- Calculations: never change without explicit approval
- Branch: all work on `dev`

---

## How to generate

Read these files in parallel:
- `packages/engine/src/` — glob all `.js`/`.mjs` files, read each
- `packages/ui/src/` — glob all `.vue`/`.js` files, read each
- `scripts/*.py` — glob and read
- `ARCHITECTURE.md`, `PLAN.md`

Then synthesise the map. Do not just list files — describe what each does and how it connects to others.

Write the map to `CODEBASE_MAP.md` at the repo root and print the file URL so it can be opened.
