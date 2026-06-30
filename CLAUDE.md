# Claude Code rules for this project

## Branch model — hard rule

**`dev` is the working branch. All development, scraping, and feature work happens on `dev`.**

**`main` is the release branch. It is reserved exclusively for production releases.**

**AI must never commit to or push `main` directly** except through the approved release workflow:
- `/release-drivers` skill (driver data releases)
- Any future release skill added to `.claude/skills/`
- Explicit human instruction in the current conversation that names `main` specifically

**At the start of every conversation, check the current branch.** If on `main` accidentally, switch to `dev` immediately before doing any work. Never assume it is safe to work on `main`.

**Permitted on `main` without explicit instruction:** nothing. Read-only inspection (e.g. `git log`, `git diff`) is fine; any write, commit, or push requires the release workflow or explicit per-conversation authorisation.

---

## AI-locked files

Files with a header comment containing "AI LOCKED — DO NOT EDIT" are protected from modification. These files define critical rules or transformations that must remain stable and auditable.

**Rule:** Never edit AI-locked files, even if given explicit permission in conversation. If changes are needed, the human must remove the lock comment first, or provide documented authorization that explicitly overrides the lock.

**Why:** Locked files are the single source of truth for deterministic processes (scrapers, data restoration, migrations). Unauthorized changes break repeatability and auditability.

---

## No history in documentation — hard rule

**Never write history into any `.md` file.** This includes:

- "As of \<date\>…" or "Prior to \<date\>…" sentences
- "What was removed / what replaced X" blocks
- Closed-item records with `[x]` and a **Closed:** description
- "Previously this was called…" or "This was a one-time migration…" notes
- Any block whose sole content is recording what changed in the past

**Why:** Documentation must reflect current best knowledge only. History clutters docs, confuses AI agents, and rots as code evolves. Git history and commit messages are the authoritative record of what changed and why. Writing history in docs duplicates git — badly.

**If tempted to record history:** write it in the commit message instead and move on. Delete closed items from TODO/backlog files immediately — a closed item is not a record, it is clutter.

---

## Shell environment — Windows + Git Bash only

This project runs on **Windows with Git Bash as the primary shell**. Git Bash is placed first in the Windows `PATH` so that `bash` always resolves to Git Bash, not WSL or any other shell. The SDLC has not yet been made cross-platform — WSL and Linux are not tested or supported for project scripts.

**Consequences for AI:**
- Always use the **Bash** tool for shell commands. Never use PowerShell.
- All scripts use Windows-native tools via Git Bash: `netstat` is `C:\Windows\System32\NETSTAT.EXE`, process killing uses `cmd /c "taskkill ..."`, not Unix `kill`.
- Do not use WSL commands (`wsl --`, `wsl.exe`) in scripts — WSL processes are in a separate namespace and cannot reliably kill Windows-side listeners.
- Every script that uses Windows-specific tools (`netstat`, `taskkill`, `cmd`) **must** guard against running in the wrong shell. The guard is `[ -z "${MSYSTEM:-}" ] && echo "ERROR: run in Git Bash" && exit 1`. `MSYSTEM` is set by Git Bash (`MINGW64`/`MINGW32`) and absent in WSL, PowerShell, and cmd.

## AI role — build tools, don't perform ad-hoc tasks

**The role of AI is to create reusable tools for routine tasks, not to perform those tasks ad-hoc each time.**

When a task recurs (killing ports, cleaning build artefacts, resetting state, etc.) the correct response is:

1. Write a script in `scripts/` that performs the task cleanly and generally.
2. Run the script.
3. Document it here so future AI sessions use the script rather than reinventing it.

**Never write an inline one-liner when a reusable script already exists or should exist.** Check `scripts/` first. If a script for the task does not exist, create it before running it.

**This principle does NOT apply to driver data files.** Scripts that touch, patch, normalise, backfill, or otherwise modify files in `drivers/` are banned regardless of how reusable they are — see "No normalisation or fix-it scripts" below. Driver data is maintained exclusively by the scrapers.

**Available utility scripts:**

