# Claude Code rules for this project

## Quality gates — non-negotiable

**Never claim success, "done", "fixed", or "ready to check" until every relevant gate is 100% green — run them, do not assume.** Before any "done" claim, run the COMPLETE gate `bash scripts/health-check.sh` (lint + unit + golden + browser + DQ + scraper) — not a hand-picked subset. A subset that passes is not evidence the suite passes.

| Domain                           | Gate              | Command                                 |
| -------------------------------- | ----------------- | --------------------------------------- |
| Python scrapers                  | pytest suite      | `python -m pytest scripts/scrapers/ -v` |
| JS core (`packages/engine/src/`) | unit tests        | `npm run test:unit`                     |
| JS UI (Vue/Playwright)           | browser suite     | `npx playwright test`                   |
| All code                         | lint              | `npm run lint` (0 errors)               |
| All                              | full health check | `bash scripts/health-check.sh`          |

**A red result is red — no excuses.** You may NOT step past a failing test, lint error, or console/network error by calling it "pre-existing", "stale", "unrelated", "flaky", "HMR", or "someone else's". Regardless of who caused it or how long ago, either make it green or STOP and investigate the cause with primary evidence (read the actual error/log output) before doing anything else. Attributing red to a cause you have not proven is the exact failure that let issues survive for hours. If a failure is genuinely pre-existing, that means the tree was already broken and fixing it is now your job, not your excuse.

**Enforcement (git hooks, `core.hooksPath=scripts/hooks`):** `pre-commit` runs lint + unit + golden and **blocks the commit on any red** (so red cannot ride along commit-to-commit); `pre-push` runs the full `npm run ci`. Never bypass with `--no-verify`. Fresh clones must run `git config core.hooksPath scripts/hooks` once.

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

## Shell environment — WSL (or Windows Git Bash)

The primary dev environment is **WSL2 (Ubuntu) on Windows 11**. Scripts must also keep working under **Windows Git Bash**, since the same tree may be driven from either. PowerShell and cmd are not supported.

**AI must:**

- Always use the **Bash** tool for shell commands. Never PowerShell.
- Write scripts that work on **both WSL and Git Bash**. Do not hardcode Windows-only tooling (`taskkill`, `tskill`, `ps -W`, `netstat -ano`) without a POSIX branch, and resolve `python` vs `python3` rather than assuming one exists.
- Include the environment guard in every new script in `scripts/`, immediately after `set -euo pipefail`:
  ```bash
  # Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
  # PowerShell/cmd have no /proc, so they are still rejected.
  { [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }
  ```
  `MSYSTEM` is set by Git Bash (`MINGW64`/`MINGW32`); WSL is detected by `microsoft` in `/proc/version`. Both PowerShell and cmd lack `/proc`, so they are rejected.

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

## Safe restricted tools — prefer them, and build more

**The project ships purpose-built, sandboxed CLI tools in `.claude/tools/` that are safe to auto-approve because they are read-only and locked to the project tree.** Prefer them over the raw command they replace.

**For in-project content search, use the built-in `Grep` tool** — the rule is: never reach for unrestricted `grep` over a broad path when a confined tool covers the need.

**When you notice yourself issuing a broad, unrestricted command repeatedly (search, read, list, fetch), reflect and propose a safe restricted tool for it** — least privilege, project-scoped, read-only, whitelisted functionality, no traversal, no code execution, so a blanket `Bash(<tool>:*)` grant stays safe. The **`safe-tools`** skill is the reference for how to build one and how to wire it into config. Add the tool to a table here and to `.claude/settings.json` when you do.

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
- `PLAN.md` — re-architecture phases and scope guards (read before touching `packages/engine/src/` or any structural change)
- `ARCHITECTURE.md` — hard architectural decisions
- `DEVELOPMENT.md` — coding practices and testing contract
- For driver data tasks: `WDR_SCHEMA.md`, `drivers/WDR_FILE_MODEL_AND_WORKFLOWS.md`
- For WinISD-related tasks: `WINISD.md`

**Load the relevant context file for the task domain:**

| Task type                                                      | Load                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Python scraper work (parsing, extraction, field mapping)       | `.claude/context/scraping-rules.md` · `.claude/context/testing-python.md`    |
| Driver data files (WDR / `_meta.yml`)                          | `.claude/context/scraping-rules.md` · `.claude/context/driver-data-rules.md` |
| JS core functions (`packages/engine/src/`, engine, alignments) | `.claude/context/testing-js-core.md` · `.claude/context/engine-rules.md`     |
| Vue components, CSS, stores, UI wiring                         | `.claude/context/ui-rules.md` · `.claude/context/testing-js-ui.md`           |
| JS I/O or calculation functions (engine.js, loaders)           | `.claude/context/js-patterns.md`                                             |
| Any change claimed "ready to check"                            | `.claude/context/testing-js-ui.md` (post-deploy smoke test)                  |

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

---

## Claims about OUR OWN code — same evidence bar — hard rule

The evidence rule above is not limited to external tools. Most damaging mistakes are confident, wrong statements about _this_ codebase.

- **Never assert what this app has, does, or lacks without reading the relevant source in the current conversation.** "OpenISD has no input for X" / "this is only used for Y" / "nothing computes Z" are claims — grep or read the actual file first. A type definition (e.g. `DriverRaw`) is NOT proof of what the whole app can do; the UI, store, and scrapers are separate layers with their own fields.
- **Search before you build.** Before implementing any mechanism — state tracking, a computation, a mapping, serialization, a formatter — grep the codebase for an existing implementation. If the domain already solves it (e.g. `stateOf()` already tracks entered-vs-calculated), use or extend it. Never reinvent it in another layer.
- **A hardcoded literal standing in for data that should vary per record is a correctness bug, not cosmetic.** When you find one, find the intended source of truth and fix it as a bug. Do not label it "maintainability" and defer it.
- **Serialization to a format defined by someone else (WDR/WinISD, JSON project, etc.) must reflect real state/provenance for every field — never a fixed placeholder.** If you can't source a field's true value, that's a gap to surface, not a constant to invent.
- **Provenance — which values a human supplied vs the app computed — is sourced where entry happens** (the UI/edit session), not reconstructed downstream from "is it present." Presence cannot distinguish Entered from Calculated.

**When the user pushes for speed ("do all", "just do it"), that raises the verification bar, not lowers it.** A confident wrong commit is worse than a slower correct one.
