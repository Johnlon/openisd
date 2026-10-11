# Plan: high-fidelity extraction and a strict transfer file

**Status: PROPOSED — not agreed by John.** 10 Oct 2026, from John's words that day. It replaces the earlier pure-extractor plan (in git history). Nothing here is decided until John says so about this plan.

John, 10 Oct 2026:
- "it is obvious to me that the data the scrapers pull needs to be recorded in higher fidelity than it is at present and in the transfer file with a strong schema"
- "I want the scraper to create a new file that keeps the raw stuff, this may mean keeping fields we previously discussed fetching, openisd needs to create the openisd.json still (with the new driver type structure)"
- "of course you have to call the bridge" — "currently on a given worktree"
- "we go back to old file name once process works"
- "we have too much Manu specific duplicates — consider it a single unit of work with unit tests ... 100pc up front as the goal"
- "obviously do this on a worktree of both projects, it's a big piece and I don't want it in the way of small fixes"
- "exclusions during record write seem late"; "logging is good"
- "we need to avoid duplicate logic between openisd and python too, so beware"

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

Schema rules: ONE source — a JSON Schema file (`driver_spec.schema.json`, kept in openisd `packages/design`). The Python model and the Zod schema are generated from it, never hand-written twice; a test fails if a generated file is stale. Unknown fields are refused; `schema_version` is checked on every read.

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

## 3a. No logic in both languages

- Every rule lives in exactly one repo: reading and scope in Python; every interpretation in TypeScript (section 3).
- When a rule moves (e.g. text → SI from `lib/units.py`), the Python copy is deleted in the same change; its tests move with it.
- The old pipeline runs beside the new one only until parity passes (step 5); it is then deleted, not kept.
- An architecture test in tools fails if tools code parses a number or maps a label once the move is done.

## 4. Scope: one rule, decided early, always logged

Today about 22 places in 4 stages decide scope, with per-manufacturer copies of the same keyword lists, and most refusals leave no trace. Instead:

- One shared scope check; its rules are data (category words, title phrases, the exclusion list).
- It runs as soon as the evidence exists: at discovery (exclusion list, non-product pages, listing category or title) and again right after the product page is fetched, before any datasheet is fetched or read.
- Every refusal is logged: product, URL, rule, the words that triggered it.
- Per-manufacturer filters are deleted once the shared check covers them.

## 4a. AI triage after every extraction, and a cycle of improvements

John, 2026-10-11: "we need AI triage of all fails relating to non optional fields that affect calculations like TS and mechanical params, these must be part of an ai post extract review process and a cycle of process improvements, and I want the code concentrated in one place to make this viable".

- **What is triaged:** every failure on a required field that a calculation uses: the Thiele/Small and mechanical parameters. A failure is a field with no value, a rejected reading, an impossible value, or readers that disagree.
- **When:** a review step after every extraction run. An AI reviewer reads each failure with its evidence (the cached document, the reader outputs, the rejected text) and gives one verdict per failure: reader fault, rule fault, datasheet fault, or a correct refusal.
- **The cycle:** each reader fault and rule fault becomes a work item that changes the shared extraction code or its rule data, plus a test case taken from the failure. The next run is triaged again, and the failure count for those fields is tracked from run to run.
- **One place:** the reading, interpretation and scope code is in the one shared extraction (section 5) and the one openisd parser, never per manufacturer. That way a triage verdict leads to one change that fixes every manufacturer.
- **Open:** where the triage step and its verdicts live (tools or openisd), and which model runs it.

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
   - **A reading keeps its datasheet text** (John, 2026-10-11): "N/A", "banana" and "143c cm²" are stored as printed, as a rejected reading with its reason.
   - **`.wdr` cannot hold a rejected reading** (John, 2026-10-11): a `.wdr` field is a flag and a number only. A rejected reading is written to `.wdr` as N (not available), value 0, and a comment carrying the printed text. Loading a `.wdr` never makes a rejected reading. T017's "a .wdr text cell becomes a rejected reading" is wrong and is replaced by this.
   - T017's first worker stopped at its usage limit mid-change; another worker finishes it.
   - **No winner means no value** (John, 2026-10-11): when every reading is impossible or rejected, the field gets no value and the comment records every value seen and why each was rejected. T018 carries this.
5. **Parity**: both pipelines over every cached input. For every reading, the SI value matches the old pipeline, or the change is listed and explained. The old pipeline stays until this passes.
6. **Switch**: delete the old record writing and the 17 per-manufacturer `emit.py` files; rename `driver_spec.json` to `driver.json`; rebuild the corpus (John clears it), then the swap.
7. **Triage** (section 4a): the AI review step runs after the rebuild and after every later extraction run; its reader and rule faults feed the next round of work.

## 6. Tests and credit

- While coding: only the tests for the piece in hand.
- At each landing: the landing gates only.
- Full suites: once before the parity run, once after the switch.
- Delegated CLIs do the coding: small briefs, one piece at a time, quota reset times recorded in the work list.

## 6a. No AI attribution, anywhere

- Commits and PR descriptions carry John's authorship only: no `Co-Authored-By` naming an AI or tool, no `Claude-Session`, no "Generated with" lines (John, 10 Oct: "no AI attributions!", "and no attribution in commits").
- Documents carry no agent bylines ("written by lots" and the like).
- Every brief to an external CLI says so; the briefing session checks each commit before landing; openisd's commit-msg and pre-push hooks refuse attribution.

## 7. Open for John

- Confirm this plan, or change it.
- Held until then: QT93 step 2, the shared-rule batches, the bridge `printed` job, openisd T017/T018 (parked, committed).