- `scripts/start-http.sh` — **PRIMARY SCRIPT. AI must use this to start the server.** Runs all health checks then starts `vite dev` on port 4000. Never use `npm run dev`, `npm run preview`, or ad-hoc vite commands directly.
- `scripts/build-release.sh` — production dist build (`GITHUB_PAGES=true`). Used by the release-drivers workflow; never run ad-hoc.
- `scripts/health-check.sh` — all health checks: lint, unit tests, golden tests, DQ validation. Single entry point — add new checks here as they are created.
- `scripts/preview-4000.sh` — kill ports 4000-4005 then start `vite preview` on port 4000.
- `scripts/kill-http.sh [port …]` — kill all processes on ports 4000-4005 (or specified ports).

## Port range — hard rule

**This project uses ports 4000–4005 only. NEVER use a port outside this range — not for any reason.**

- **Reserved ports:** 4000 = dev/preview server, 4001 = Playwright webServer, 4002–4005 = experiments.
- **Before starting any server:** run `bash scripts/kill-http.sh` to clear the range. Never reach for `taskkill` ad-hoc.
- **If a port outside 4000–4005 is suggested by a tool or auto-incremented by Vite:** stop, run `bash scripts/kill-http.sh`, and restart on 4000. Never accept drift.

## Dev server — hard rules

- **Always start the server with `bash scripts/start-http.sh`.** Never use `npm run dev`, `npm run preview`, `npx vite`, or any ad-hoc vite command directly. `start-http.sh` runs all quality checks first (lint, unit tests, golden tests, DQ), kills the port range, then starts the dev server on port 4000. If you bypass it you skip the checks and risk serving broken code.
- **After starting, verify the page loads.** Run `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/` and confirm 200. If the server log shows a compile error, fix it first — never hand off a broken URL.
- **Unregister any stale service worker before handing off to the user.** Use browser automation to run `const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister();` on `http://localhost:4000`. Do this silently. The SW is only registered from a production build; in dev sessions it is usually absent, but if present it will serve stale JS and make changes invisible.

## Post-deploy / post-build test — hard rule

**After every `npm run build` or any change that is handed to the user as "ready to check", run a post-deploy smoke test before saying it is done.** Minimum checks:

1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/` → must be 200.
2. Fetch the compiled JS entry point from the Vite server log output and confirm no `[vite] error` lines appear in the server output.
3. For UI changes: use the browser automation tools (`mcp__claude-in-chrome__*`) to load the page and visually confirm the changed element is present and correct — do not rely on source-file grep alone. A component that compiles but renders incorrectly is still broken.

**Never say "it should work now — please check" without completing steps 1–3.** If a step fails, fix the problem first.

## JavaScript error handling — Go-inspired pattern (preferred)

All functions that perform I/O, validation, or calculations that can partially fail **must** return `{ value, errors }` rather than throwing or returning bare values.

**Shape:**

```js
// errors is always an array — empty means clean, never omit it
{ value: <result or null>, errors: [{ level: 'error'|'warn', field, message }, ...] }
```

**Rules:**

- **Return value even when errors are present** where the data is still partially usable. Reserve `value: null` for truly unrecoverable failures (e.g. parse fails completely). Degraded data + warnings is better than null + error for chart rendering.
- **Caller always checks `errors`** — never silently discard. A caller that ignores errors must do so explicitly (e.g. `const { value } = fn(); // errors intentionally ignored — display handled upstream`).
- **`level: 'error'`** — value is unusable; caller must not render or use it.
- **`level: 'warn'`** — value is usable but degraded; caller should surface the warning to the user.
- **Per-point invalidity** — when a calculation produces invalid results for a subset of points (not all), set those positions to `null` in the value array (renderer draws gaps) and include a `level: 'warn'` entry describing the affected range. Do not set `value: null` for partial failures.
- **Never throw from engine or extractor functions** — throw only from pure parsers where the input is structurally invalid (e.g. `parseWdr` on non-WDR text). Calculation functions catch their own errors internally and return them in `errors`.

**Where this applies:**

- `engine.js` — `loadDriver`, `extractSpl`, `extractExcursion`, `extractMaxSpl`, etc.
- Any future function that reads files, calls external APIs, or runs calculations that can produce NaN/Infinity.
- Does **not** apply to pure math functions in `src/core/` — those remain plain return-value functions. The engine layer wraps them and owns the error contract.

## Markdown formatting

- After writing or editing any `.md` file that contains tables, run `npx prettier --write <file>` to format the tables. Do not spend tokens manually aligning columns — use the tool.

## Scraping pipeline — core goal and AI boundaries

