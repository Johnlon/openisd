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
Also per record, as the record schema has them today: `sku`, `series`, `product_image` (URL) and `description` (shown in the driver popup). John, 12 Oct 2026: keep what is used; nothing replaced these. `sku` also decides the record directory (QO34: `<brand-code>/<driver-sku>/`), so dropping it is a separate decision, not taken. Each document carries its own description as well.

Schema rules (John, 2026-10-11: "the reconciliation programme writes the other schema from the master and stops if it cannot get 100 same output"):

- **One master, one generated copy.** The two schemas are Zod in openisd (`packages/design/domain/openisdSchema.ts`) and pydantic in winisd_tools (`scrapers/scrapers/lib/model_driver.py`). One is the master and is hand-written; the reconciliation program writes the other from it, validation rules included. Nobody edits the generated copy.
- **The program** parses the master as code (its AST, refinement and validator bodies included) and writes the other schema in the other language. It is a program, not an LLM step (John: "write a program"). It serves only our schema (John, 2026-10-11: "we do not need some kind of library that we can put in the public domain"). It translates just the constructs our schema uses, with no general Zod-to-pydantic coverage, no package and no public API.
- **100% or stop.** After writing, the program proves the two schemas give the same output: the same accept or refuse verdict, the same parsed result and the same problem paths, over every corpus record, every test fixture and generated edge cases. A construct it cannot translate, or any difference in output, stops it with the construct or the input named. It never writes a partial copy.
- **When it stops, an AI steps in** (John, 2026-10-11: "and then the AI steps in to figure out the fuck-up"): it reads the named construct or input and finds the cause. The fix is to the translator program, to the master, or to the data. The program then runs again and must reach 100%. The AI never hand-edits the generated copy.
- **Where it runs:** on every landing in either repo that touches the master, and as a test that fails if the generated copy is stale.
- **Covers** the transfer file `driver_spec.json` and `driver_human.json`, which uses the same schema. Unknown fields are refused, and `schema_version` is checked on every read.
- **Master: the Zod schema** (decided 2026-10-11 by the design agent, as John asked). The Zod record schema is short and declarative, with a few one-expression refinements, so a bounded translator can read it as code. `model_driver.py` mixes the schema with emitter logic and arbitrary validator bodies. openisd is the format's reader, so its acceptance is the definition. Long term, a full move to TypeScript removes the pydantic copy altogether.
- **Built:** `scripts/schemagen/` (run `npx tsx scripts/schemagen/main.ts`) writes `scripts/schemagen/out/driver_model.py`. Proof on 2026-10-11: 5382 cases (every driver.json and openisd.json in the catalogue, the fixtures, 97 edge cases), 0 differences. `packages/design/test/schemagen/driver-model-is-current.test.ts` fails when the generated module is stale. Still to do: tools switches from the hand-written `model_driver.py` to the generated module.

## 2a. The human decision file: `driver_human.json`

John, 2026-10-11: "all values in the driver need provenance so we still have manual or human as a very reliable overriding source … a means for the human to provide an opinion for the driver outcome in the bridge … a completely new file, driver_human.json that is a DECISION overarching anything logic in openisd or data present from the scraper".

