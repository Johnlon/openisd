# Claude Code rules for this project

## Quality gates — non-negotiable

**Never claim success, "done", "fixed", or "ready to check" until every relevant gate is 100% green — run them, do not assume.**

| Domain                 | Gate              | Command                                 |
| ---------------------- | ----------------- | --------------------------------------- |
| Python scrapers        | pytest suite      | `python -m pytest scripts/scrapers/ -v` |
| JS core (`src/core/`)  | unit tests        | `node --test test/*.test.mjs`           |
| JS UI (Vue/Playwright) | browser suite     | `npx playwright test`                   |
| All code               | lint              | `npm run lint` (0 errors)               |
| All                    | full health check | `bash scripts/health-check.sh`          |

**TDD — red→green, in this order:**

1. Write a test that reproduces the bug and fails (for the right reason).
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Run the full gate for the domain.

Never reorder. "I added a test and a fix" without having seen the test fail first is not TDD.

**For test-first feature or bug work, invoke the `/tdd` skill** — the red→green-refactor workflow reference (what a good test is, where tests go, the anti-patterns, and the rules of the loop). Consult it before and during the loop, not after.

**Domain-specific testing rules:** `.claude/context/testing-python.md` · `.claude/context/testing-js-core.md` · `.claude/context/testing-js-ui.md`

---

## Linting — hard rule

**Never work around the linter:**

- Never add `// eslint-disable`, `/* eslint-disable */`, or any per-line/per-file ESLint suppression.
- Never rename a variable to `_foo` solely to bypass `no-unused-vars`.
- Never delete code just to silence a lint error — fix the underlying problem.

---

## Branch model — hard rule

**`dev` is the working branch. All development, scraping, and feature work happens on `dev`.**

**`main` is the release branch. Reserved exclusively for production releases.**

**AI must never commit to or push `main` directly** except through the approved release workflow:

- `/release-drivers` skill (driver data releases)
- Any future release skill added to `.claude/skills/`
- Explicit human instruction in the current conversation that names `main` specifically

**At the start of every conversation, check the current branch.** If on `main` accidentally, switch to `dev` immediately before doing any work.

**Permitted on `main` without explicit instruction:** nothing. Read-only inspection (`git log`, `git diff`) is fine; any write, commit, or push requires the release workflow or explicit per-conversation authorisation.

---

## AI-locked files

Files with a header comment containing "AI LOCKED — DO NOT EDIT" are protected. Never edit them, even if given explicit permission in conversation. The human must remove the lock comment first.

---

## No history in documentation — hard rule

**Never write history into any `.md` file.** No "As of \<date\>…", no "What was removed / what replaced X" blocks, no closed-item records `[x]` with a **Closed:** description, no "Previously this was called…" notes.

**Why:** Documentation must reflect current best knowledge only. Git history and commit messages are the authoritative record of what changed and why.

**If tempted to record history:** write it in the commit message instead and move on.

**The single sanctioned exception is `LOG.md`.** It is the one file allowed to record change over time, because it records the **value** of changes (functional/quality/procedural benefit), not their mechanics — see the "Value log" rule below. No other `.md` file may carry history. Never delete `LOG.md` as "history clutter"; it is a deliberate, rule-governed exception.

---

## Value log — `LOG.md` maintenance — hard rule

`LOG.md` is the project's value log. It records **why each change was worth making**, not what the code did.

**Every entry is benefit-first:** state the functional, quality, or procedural benefit in plain language, then tersely how the change delivered it. One line per benefit.

- **Sell the value, then explain how — briefly.** "Find the right kind of driver fast. Multi-label type system + Fs/Sd/Z filters." Not a commit paraphrase, not a feature dump.
- **Plain, honest, no marketing voice.** No slogans, no "so the user can finally…", no cutesy section titles. If a thing is a rough prototype, say so. Overstated value is worse than none.
- **Group by day**, newest at the top; day heading is `## YYYY-MM-DD — <terse factual tag>`.
- **Maintain it at end of session.** When a working session lands changes worth a user or contributor knowing about, append that day's benefits before finishing. Skip pure churn (WIP saves, typo fixes) — the bar is "did this change what someone can do, how much they can trust it, or how the team works?"

Git remains the record of _mechanics_. `LOG.md` is the record of _value_.

---

## Shell environment — Windows + Git Bash only

This project runs on **Windows 11 with Git Bash**. Other OSes have not been considered.

**AI must:**

- Always use the **Bash** tool for shell commands. Never PowerShell.
- Not use WSL commands — WSL processes are in a separate namespace.
- Include the Git Bash guard in every new script in `scripts/`, immediately after `set -euo pipefail`:
  ```bash
  [ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1
  ```
  `MSYSTEM` is set by Git Bash (`MINGW64`/`MINGW32`) and absent in WSL, PowerShell, and cmd.

---

## AI role — build tools, don't perform ad-hoc tasks

**Create reusable scripts for recurring tasks; never write an inline one-liner when a script already exists or should exist.** Check `scripts/` first.

**This principle does NOT apply to driver data files.** Scripts that touch, patch, normalise, backfill, or otherwise modify files in `drivers/` are banned — see `.claude/context/scraping-rules.md`.

**Available utility scripts:**