The scraping pipeline must be able to regenerate everything in `drivers/` from scratch by running the scrapers alone — no human or AI intervention, no post-hoc tweaks. This must be fast and repeatable.

**Roles:**

- Human + AI together decide what the rules are.
- AI encodes those rules correctly in the scrapers, diagnoses problems, and is transparent about issues or bad ideas.
- **AI may always read WDR and `_meta.yml` files freely** — for diagnosis, analysis, reporting, cross-referencing.
- **AI must not modify WDR or `_meta.yml` files** unless the human explicitly authorises it in the current conversation. The correct fix is always to improve the scraper so the file is generated correctly on the next run. A direct file edit that is not backed by a scraper rule will be wiped on the next run and is therefore wrong by definition.

**The test:** before touching any WDR or sidecar file, ask "is this fix encoded in the scraper?" If not, fix the scraper first. Only touch data files when the human explicitly says to, and record the authorisation.

## No normalisation or fix-it scripts — hard rule

**Never write a standalone script whose purpose is to normalise, patch, or fix data files in `drivers/`.** This includes:

- Scripts that walk `drivers/` and rewrite field values to fix a known bad pattern
- Scripts that "normalise" units, casing, or formatting across WDR or `_meta.yml` files
- One-shot migration scripts that apply a correction to many files at once
- **"Backfill" scripts** — scripts that re-read existing WDR or `_meta.yml` files and derive a field value from file contents or filenames, then write it back. Example: a script that reads WDR filenames, infers `driver_type` from them, and persists that to `_meta.yml`. This pattern is banned even when it mirrors runtime logic.
- **"Enrich" / "derive-and-persist" passes** — any second-pass script that reads already-written scraper output and adds or updates fields. The scraper must write every field at scrape time. A separate enrichment pass creates a second authority that diverges from the scraper on re-run.

**Why the backfill/enrich pattern is especially dangerous:** it creates three separate authorities — the scraper vocabulary (what the scraper writes), the backfill vocabulary (what the backfill writes), and the runtime classifier (what the app computes). These inevitably diverge and produce driver cards that show the wrong type, silently. The chaos is invisible until users notice wrong filter results.

**The two valid authorities for any sidecar field:**
1. The scraper writes it directly at scrape time from authoritative source data (HTML, PDF).
2. The app computes it at runtime (e.g. `classifyTypes()` in `DriverBrowser.vue`).

There is no third option.

**The only correct fix is to find the bug in the scraper and rerun the scraper.** A patch script applied to generated files will be silently wiped on the next scraper run — it fixes nothing permanently and creates a false sense of correctness.

**If the scraper cannot yet regenerate the correct value**, the right response is to fix the scraper until it can, not to write a patch script as a shortcut. If a human explicitly authorises a one-time direct file edit (recorded in the conversation), that is the narrow exception — and even then, no script; the edit is manual and deliberate.

