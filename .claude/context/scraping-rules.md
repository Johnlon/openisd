# Scraping pipeline rules

## Core goal and AI boundaries

The scraping pipeline must be able to regenerate everything in `drivers/` from scratch by running the scrapers alone — no human or AI intervention, no post-hoc tweaks. This must be fast and repeatable.

**Roles:**

- Human + AI together decide what the rules are.
- AI encodes those rules correctly in the scrapers, diagnoses problems, and is transparent about issues.
- **AI may always read WDR and `_meta.yml` files freely** — for diagnosis, analysis, reporting, cross-referencing.
- **AI must not modify WDR or `_meta.yml` files** unless the human explicitly authorises it in the current conversation. The correct fix is always to improve the scraper so the file is generated correctly on the next run.

**The test:** before touching any WDR or sidecar file, ask "is this fix encoded in the scraper?" If not, fix the scraper first.

## No normalisation or fix-it scripts — hard rule

**Never write a standalone script whose purpose is to normalise, patch, or fix data files in `drivers/`.** This includes:

- Scripts that walk `drivers/` and rewrite field values to fix a known bad pattern
- Scripts that "normalise" units, casing, or formatting across WDR or `_meta.yml` files
- One-shot migration scripts that apply a correction to many files at once
- **"Backfill" scripts** — scripts that re-read existing WDR or `_meta.yml` files and derive a field value from file contents or filenames, then write it back.
- **"Enrich" / "derive-and-persist" passes** — any second-pass script that reads already-written scraper output and adds or updates fields.

**The two valid authorities for any sidecar field:**

1. The scraper writes it directly at scrape time from authoritative source data (HTML, PDF).
2. The app computes it at runtime (e.g. `classifyTypes()` in `DriverBrowser.vue`).

**`driver_type` specifically:** written by the scraper at scrape time, or left null for `classifyTypes()` to handle at runtime. Never write a script that derives and persists `driver_type` from existing file content.

## Protected collections — DO NOT MODIFY

**`drivers/matt/` is human-curated. Never write to, rename, delete, or modify any file in this collection without explicit human instruction in the current conversation.** Scripts, batch fixes, scrapers, and normalisation tools must all exclude `matt/` by default. If a script would touch `matt/`, it must stop and log a warning instead.

## Schema discipline — hard rule

`scripts/wdr_meta_schema.py` is the **single source of truth** for every field that may appear in a `.wdr` or `_meta.yml` file. The schema is enforced at runtime: `scraper_lib._scrape_one()` validates every written file before counting it as success.

**Rules for AI — non-negotiable:**

1. **Never write a field that is not defined in the schema.** Check `_WDR_FIELD_SPEC` (WDR) or `MetaModel` (meta) before writing any field.

2. **Never change the schema unilaterally.** Any addition, removal, or rename of a field requires: (a) describing the change to the human — field name, type, unit, reason; (b) getting explicit human approval in the current conversation; (c) then and only then updating `wdr_meta_schema.py`, then the scraper code, then `WDR_SCHEMA.md §9.1`.

3. **Respect the schema in all scrapers and batch scripts.** When adding scraper features that require new fields, propose the field first — do not add it speculatively.

Full operational rules: `drivers/SCRAPING_RULES.md §Schema discipline`.

## Scraper rules — cache everything

Every scraper **MUST** cache all HTML it fetches to `drivers/<collection>/_html/`. `scraper_lib.py`'s `run_scraper` already does this automatically. Do not bypass it.

**Why:** `_html/` is gitignored (large, regenerable), so it only exists on the local machine. It is the only source `enrich_drivers.py` can use to extract `driver_type`, `freq_low_hz`, `freq_high_hz`, and other product metadata without hitting the live site again.

**Rule for AI agents:** if `_extract.yml` shows `source: none` for an entire collection and `drivers/<collection>/_html/` is absent, do NOT try to individually fetch and cache pages. Instead, tell the user: "run `python scripts/scrape_<collection>.py --refresh` to rebuild the HTML cache, then re-run `enrich_drivers.py --force --collection <name>`."

**Image / custom-encoded PDFs:** some collections (Scan-Speak, some wavecor) publish datasheets as image PDFs or PDFs with custom Type1 font encoding. `pypdf` extracts garbled token sequences (`/0/1/2/i255/...`). Detect this in `extract_lib.extract_from_pdf()` and log `pdf_encoding=garbled` to the problems log instead of reporting a false "no frequency range found".

## Script rules — progress, monitoring, and resume

Every script that processes more than a handful of files or runs for more than a few seconds **MUST**:

- **Timestamp every output line** — `datetime.now().strftime('%H:%M:%S')` or equivalent. No silent scripts.
- **Print a progress line per collection or per N files** — e.g. `[14:32:01] dayton-audio: 412 files, 3 issues found`.
- **Print a final summary line** — total files scanned, total issues, elapsed time.
- **External monitor / auto-kill** — for scripts expected to run >60 seconds, add a watchdog that kills the script if it produces no output for 120 seconds. Use `timeout` (Unix) or equivalent.
- **Resume capability** — any batch-write script must be restartable mid-run. Write to a temp file or skip already-processed files so a killed run can be continued without reprocessing.

These rules apply equally to inline scripts run via `python -c`, subagent scripts, and standalone `.py` / `.mjs` files.

## Scraper problem logs

Every scraper **MUST** write a problem log file alongside its output.

- **Log file location:** `drivers/<collection>/_problems.log`
- **Append, never overwrite** — each run appends with a run header so history is preserved.
- **Log every problem encountered**: missing mandatory fields, fields that could not be parsed, unexpected HTTP status codes, items skipped due to DQ rules, any exception.
- **Log format:**
  ```
  [HH:MM:SS] RUN <iso-datetime> scraper=<name> collection=<dir>
  [HH:MM:SS] PROBLEM field=<field> item=<id_or_sku> url=<url> offset=<N>
             raw_value=<repr of what was found>
             reason=<why this is a problem>
  ```
- **A scraper that produces zero problems is not exempt** — write the run header with `problems=0`.
- **Log and continue — never abort.** A missing or unparseable field is a problem to log, not a reason to raise. The scraper must process every item it can and move on.

## Testing scrapers

Scraper parsing functions must have unit tests. See `.claude/context/testing-python.md` for the full testing contract.