| Script                          | Purpose                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/start-http.sh [port]`  | Vite dev on given port (default 4000). Runs health-check first, kills port, starts server in bg. Writes PID to `.server-<port>.pid`. |
| `scripts/dev-4200.sh`           | **AI primary start script.** Calls `start-http.sh 4200`. Use `stop-http.sh 4200` to stop.                                            |
| `scripts/stop-http.sh [port]`   | Stop server on given port (default 4000).                                                                                            |
| `scripts/kill-http.sh [port …]` | Kill all processes on specified ports. Never call ad-hoc — use stop-http.sh.                                                         |
| `scripts/preview-4000.sh`       | Human's lightweight preview: kills 4000–4005 then starts `vite preview` on 4000 (no health checks).                                  |
| `scripts/build-release.sh`      | Production dist build (`GITHUB_PAGES=true`). Release workflow only; never run ad-hoc.                                                |
| `scripts/health-check.sh`       | All health checks: lint, unit tests, golden tests, DQ validation, Python scraper tests. Single entry point.                          |

---

## Port assignments — hard rule

All project servers use ports in the 4000–4299 range only. Never use a port outside this range.

| Port | Purpose                                                 | Script                                                        |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------- |
| 4000 | Human's preview/dev server — **exclusive to the human** | `scripts/preview-4000.sh` or `scripts/start-http.sh` (no arg) |
| 4100 | Playwright browser tests — started by Playwright itself | `playwright.config.js`                                        |
| 4200 | Agent-started vite dev server                           | `scripts/dev-4200.sh` or `scripts/start-http.sh 4200`         |

Before starting any server: kill the target port first with `bash scripts/kill-http.sh <port>`. Never use `taskkill` ad-hoc.

---

## Dev server — hard rules

- **AI must start the dev server with `bash scripts/dev-4200.sh`.** Never use `npm run dev`, `npx vite`, or any ad-hoc command.
- **After starting, verify the page loads.** `curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/` → must be 200.
- **Unregister any stale service worker** before handing off to the user — run `const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister();` on `http://localhost:4200`.

---

## Driver collection subdirectories — hard rule

**Every subdirectory inside a driver collection (`drivers/<collection>/`) must start with `_`.**

- `_html/` — cached HTML pages (scraper cache)
- `_datasheets/` — cached PDF datasheets (scraper cache)
- `_ocr/` — OCR output cache
- `_problems/` — scraper problem logs

**Why:** Vite watches `drivers/` for changes. Subdirs that start with `_` are ignored by a single glob rule (`**/drivers/**/_*/**`), `.gitignore` ignores them with one pattern (`drivers/**/_*/`), and the bundler skips them with `entry.name.startsWith('_')`. A subdir that does NOT start with `_` silently breaks all three — Vite re-bundles on every PDF download, git tracks binary files, and the bundler tries to walk PDFs as WDRs.

**When creating a new cache subdir in a scraper**, always prefix with `_`. Never add a named exception to `.gitignore`, `vite.config.js`, or `bundle-drivers.mjs` — the `_` prefix covers it automatically.

---

## Markdown formatting

After writing or editing any `.md` file that contains tables, run `npx prettier --write <file>`.

---

## Reading context — what to load per task

Before starting work, always read:

- `BACKLOG.md` — feature backlog (P0 gates all feature work)
- `PLAN.md` — re-architecture phases and scope guards (read before touching `src/core/` or any structural change)
- `ARCHITECTURE.md` — hard architectural decisions
- `DEVELOPMENT.md` — coding practices and testing contract
- For driver data tasks: `WDR_SCHEMA.md`, `drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md`
- For WinISD-related tasks: `WINISD.md`

**Load the relevant context file for the task domain:**

| Task type                                                | Load                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Python scraper work (parsing, extraction, field mapping) | `.claude/context/scraping-rules.md` · `.claude/context/testing-python.md`    |
| Driver data files (WDR / `_meta.yml`)                    | `.claude/context/scraping-rules.md` · `.claude/context/driver-data-rules.md` |
| JS core functions (`src/core/`, engine, alignments)      | `.claude/context/testing-js-core.md` · `.claude/context/engine-rules.md`     |
| Vue components, CSS, stores, UI wiring                   | `.claude/context/ui-rules.md` · `.claude/context/testing-js-ui.md`           |
| JS I/O or calculation functions (engine.js, loaders)     | `.claude/context/js-patterns.md`                                             |
| Any change claimed "ready to check"                      | `.claude/context/testing-js-ui.md` (post-deploy smoke test)                  |

---

## Precision in communication — ALWAYS NAME THE EXACT DEVICE

**Non-negotiable. Violations make findings unverifiable.**

Every finding, diagnosis, example, or data quality report **must** identify the exact device(s) involved by full brand + model.

**Banned phrases:** "an 8Ω driver", "some drivers", "those files", "the affected ones", "etc.", "and others".

**Required:** actual name + actual values. The example must be verifiable by the human without any further lookup.

**When reporting a data quality problem, always state all six:**

1. Exact driver: brand + model
2. Exact field: field name
3. Exact wrong value + local file path + location within the file
4. Exact correct value + URL or local file path so the human can verify without asking
5. Exact cause: verbatim raw text string that was misread, and which tool misread it
6. Location in the file: row name, table, section

If you cannot name the device with all six points, you do not have enough information to report the finding — stop and look it up first.

---

## External claims — require evidence, label inline

- Never assert facts about external systems (WinISD, LEAP, REW, websites, APIs) without primary-source evidence obtained in the current conversation: a tool call, a fetched URL, a read file, or directly observed output.
- **The user must not have to verify my claims.** Any unverified external claim must be flagged inline with "⚠ unverified" before it reaches the user.
- Inferred or assumed behaviour **must** be labelled as such. Record tool-behaviour assumptions in `WINISD.md` with an explicit "⚠ Assumption — NOT directly verified" marker.
- **Hard gate:** Before any comparative or causal claim about an external system, call `advisor` to review the claim. Do not state it to the user until advisor has confirmed it is grounded.