- **Where:** a new file in the record directory, beside `driver.json`. Only a human writes it; the scraper never writes or deletes it, and a rebuild of the corpus keeps it.
- **What it holds:** decisions on the driver's outcome. Examples: a field's value, a role list, "this reading is right" or "this one is wrong", "not a driver". Each decision gives who made it, when, and why.
- **Rank:** a decision overrides everything else. That covers the scraper's readings, openisd's interpretation and picker, the Fs role bands and any triage verdict. The bridge applies it last.
- **Provenance:** every value in `openisd.json` names its source. A value set by a decision names `human` as its source; the existing manual/human origin stays the most reliable source.
- **Schema:** the same schema as the regular file (John, 2026-10-11: "the human and AI files should match the schema for the regular file"). A human decision is written as the regular file writes a reading, with its source given as `human`; there is no second schema.
- **Triage link:** a triage item marked as needing a human decision (section 4a), such as an Unclassified driver, is resolved by writing a decision here. The next run then applies it and no longer reports that item.
- **Stale decisions:** a decision that no longer matches its record (the field has gone, or the reading it names has changed) is reported in triage, never silently dropped.

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
| human decisions (`driver_human.json`)            | never writes it     | the bridge applies them last; they override everything (section 2a)    |

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
- **An Unclassified driver is a failure too** (John, 2026-10-11): with the Fs bands nearly every driver gets a role, so one that stays Unclassified is very suspicious. It goes in the triage report, and the report marks it as possibly needing a human decision.
- **When:** a review step after every extraction run. An AI reviewer reads each failure with its evidence (the cached document, the reader outputs, the rejected text) and gives one verdict per failure: reader fault, rule fault, datasheet fault, or a correct refusal.
- **The cycle:** each reader fault and rule fault becomes a work item that changes the shared extraction code or its rule data, plus a test case taken from the failure. The next run is triaged again, and the failure count for those fields is tracked from run to run.
- **One place:** the reading, interpretation and scope code is in the one shared extraction (section 5) and the one openisd parser, never per manufacturer. That way a triage verdict leads to one change that fixes every manufacturer.
- **Open:** where the triage step and its verdicts live (tools or openisd), and which model runs it.

## 5. Work

All of it in a pair of worktrees, one per repo, kept off main until it works. The tools worktree calls the bridge built in the paired openisd worktree.