**`driver_type` specifically:** this field is either written by the scraper at scrape time (from the vendor's category label), or left null for `classifyTypes()` to handle at runtime from the driver name and T/S parameters. Never write a script that derives and persists `driver_type` from existing file content.

## Protected collections — DO NOT MODIFY

**`drivers/matt/` is human-curated. Never write to, rename, delete, or modify any file in this collection without explicit human instruction in the current conversation.** Scripts, batch fixes, scrapers, and normalisation tools must all exclude `matt/` by default. If a script would touch `matt/`, it must stop and log a warning instead. This collection represents manual human work that cannot be recovered from a scraper.

## Script rules — progress, monitoring, and resume

Every script that processes more than a handful of files or runs for more than a few seconds **MUST**:

- **Timestamp every output line** — use `datetime.now().strftime('%H:%M:%S')` or equivalent. No silent scripts. A script that emits no output for 30+ seconds is indistinguishable from a hung script.
- **Print a progress line per collection or per N files** — e.g. `[14:32:01] dayton-audio: 412 files, 3 issues found`.
- **Print a final summary line** — total files scanned, total issues, elapsed time.
- **External monitor / auto-kill** — for any script expected to run >60 seconds, add a watchdog: a second terminal command that kills the script if it produces no output for 120 seconds. Use `timeout` (Unix) or equivalent.
- **Resume capability** — any batch-write script must be restartable mid-run. Write to a temp file or skip already-processed files so a killed run can be continued without reprocessing.

These rules apply equally to inline scripts run via `python -c`, subagent scripts, and standalone `.py` / `.mjs` files. **No exceptions.** A script that violates these rules must be fixed before its output is trusted.

## Schema discipline — hard rule

`scripts/wdr_meta_schema.py` is the **single source of truth** for every field
that may appear in a `.wdr` or `_meta.yml` file. The schema is enforced at runtime:
`scraper_lib._scrape_one()` validates every written file before counting it as success.

**Rules for AI — non-negotiable:**

1. **Never write a field that is not defined in the schema.** Check `_WDR_FIELD_SPEC` (WDR)
   or `MetaModel` (meta) before writing any field.

2. **Never change the schema unilaterally.** Any addition, removal, or rename of a field
   requires: (a) describing the change to the human — field name, type, unit, reason;
   (b) getting explicit human approval in the current conversation; (c) then and only then
   updating `wdr_meta_schema.py`, then the scraper code, then `WDR_SCHEMA.md §9.1`.

3. **Respect the schema in all scrapers and batch scripts.** Code that writes to `.wdr` or
   `_meta.yml` must only use fields defined in the schema. When adding scraper features that
   require new fields, propose the field first — do not add it speculatively.

Full operational rules: `drivers/SCRAPING_RULES.md §Schema discipline`.

## Scraper rules — cache everything

Every scraper **MUST** cache all HTML it fetches to `drivers/<collection>/_html/`.
`scraper_lib.py`'s `run_scraper` already does this automatically. Do not bypass it.

**Why:** `_html/` is gitignored (large, regenerable), so it only exists on the local
machine. It is the only source `enrich_drivers.py` can use to extract `driver_type`,
`freq_low_hz`, `freq_high_hz`, and other product metadata without hitting the live site
again. If `_html/` is missing for a collection, the enrichment script silently produces
`source: none` for every driver in that collection.

**Rule for AI agents:** if `_extract.yml` shows `source: none` for an entire collection
and `drivers/<collection>/_html/` is absent, do NOT try to individually fetch and cache
pages. Instead, tell the user: "run `python scripts/scrape_<collection>.py --refresh`
to rebuild the HTML cache, then re-run `enrich_drivers.py --force --collection <name>`."
Fetching pages one-by-one outside the scraper workflow bypasses rate-limit controls and
creates an inconsistent partial cache.

**Image / custom-encoded PDFs:** some collections (Scan-Speak, some wavecor) publish
datasheets as image PDFs or PDFs with custom Type1 font encoding. `pypdf` extracts
garbled token sequences (`/0/1/2/i255/...`) from these — not readable text. Detect this
pattern in `extract_lib.extract_from_pdf()` and log `pdf_encoding=garbled` to the
problems log instead of reporting a false "no frequency range found". For these
collections, the HTML product page (once cached) is the primary extraction source.

## Script rules — scraper problem logs

Every scraper **MUST** write a problem log file alongside its output. The log is separate from stdout progress output.

- **Log file location:** `drivers/<collection>/_problems.log`
- **Append, never overwrite** — each run appends with a run header so history is preserved.
- **Log every problem encountered**, including but not limited to:
  - Missing mandatory fields (`Brand`, `Model`, `Manufacturer`, `Fs`, etc.) — log field name, the raw API/HTML value that was present (or `<absent>`), the source URL, the item ID or SKU, and the offset within the API page.
  - Mandatory fields that could not be parsed — log the raw string, the regex or parse attempt, and why it failed.
  - URLs that returned unexpected status codes or content types — log URL, expected type, actual status + content-type.
  - Items skipped due to DQ rules — log the rule ID, the offending value, and the item.
  - Any exception caught during processing — log full traceback, item identity, and source URL.
- **Log format:** one entry per problem, structured as:

  ```
  [HH:MM:SS] RUN <iso-datetime> scraper=<name> collection=<dir>
  [HH:MM:SS] PROBLEM field=<field> item=<id_or_sku> url=<url> offset=<N>
             raw_value=<repr of what was found>
             reason=<why this is a problem>
  ```

- **A scraper that produces zero problems is not exempt** — write the run header with `problems=0` so there is a record that the run completed cleanly.
- **Log and continue — never abort.** A missing or unparseable mandatory field is a problem to log, not a reason to stop or raise an exception. The scraper must process every item it can, write whatever partial record is available, and move on. The log is the signal for an AI or human to review and fix later. Blowing up on bad data is itself a bug.

## Reading context

- Read all `README.md` files in the repository (excluding `node_modules/`) before starting any task — they contain agent instructions and context for each directory.
- **Always also read** (not READMEs but essential context):
  - `BACKLOG.md` — prioritised feature backlog (P0–P3) and list of what is already shipped. P0 gates all feature work.
  - `PLAN.md` — re-architecture phases, gates, and scope guards. Read before touching `src/core/` or any structural change.
  - `ARCHITECTURE.md` — hard, hard-to-reverse decisions.
  - `DEVELOPMENT.md` — coding practices and testing contract.
- **Read for driver-data tasks:** `WDR_SCHEMA.md` (field spec and sidecar format), `drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md` (link-field workflows, DQ check, scripts reference)
- **Read for WinISD-related tasks:** `WINISD.md`

## UI rules

- Every `<button>` and every nav-like interactive element (toggles, chips, icon-only controls) **must** have a `title` attribute with a plain-English description of what it does. No exceptions.
- Tooltip text should explain the _effect_, not just restate the label — e.g. `title="Set to 2.83V — IEC 60268-5 sensitivity standard"` not `title="2.83V button"`.
- **Box type symmetry rule:** Controls that apply to all box types (e.g. box losses, Vb) must appear in a fixed position common to all types — never inside a box-type-specific block. Box-type-specific controls (vent params, PR params, etc.) go in their own conditional blocks below the shared controls. All box types must have the same structural skeleton; only the middle section varies.
- **WinISD cross-reference rule:** Every tooltip, label, doc section, and default value should mention the WinISD equivalent wherever one exists — the parameter name WinISD uses, its default value, where it appears in the WinISD UI, and any known difference in behaviour. Users migrate from WinISD; they need to map Resonate concepts to what they already know. Examples: `"WinISD default: 10"`, `"called 'Driver input voltage' in WinISD"`, `"WinISD shows this in the Box tab → Advanced→ popup"`.
- **Intrinsic vs tunable rule:** Device-intrinsic parameters (datasheet specs that describe what the component _is_) belong inside a collapsible edit section. Tunable parameters (things the user adjusts during design — added mass, box volume, vent length, losses) must stay permanently visible outside any collapsible block so the user can tweak them without entering edit mode.

## Calculation stability — hard rule

**Never change any calculation logic without explicit human permission.** This covers:

- Formulas in `src/core/` (alignments, circuit, engine, filters, etc.)
- Physical constants (`RHO`, `C`, end-correction coefficients, etc.)
- `toFixed()` / display precision in stat bar or any rendered output
- Default parameter values that affect computed results

Cross-checks against external tools (micka.de, REW, WinISD, etc.) are **reference only**. A discrepancy does not authorise a fix — document it and stop. The human decides whether a difference warrants a change.

## Testing rules

- **Direct unit tests required:** Every function in `src/core/` must have direct unit tests in `test/`. Tests are not optional.
- **Human-readable scenarios:** Every test (`it(...)`) must describe its scenario in plain English — what physical situation is being tested and what the expected outcome is. A loudspeaker designer who has never seen the code must be able to read a test name and understand what it verifies.
- **No magic numbers in tests:** Every numeric literal used in a test (inputs, expected values, tolerances) must be a named constant with a comment explaining what it represents and why it has that value. No unexplained `0.1`, `37`, `2.83`, etc.
- **All tolerances documented:** Every comparison tolerance must be a named constant (e.g. `SPL_TOLERANCE_DB = 0.1`) with a comment explaining why that tolerance is physically appropriate.
- **Parameterised tests are allowed** as long as each scenario row has a clear human-readable label explaining what case it covers.
- **References must be verified:** Any citation (AES paper, Wikipedia URL, textbook) included in test or source code comments must be verified to exist before inclusion. Do not invent or assume URLs — check them. Flag unverified citations with `⚠ Unverified reference`.
- **No magic numbers in source code:** Every non-obvious numeric constant in `src/core/` must have a comment explaining its physical meaning and a source reference where applicable. Named constants are preferred over inline literals.
- **Test framework:** Use `node:test` (`import { describe, it } from 'node:test'`) with `node:assert/strict`. Run with `node --test test/*.test.mjs`.

## Visual regression tests — SPL canvas

`test/visual.browser.spec.js` takes pixel-exact screenshots of the SPL graph panel for all four box types and compares against committed baselines in `test/visual.browser.spec.js-snapshots/`.

**Run:** `npm run test:visual`

**When to regenerate baselines** (intentional visual change — CSS, layout, curve styling):

```
npm run test:visual -- --update-snapshots
```

Review with `git diff` to confirm only the intended panels changed, then commit the new PNGs.

**Do NOT regenerate** to paper over a failing test caused by a physics or engine change. If a visual test fails unexpectedly, investigate the cause first.

## Third-party cross-check — micka.de oracle tests

`test/scenarios.js` is the source of truth for every UI test case. Each scenario defines the driver/box inputs AND both tools' expected outputs (Resonate stat-bar values and micka.de table values).

**When to run `npm run test:crosscheck`:**

- You add a new scenario to `scenarios.js` and need to confirm the expected values are physically correct.
- You change a formula in `src/core/` and need to re-validate the frozen expected values before updating the tests.
- NOT in normal CI — these tests hit an external site and are slow (~15s each).

**SOP for adding a new test case:**

1. Add a scenario to `test/scenarios.js` with `driver:` and `box:` filled in; leave `micka:` and `resonate:` blank.
2. Run `npm run test:crosscheck` — read what micka.de reports and fill in `micka:`.
3. Map micka's values to Resonate's display format (apply the same `toFixed` precision the stat bar uses) and fill in `resonate:`.
4. Add the Resonate UI wiring test to `test/app.browser.spec.js` using the frozen `resonate:` values.
5. Commit. `npm run test:crosscheck` does not run in CI.

**Do not run `test:crosscheck` in CI.** Add it only to local workflows or manual validation steps.

## Driver data — human-verified flag rules

These rules apply to all `_meta.yml` sidecar fields, and to any commentary or provenance text written into driver data files.

- **NEVER write "human verified", "human-verified", "verified by human", or any equivalent phrase** in any sidecar field (`corrections`, `detail`, `reviewed_by`, or any other field) unless the user has **explicitly granted permission in this conversation**.
- The only valid trigger is the user saying something like "mark as human verified", "you can mark it verified", or equivalent explicit instruction addressed to you in this session.
- If you believe the user has reviewed the data and may have forgotten to grant this permission, you **may ask once**: _"Would you like me to mark this as human-verified?"_ Do not assume permission; wait for an explicit yes.
- An AI writing that it "confirmed" or "verified" data in `corrections` does NOT count as human verification, even if the AI performed checks. `corrections` is AI-owned and must never contain verification language implying human sign-off.
- `reviewed_by` must remain `null` or unset until the user explicitly authorises it for a specific driver or batch.

## Driver data — batch fix SOP

- **Datasheet first, always.** Before applying any automated DQ fix to a WDR field, read the cached datasheet from `drivers/<collection>/datasheets/` and confirm the correct value is there. Never apply a batch fix on pattern alone.
- **Be suspicious of repetition.** If multiple drivers in a family produce identical values, verify each PDF independently — the match may be a regex hitting boilerplate rather than real per-driver data.
- **If the field doesn't exist in the datasheet, don't invent it.** Omit the field and add a `corrections` note in `_meta.yml` explaining why — e.g. AMT tweeters have no T/S Fs; compression drivers rarely publish Fs. A missing field is more honest than a plausible-sounding placeholder.
- **Record datasheet evidence in `corrections`.** State what the datasheet says and which file it came from. This lets a future reviewer verify the fix without re-fetching the PDF.

## Driver data — PDF sourcing and debugging

- **Cached PDFs are the primary source.** Always try `drivers/<collection>/datasheets/<filename>` first. Filenames are derived from the `datasheet` URL in `_meta.yml`.
- **If no cached PDF, or if pypdf extracts no text:** Search for the PDF using web search with query `pdf <Brand> <Model>` — e.g. `pdf HiVi F8`. Scan the results for a direct PDF link, preferring the manufacturer's own site. If no manufacturer PDF is found, accept a major vendor (Parts Express, Mouser, Digikey). Do not use random or unknown third-party sites.
- **PDF link priority (strict):** manufacturer site PDF > Parts Express / Mouser / Digikey PDF > skip and fall back to human review. Never use an unknown site.
- **Fallback to human review.** If no extractable PDF can be found after web search, use `scripts/verify-vas-tiny.py` — it opens the cached PDF in the local viewer and prompts for the field value.
- **Add DQ post-check.** After writing any fix to a WDR, re-run `check_fields()` and confirm the flag is cleared. If the flag remains, the fix value is wrong or the rule threshold needs review.

## Precision in communication — ALWAYS NAME THE EXACT DEVICE

**This rule is non-negotiable. Violations make findings unverifiable and waste the human's time.**

Every finding, diagnosis, example, or data quality report **must** identify the exact device(s) involved by full brand + model. No exceptions, no abbreviations.

**BANNED phrases — never write these:**

- "an 8Ω driver", "a large woofer", "a tweeter", "some drivers", "certain models"
- "those drivers", "these files", "the affected ones", "the page", "the issue"
- "etc.", "and others", "and similar", "among others"
- "a driver with X problem", "drivers in this family"

**Required replacement — always write the actual name AND the actual values from that device:**

- Wrong: "an 8Ω driver where Znom extracted as 82"
- Right: "Scan-Speak 10F/8414G10: OCR extracted Znom=82 from the text `Nominal impedance [Zn] 82` in `drivers/new_ss_tool/datasheets/10f-8414g10.pdf`; correct value is 8 Ω (HTML source: `https://www.scan-speak.dk/product/10f-8414g10/`)"
- Wrong: "those pages showed incorrect values"
- Right: "`https://www.scan-speak.dk/product/11m-4631g05/` (Scan-Speak 11M/4631G05): Vas extracted as 0.271 m³ from OCR text `Equivalent volume [Vas] 271`; correct value is 0.0027 m³"

The example must be **verifiable by the human without any further lookup**. If the human has to open a file or visit a URL just to check whether your example is accurate, the example is not specific enough.

**When reporting a data quality problem, always state all six:**

1. Exact driver: brand + model (e.g. "Scan-Speak 15M/4531K00")
2. Exact field: field name (e.g. "Vas")
3. Exact wrong value: the number the tool extracted, **plus the local file path and location within the file where that value was found** (e.g. "0.161 m³ — extracted from `drivers/new_ss_tool/datasheets/15m-4531k00.pdf`, T/S parameters table, row 'Equivalent volume [Vas]'")
4. Exact correct value: what the authoritative source says, **with the URL or local file path so the human can verify it without asking you** (e.g. "0.016 m³ per `https://www.scan-speak.dk/product/15m-4531k00/`, cached at `drivers/new_ss_tool/_html/15m-4531k00.html`, second table, row 'Equivalent Volume'")
5. Exact cause: the verbatim raw text string that was misread, and which tool misread it (e.g. "OCR returned the line `Equivalent volume [Vas] 161`; decimal point between `16` and `1` was dropped by tesseract")
6. Location in the file: describe where in the document the bad value appears (e.g. "3rd row of the Electrical Data table", "Key Features box top-right", "T/S parameter section, 5th row")

**If a list is long, enumerate every item.** Do not truncate. If there are 14 affected drivers, name all 14.

**If you cannot name the device with all five points above, you do not have enough information to report the finding.** Stop and look it up before writing anything.

---

## External claims — require evidence, label inline

- Never assert facts about external systems — tools (WinISD, LEAP, REW, etc.), websites, services, APIs, or data sources — without primary-source evidence obtained in the current conversation: a tool call, a fetched URL, a read file, or directly observed output.
- **The user must not have to verify my claims.** Any external claim that has not been verified in the current session must be flagged inline in the response with "⚠ unverified" before it reaches the user — not corrected after they catch it.
- Inferred or assumed behaviour **must** be labelled as such in code comments, docs, and conversation. Record tool-behaviour assumptions in `WINISD.md` (or the relevant tool's notes file) with an explicit "⚠ Assumption — NOT directly verified" marker and a verification procedure.
- Example violations to avoid: stating "WinISD uses 2.83 V fixed" without a source; stating "Eminence publishes machine-readable data files" without having fetched evidence of this.
- **Hard gate:** Before making any comparative or causal claim about an external system ("X works because…", "unlike Y which…", "Y publishes…", "Z supports…"), call `advisor` to review the claim. Do not state it to the user until advisor has confirmed it is grounded.
