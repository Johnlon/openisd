# Plan: high-fidelity extraction and a strict transfer file

**Status: PROPOSED — not agreed by John.** Written by lots, 10 Oct 2026, from John's words in that day's conversation. It replaces the earlier pure-extractor plan (in git history). Nothing here is decided until John says so about this plan.

John, 10 Oct 2026:
- "it is obvious to me that the data the scrapers pull needs to be recorded in higher fidelity than it is at present and in the transfer file with a strong schema"
- "I want the scraper to create a new file that keeps the raw stuff, this may mean keeping fields we previously discussed fetching, openisd needs to create the openisd.json still (with the new driver type structure)"
- "of course you have to call the bridge" — "currently on a given worktree"
- "we go back to old file name once process works"
- "we have too much Manu specific duplicates — consider it a single unit of work with unit tests ... 100pc up front as the goal"
- "obviously do this on a worktree of both projects, it's a big piece and I don't want it in the way of small fixes"
- "exclusions during record write seem late"; "logging is good"

## 1. Goal

- winisd_tools finds documents and reads them faithfully: what was printed, where, and how it was read. Nothing interpreted.
- The transfer file has a strict, versioned schema, the same in Python and TypeScript.
- openisd interprets: label → parameter, section → woofer/tweeter/passive radiator, text → SI number, refused readings, roles, the winning reading.
- tools still produces `openisd.json` and `.wdr` by calling the openisd bridge built in a given openisd worktree (no pinned copy).
- One shared implementation for everything common; per-manufacturer code only locates documents and cells.

## 2. The transfer file

Name during the work: `driver_spec.json`. Once the new process works it takes back the name `driver.json`, and the old format is deleted.

Per **reading** (every reading is kept: a list, never one per source):

| field             | example                                                                                       |
|-------------------|-----------------------------------------------------------------------------------------------|
| `text`            | `"8.75 g"`, `"N/A"`, `"-"`, exactly as printed                                                |
| `document`        | URL + role (manufacturer datasheet / product page / listing; distributor ditto)               |
| `reader`          | closed enum: `pypdf`, `pymupdf4llm`, `ocr_<engine>`, `html`                                   |
| `page`, `table`, `row`, `column` | positions in the document                                                      |
| `row_label`       | `"Moving mass"`, as printed                                                                   |
| `column_header`   | `"Tweeter"`, as printed                                                                       |
| `section_heading` | `"Woofer section"`, as printed                                                                |
| `unit_text`       | `"cm²"`, header or label unit, as printed                                                     |
| `footnote_marks`  | as printed                                                                                    |

Per **document**: URL, role, fetch time, title, breadcrumb and categories in order, description, every table in full (unmapped rows included), and the facts planned but never stored so far: datasheet type words, size text, printed model code.

Per **record**: brand, model, the record directory name (unchanged for existing records), `added` (first appearance; a harvest fact), every document, every reading, the product's scope log (section 4).

Schema rules: Pydantic v2 with unknown fields refused; a matching Zod schema in openisd (`packages/design/domain/driverSpecSchema.ts`); a parity test fails if the two differ; `schema_version` is checked on every read.

## 3. Who does what

| step                                              | winisd_tools        | openisd                                                                 |
|---------------------------------------------------|---------------------|-------------------------------------------------------------------------|
| discover, route, locate documents                 | yes                 | —                                                                       |
| read documents (text layer, OCR, HTML) faithfully | yes                 | —                                                                       |
| scope: is it a driver at all                      | yes (section 4)     | —                                                                       |
| label → parameter, section → woofer/tweeter       | —                   | yes, from `row_label`, `column_header`, `section_heading`; tables are data |
| text → SI; "N/A" and "-" → refused readings       | —                   | yes                                                                     |
| roles (the `driver_type` structure)               | —                   | yes, from categories and type words                                     |
| corroboration, winning reading                    | —                   | yes (exclude impossible, then majority of more than half, then precedence) |
| `openisd.json` + `.wdr`                           | calls the bridge    | the bridge builds them                                                  |

## 4. Scope: one rule, decided early, always logged

Today about 22 places in 4 stages decide scope, with per-manufacturer copies of the same keyword lists, and most refusals leave no trace. Instead:

- One shared scope check; its rules are data (category words, title phrases, the exclusion list).
- It runs as soon as the evidence exists: at discovery (exclusion list, non-product pages, listing category or title) and again right after the product page is fetched, before any datasheet is fetched or read.
- Every refusal is logged: product, URL, rule, the words that triggered it.
- Per-manufacturer filters are deleted once the shared check covers them.

## 5. Work

All of it in a pair of worktrees, one per repo, kept off main until it works. The tools worktree calls the bridge built in the paired openisd worktree.

1. **Every unit test first:**
   - schema tests (Python and Zod) and the parity test;
   - reader tests: each reader's output on a fixed set of cached documents, positions and labels included;
   - openisd parser tests: label mapping, section assignment, text → SI (ported from tools' unit tests), refused readings, roles, the picker;
   - scope tests: every current exclusion as a case, with its logged reason.
2. **Schema** in both repos.
3. **tools**: one shared extraction writing `driver_spec.json`; per-manufacturer code only locates documents and cells; the shared scope check.
4. **openisd**: parser and interpretation in `packages/design`; the bridge reads `driver_spec.json` and builds `openisd.json` in the new driver-type structure. openisd T017 (refused-reading types) and T018 (picker) fold in here.
5. **Parity**: both pipelines over every cached input. For every reading, the SI value matches the old pipeline, or the change is listed and explained. The old pipeline stays until this passes.
6. **Switch**: delete the old record writing and the 17 per-manufacturer `emit.py` files; rename `driver_spec.json` to `driver.json`; rebuild the corpus (John clears it), then the swap.

## 6. Tests and credit

- While coding: only the tests for the piece in hand.
- At each landing: the landing gates only.
- Full suites: once before the parity run, once after the switch.
- Delegated CLIs do the coding: small briefs, one piece at a time, quota reset times recorded in the work list.

## 7. Open for John

- Confirm this plan, or change it.
- Held until then: QT93 step 2, the shared-rule batches, the bridge `printed` job, openisd T017/T018 (parked, committed).