1. **Every unit test first:**
   - schema tests (Python and Zod) and the parity test;
   - reader tests: each reader's output on a fixed set of cached documents, positions and labels included;
   - openisd parser tests: label mapping, section assignment, text → SI (ported from tools' unit tests), refused readings, roles, the picker; The parser handles fractions (`1/2"`), decimal-comma locales and the unit text to an SI factor; its cases are `winisd_tools/scrapers/tests/lib/test_units.py`, ported as `packages/design/test/domain/units.test.ts` (carried over 12 Oct 2026).
   - scope tests: every current exclusion as a case, with its logged reason.
2. **Schema** in both repos.
3. **tools**: one shared extraction writing `driver_spec.json`; per-manufacturer code only locates documents and cells; the shared scope check.
4. **openisd**: parser and interpretation in `packages/design`; the bridge reads `driver_spec.json` and builds `openisd.json` in the new driver-type structure. openisd T017 (refused-reading types) and T018 (picker) fold in here.
   - **A reading keeps its datasheet text** (John, 2026-10-11): "N/A", "banana" and "143c cm²" are stored as printed, as a rejected reading with its reason.
   - **`.wdr` cannot hold a rejected reading** (John, 2026-10-11): a `.wdr` field is a flag and a number only. A rejected reading is written to `.wdr` as N (not available), value 0, and a comment carrying the printed text. Loading a `.wdr` never makes a rejected reading. T017's "a .wdr text cell becomes a rejected reading" is wrong and is replaced by this.
   - T017's first worker stopped at its usage limit mid-change; another worker finishes it.
   - **Roles are decided and merged** (QT84/QT85, John 2026-10-08; branch openisd-roles merged 2026-10-11): `driver_type` is a non-empty list of roles. **Remaining: the type chips link up sanely with the roles** (John, 2026-10-11). A driver shows under the chip of every role it has; the chip set and the role set are one list in `packages/design`, shared with tools; a combo (e.g. tweeter-mid) shows under each of its roles. The list is a tree (John, 2026-10-11): a role also answers to the roles it contains. A mid-woofer is a mid and a woofer; a full-range is a woofer, a mid and a tweeter. The product name and the T/S values are evidence too (John, 2026-10-11): "if the product name has the word woofer in it then it's a woofer"; "an FS of 45 … obviously a woofer … an FS of 5000 … obviously a tweeter". A T/S verdict fills a role no word gives. Fs outranks a word in the product description (John, 2026-10-11: "I would trust the FS over the product description if there's ever a conflict"); the clash is still reported. **Fs always decides woofer vs tweeter** (John, 2026-10-11: "the fs will always be used to determine whether it's a woofer or tweeter"), with a mid band in between that overlaps both, so a driver in the grey zone answers to two roles. The stated frequency range counts too (John, 2026-10-11): a woofer starts at a low Fs and its range extends up to some limit; a tweeter's range starts at a high bottom end and extends upwards. The band edges come from the stated types, Fs values and frequency ranges in the bundled catalogue (study 2026-10-11, 2007 records). A record with no evidence at all is Unclassified, and goes to triage (section 4a). All type logic lives in `packages/design`, none in `packages/ui`. One test row per role pins its chips.
     - **The bands (John, 2026-10-11: "anything with an FS over 800 is defo acting as a tweeter and anything with a FS less than 65 is a woofer and anything in the middle is a mid"):**
       - **Tweeter: Fs > 800 Hz.**
       - **Woofer: Fs < 65 Hz.**
       - **Mid: 65 Hz ≤ Fs ≤ 800 Hz.**
       - The Fs role is added to the roles the words give. In the catalogue, about a fifth of stated woofers (Fs 65–200 Hz) and about half of stated tweeters (Fs 470–800 Hz) also get Mid this way.
     - **Backup when Fs is missing or odd:** a stated range whose low edge is 800 Hz or more is a tweeter (63 of 65 tweeters, 0 of 273 woofers). The range's high edge is too noisy to use.
     - **Fs cannot tell a midrange from a woofer:** most stated midranges, mid-woofers and mid-basses have woofer Fs (30–70 Hz). Those labels come from the words.
     - **Coaxial:** 13 of 34 coaxials carry the tweeter's Fs (above 1000 Hz), not the woofer's. The rule applies to the woofer section's Fs.
     - Outliers for triage (section 4a): woofers with high Fs (beyma 6mcf200nd 406 Hz, beyma 10mcf400nd 260 Hz); "midrange" SC 10 N at 1700 Hz; woofer range high edges of 1–9 Hz (a unit or parse error).
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

## 8. Later work

- **Python to TypeScript** (John, 2026-10-11): things are moving to TypeScript, and the whole winisd_tools Python code may one day be replaced by Node code. That is not this plan's work; for now only the schema alignment is done.

### 8a. The AI review file and the decision log: `driver_ai.md`, `driver_decision.md`

Later work, not part of this plan's work (John, 2026-10-11: "this is a later feature … not this ticket, log it for later work in the plan").

John, 2026-10-11: "driver_ai.md which is the manual ai review opinion and override mech, if human and ai disagree on a field then human wins BUT ai review must report any such conflict for a decision, outcome of decisions can be recorded in driver_decision.md which is read during ai manual review to explain to ai reviewer why human made a decision".

- **`driver_ai.md`:** free text that humans and LLMs both read (John, 2026-10-11): the AI reviewer's opinion on the driver (section 4a) and its reasons. `driver_decision.md` is free text in the same way.
- **`driver_ai.json`:** the AI's overrides, in the regular file's schema with their source given as `ai` (John, 2026-10-11: "the human and AI files should match the schema for the regular file"). Only the AI review step writes the AI files.
- **Order of authority, highest first:**
  1. `driver_human.json`;
  2. `driver_ai.json`;
  3. openisd's logic (interpretation, picker, Fs bands);
  4. the scraper's readings.
- **Human and AI disagree on a field:** the human value is used, and the AI review reports the conflict as an item needing a decision. It is never settled silently.
- **`driver_decision.md`:** the outcomes of those decisions and the human's reasons. The AI reviewer reads it on every review of that driver. A conflict then ends in one of two ways:
  - the reasons convince the AI reviewer, it changes its opinion, and the alert goes away;
  - the AI still disagrees and says why, and the human reconsiders and may remove their assertion from `driver_human.json`.
- **Provenance:** a value from `driver_ai.json` names `ai` as its source, just as a human decision names `human`.
- None of these files is written by the scraper, and a corpus rebuild keeps all three.
