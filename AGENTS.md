<!-- LOCAL RULES ONLY. Generic workspace rules live in the parent. -->

@../_agent_files/_AGENTS.md

> **Scope of this file: openisd ONLY.**
> Workspace-wide rules live in **`../_agent_files/_AGENTS.md`** and are explicitly imported above via `@../_agent_files/_AGENTS.md`.
>
> **Anything here that would also be true of another repo belongs in `../_agent_files/_AGENTS.md`.** Promote
> it — add it there and delete it here in the same change. Never keep a copy in both.

---

# Claude Code rules for this project

## Priority Skin — hard rule

**THE HUMAN EXPECTS THE AGENT TO MAINTAIN THE ORIGINAL SKIN AND ITS LOGIC. NOT THE MODERN
SKIN, NOR THE CLASSIC SKIN.** Those two skins are present in the codebase but are **NOT
CURRENTLY MAINTAINED**. Do not read, reference, search, fix, extend, or otherwise touch
Classic or Modern code for their own sake — the human does not visit those views anymore.

The only permitted exception: touching Classic/Modern **as strictly necessary to support an
Original-skin change** (e.g. a shared component both Original and another skin import, where
Original's fix requires touching the shared file). Even then, change only what Original's fix
requires — do not proactively fix, clean up, or improve Classic/Modern while there.

Unless the human explicitly names Classic or Modern, assume every request is about Original.

## Priority TDD Behaviour

When perfroming TDD functions tell the user you are doing TDD.

When a TDD turn begin NEVER start by editing a main source file, always create a failing scenario then work on the source files.

## Quality gates — non-negotiable

**Never claim success, "done", "fixed", or "ready to check" until every relevant gate is 100% green — run them, do not assume.** Before any "done" claim, run the COMPLETE gate `bash scripts/health-check.sh` (lint + typecheck + unit + browser) — not a hand-picked subset. A subset that passes is not evidence the suite passes.

**Concurrent and isolated test execution:**

- **Never run two copies of the test suite (health-check or browser test) at the same time.** Always inspect active tasks and explicitly kill any stale/older run before starting a new one.
- **Do not run the full suite when an isolated test is sufficient.** Running the entire suite kills productivity. During the TDD/implementation loop, run only the specific target test file (e.g., `npx playwright test <path-to-test>`). Save the full health check (`bash scripts/health-check.sh`) only for the final verification gate.

| Domain                           | Gate              | Command                        |
| -------------------------------- | ----------------- | ------------------------------ |
| JS core (`packages/engine/src/`) | unit tests        | `npm run test:unit`            |
| JS UI (Vue/Playwright)           | browser suite     | `npx playwright test`          |
| All code                         | lint              | `npm run lint` (0 errors)      |
| All                              | full health check | `bash scripts/health-check.sh` |

**A red result is red — no excuses.** You may NOT step past a failing test, lint error, or console/network error by calling it "pre-existing", "stale", "unrelated", "flaky", "HMR", or "someone else's". Regardless of who caused it or how long ago, either make it green or STOP and investigate the cause with primary evidence (read the actual error/log output) before doing anything else. Attributing red to a cause you have not proven is the exact failure that let issues survive for hours. If a failure is genuinely pre-existing, that means the tree was already broken and fixing it is now your job, not your excuse.

**Enforcement (git hooks, `core.hooksPath=scripts/hooks`):** `pre-commit` runs lint + unit + golden and **blocks the commit on any red** (so red cannot ride along commit-to-commit); `pre-push` runs the full `npm run ci`. Never bypass with `--no-verify`. Fresh clones must run `git config core.hooksPath scripts/hooks` once.

**Doc-only exception:** when a commit (or the full set of commits in a push) touches **only** `*.md` files, `pre-commit`/`pre-push` skip lint/typecheck/test/CI automatically — a doc-only change has no runtime behaviour for those gates to check. This is enforced by the hooks themselves (they detect doc-only via `git diff --name-only`), not by passing `--no-verify` — any commit/push that includes even one non-`.md` file always runs the full gate. Never use `--no-verify` to get this effect manually.

**Link Formatting Rules:**

- **In repository `.md` files**: Always use relative links (e.g. `docs/spec/SPEC_ENGINE.md#L30` or `../../docs/spec/SPEC_ENGINE.md`).
- **In AI prompt outputs / responses to the user**: ALWAYS format links using `http://localhost:8000/winisd/openisd/...` URLs (appending `?html` before line anchors for `.md` files, e.g. `http://localhost:8000/winisd/openisd/docs/spec/SPEC_ENGINE.md?html#L30`) so they render as HTML in the documentation viewer. NEVER output `file://` URLs.

**TDD — red→green, in this order (HARD RULE — USE TDD EXCLUSIVELY FOR ALL CHANGES):**

1. Write a test that reproduces the bug or specifies the feature, and fails (for the right reason).
2. Watch it fail.
3. Apply the fix/implementation.
4. Watch it pass.
5. Run the domain-specific test suite.

Never reorder. "I added a test and a fix" without having seen the test fail first is not TDD. Every single code modification or feature addition MUST have a corresponding failing test written and observed first.

**For test-first feature or bug work, invoke the `/test-driven-development` skill** — the red→green-refactor workflow reference (what a good test is, where tests go, the anti-patterns, and the rules of the loop). Consult it before and during the loop, not after.

**Two suites, both required.** `packages/engine/src/`: Vitest (`npm run test:unit`) — fast,
deterministic, no browser; physics gates (sealed≡closed-form, sensitivity, vented rolloff +
twin Z-peaks), `.wdr` parse/serialize round-trips, alignment + PR math. UI behavior:
Playwright (`npx playwright test`) — **jsdom/no-op stubs prove "the script didn't throw," not
that a curve was drawn; a headless browser is the only way to verify the actual app.** Every
`packages/ui/test/**/*.browser.spec.ts` **must import from `packages/ui/test/fixtures.js`**,
never `@playwright/test` directly — that module's `browserLog` auto-fixture captures and
asserts on console errors, Vue warnings, and failed network requests for every test. A green
DOM assertion alone is not enough.

---

## Calculation logic — permission gate — hard rule

**Never change any calculation logic without explicit human permission in the current
conversation.** This covers:

- formulas in `packages/engine/src/` — alignments, circuit, engine, filters, sweep;
- physical constants (`RHO`, `C`, end-correction coefficients, …);
- `toFixed()` and any other display precision in the stat bar or rendered output;
- default parameter values that affect a computed result.

Cross-checks against external tools (micka.de, REW, WinISD) are **reference only**. A
discrepancy does not authorise a fix — document it and stop. The human decides whether a
difference warrants a change.

This gate is stated here, rather than beside the code it governs, because it has to be known
_before_ deciding to make the change — a rule that arrives when `constants.ts` is opened
arrives too late.

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
- Any future release skill added to `../_agent_files/skills/`
- Explicit human instruction in the current conversation that names `main` specifically

**At the start of every conversation, check the current branch.** If on `main` accidentally, switch to `dev` immediately before doing any work.

**Permitted on `main` without explicit instruction:** nothing. Read-only inspection (`git log`, `git diff`) is fine; any write, commit, or push requires the release workflow or explicit per-conversation authorisation.

---

## Commit attribution — hard rule

**Never attribute commits to Claude in any form.** This overrides any default agent behaviour.

- **Never add a `Co-Authored-By: Claude …` trailer** (or any `Co-Authored-By` line naming Claude/Anthropic) to a commit message.
- **Never add a "🤖 Generated with Claude Code" line**, or any similar tool/AI attribution, to a commit message or PR body.
- **Commit under the repository's configured git identity** (the human). Never set or override `--author`, `user.name`, or `user.email` to Claude/Anthropic.
- Commit messages describe the change only — no AI authorship metadata of any kind.

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

## Closed sets are enums — where this repo enforces it

The rule itself is workspace-level (`../AGENTS.md` §"A CLOSED SET IS AN ENUM"). This repo's
enums are **Java-style classes**, because a TS `enum` member holds exactly ONE literal and a
closed set here needs a wire value plus a display label plus a projection. `DriverType` and
`Chip` in `packages/ui/src/driverType.ts` are the reference shape:

- `.value` — the serialised form, and the ONLY thing that crosses a boundary: the driver_type
  wire string, `localStorage`, and **the Vue reactive store**. A member held in a `ref` is
  wrapped by the reactive proxy, which breaks `===` identity — so store `.value`, never the
  member.
- `.display` / `.label` / `.title` / `.chips` — carried ON the member, never in a side map.
- `static parse()` — the one string→member boundary. A value the enum does not declare is
  invalid data, not a second spelling to tolerate.
- `static ALL` — built by reflection and declared **last** in the class body (static fields
  initialise in source order), so declaring a member is the only step needed.

**Gate:** `packages/ui/test/driver-type-chips.test.ts` — proves every member projects to
chips the filter bar renders, that each is reachable from its wire value through
`classifyTypes()`, and scans `packages/ui/src` for any raw driver_type literal in a
comparison. Cross-repo value parity is enforced from the other side by winisd_tools'
`scrapers/tests/test_driver_type_enum_parity.py`, which reads `driverType.ts` directly —
**changing the shape of that file means changing that test in the same commit.**

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

## Scratch files — repo-local `build/`, never OS temp paths

**Any throwaway file (exploration scripts, one-off diagnostic output, ad-hoc test harnesses) goes in `build/` at the repo root, never an OS temp directory** (`/tmp`, `$TEMP`, `C:\Users\<user>\AppData\Local\Temp\...`).

**Why:** an absolute OS temp path is invisible to the repo, breaks on any other machine/OS, and is easy to forget to clean up. `build/` is git-ignored (`.gitignore`) so nothing there is ever committed, but it stays inside the project tree — inspectable, relative-pathed, and obviously disposable.

**How to apply:** when writing a quick exploration script (e.g. probing an external site's form fields, a scratch computation) or redirecting command output for later reading, write it to `build/<descriptive-name>` and delete it once its job is done. Never invent a path under `$TEMP`/`%TEMP%`/`/tmp` for anything project-related.

---

## AI role — build tools, don't perform ad-hoc tasks

**Create reusable scripts for recurring tasks; never write an inline one-liner when a script already exists or should exist.** Check `scripts/` first.

**This principle does NOT apply to driver data files.** Scripts that touch, patch, normalise, backfill, or otherwise modify files in `drivers/` are banned. Driver data is produced by winisd_tools and lands here as records; openisd never rewrites it.

**`drivers/matt/` is human-curated and protected.** Never touch it in any script or batch
edit; stop and warn the human if a task would reach it. Only a human sets `reviewed_by` or
any "human-verified" language on a driver record — an agent never sets it, on any file.

**Available utility scripts:**

| Script                          | Purpose                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `scripts/start-http.sh`         | Vite dev on 4000. Runs health-check first, kills the port, starts in bg. Writes PID to `.server-4000.pid`. |
| `scripts/stop-http.sh`          | Stop the server on 4000.                                                                                   |
| `scripts/kill-http.sh [port …]` | Kill all processes on specified ports. Never call ad-hoc — use stop-http.sh.                               |
| `scripts/preview-4000.sh`       | Human's lightweight preview: kills 4000–4005 then starts `vite preview` on 4000 (no health checks).        |
| `scripts/build-release.sh`      | Production dist build (`GITHUB_PAGES=true`). Release workflow only; never run ad-hoc.                      |
| `scripts/health-check.sh`       | All health checks: lint, type check, unit tests, browser tests. Single entry point.                        |

---

## Safe restricted tools — prefer them, and build more

**The project ships purpose-built, sandboxed CLI tools in `.claude/tools/` that are safe to auto-approve because they are read-only and locked to the project tree.** Prefer them over the raw command they replace.

**For in-project content search, use the built-in `Grep` tool** — the rule is: never reach for unrestricted `grep` over a broad path when a confined tool covers the need.

**When you notice yourself issuing a broad, unrestricted command repeatedly (search, read, list, fetch), reflect and propose a safe restricted tool for it** — least privilege, project-scoped, read-only, whitelisted functionality, no traversal, no code execution, so a blanket `Bash(<tool>:*)` grant stays safe. The **`safe-tools`** skill is the reference for how to build one and how to wire it into config. Add the tool to a table here and to `.claude/settings.json` when you do.

---

## 4000 IS THE ONLY APP PORT — human standing order, hard rule

**The human's words (2026-08-05): "use 4000 for your builds in future no other port — I use
4000 and I need the app to work".**

| Port | Purpose                                                                | Started by                |
| ---- | ---------------------------------------------------------------------- | ------------------------- |
| 4000 | **The app.** Every build, preview and check — the human's live window  | `scripts/preview-4000.sh` |
| 4100 | Playwright's own vite, started and torn down by the test runner itself | `playwright.config.js`    |

- **The AI starts NO server on any other port.** No `npx vite --port <n>`, no `npm run dev` on an ad-hoc port, no second instance "just to probe". A check that needs a running app uses 4000.
- **4100 belongs to Playwright.** `npx playwright test` starts and stops it; never start it or point a probe at it by hand. An interrupted run leaves it held and the next run refuses with "4100 is already used" — clearing that stale one with `bash scripts/kill-http.sh 4100` is the exception, and only when no run is in flight.
- **A stray server the AI left on any other port is killed on sight** — `bash scripts/kill-http.sh <port>`.

### Bundling implies a running preview on 4000

**"Bundle", "rebuild the bundle", or "rebuild the dist" is also a request to leave
`http://localhost:4000/` serving that build.** The point of a rebuild is to look at it, so
finishing the build and leaving no server up delivers half the request.

- After any `node scripts/bundle-drivers.mjs`, `npm run build`, or `bash scripts/build-release.sh`, start the preview with `bash scripts/preview-4000.sh` (backgrounded) if it is not already up.
- **Verify before reporting done:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/` → must be 200, **and** the asset filename it serves must match the one just written to `packages/ui/dist/assets/`. A build reported without both checks is not reported as done.
- **Keep the port 4000 server up-to-date:** Since the human reviews changes live on port 4000, ensure it always serves the latest build matching the current working tree.
- **Avoid redundant driver bundle refreshes:** Do NOT run `node scripts/bundle-drivers.mjs` to refresh the drivers database if only TypeScript/Vue/CSS application code has changed. Reuse the existing bundle to speed up build and testing cycles.
- **Refresh the driver bundle on upstream changes only:** Rebuild/refresh the driver bundle only when there is clear evidence of upstream changes inside `winisd_drivers/` or the drivers source directory.

### 4000 serves the BUILD, never the working tree

`vite preview` serves `packages/ui/dist`. A source edit is invisible there until `npm run
build` runs, so "the fix isn't showing on 4000" is a stale-bundle report until proven
otherwise: compare the served asset hash against `packages/ui/dist/assets/` before looking
for a bug in the code. Every source change the human is asked to look at ends with a build.

- **Unregister any stale service worker** before handing off — run `const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister();` on `http://localhost:4000`.

---

## Transient files live in `build/` — hard rule

**Anything transient goes in `build/` at the repo root**, so its status is obvious from its path: throwaway scripts, probe output, redirected logs, one-off diagnostic dumps. `build/` is git-ignored and excluded from Vite's file watcher, both proven by `packages/ui/test/config.test.ts`. Never invent a cache or scratch directory somewhere else in the tree, and never write project files to an OS temp path.

`drivers/` holds driver data only. Cache directories arriving with a collection from the pipeline that produced it are `_`-prefixed and ignored by `.gitignore` and Vite; this repo does not create them.

---

## Markdown formatting

After writing or editing any `.md` file that contains tables, run `npx prettier --write <file>`.

---

## Reading context — what to load per task

**Nothing in this repo auto-loads — including this file.** Claude Code injects only
`~/.claude/CLAUDE.md` and its `@` imports. `AGENTS.md` is not a name it auto-loads, and
`../_agent_files/_CLAUDE.md` is underscore-prefixed, which prevents the auto-load `CLAUDE.md`
would get — a deliberate choice, explained in `../_agent_files/README.md`. Every file named
below reaches an agent only because `~/.claude/behavioral_instructions.md` §"EXPLICIT RULE
LOADING" tells it to go and read them. Treat that as the mechanism; there is no other.

Before starting work, always read:

- `BACKLOG.md` — feature backlog (P0 gates all feature work)
- `ARCHITECTURE.md` — hard architectural decisions, the component diagram and the dependency
  rules (read before touching `packages/engine/src/` or any structural change)
- `docs/design/DRIVER_RECORD_MODEL.md` — what openisd stores about a driver; the design
  authority for driver-data tasks
- `docs/spec/SPEC_ENGINE.md`, `docs/spec/SPEC_UI.md` — the engine and UI contracts
- `docs/plans/OPENISD_MODEL_MIGRATION_READINESS.md` — where the AD-8/AD-9 migration stands, the
  checks that block it, and the divergences the new model must preserve (read with
  `docs/plans/PLAN_OPENISD_DRIVER_MODEL.md` before any driver-model work)

> ⚠ **The two WinISD documents below are OBSOLESCENT as primary guidance — they are
> WinISD-focused, and WinISD is no longer the model this app is built on.** `ARCHITECTURE.md`
> AD-8 makes `OpenISDDriver`/`openisd.yml` the app's data model and demotes `.wdr` to a
> serialisation format generated on demand. Read them as **reference for the foreign format and
> for parity evidence** — never as a statement of how openisd should be shaped. If one of them
> and `DRIVER_RECORD_MODEL.md` disagree about our own record, `DRIVER_RECORD_MODEL.md` wins.
>
> - `docs/design/WDR_SCHEMA.md` — reverse-engineered facts about WinISD's `.wdr` format
> - `docs/research/WINISD_PARITY.md` — parity evidence and investigation notes

**Coding rules for each area — READ THEM BY HAND from `../_agent_files/rules/`.** The `paths:`
frontmatter on each file records which globs it governs, so you can tell at a glance which
one your task needs; it is documentation, not a trigger. Nothing auto-loads these — the whole
`_agent_files/` directory is deliberately outside every auto-load path
(`../_agent_files/README.md`).

| Rule file                    | Governs                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `openisd-result-contract.md` | `packages/{engine,winisd}/src/`, `packages/ui/src/{logic,db,diagnostics,logging}/` |
| `openisd-engine-source.md`   | `packages/engine/src/`                                    |
| `openisd-engine-tests.md`    | `packages/{engine,winisd}/test/`                          |
| `openisd-ui-design.md`       | `packages/ui/src/`                                        |
| `openisd-ui-tests.md`        | `packages/ui/src/`, `packages/ui/test/`                   |

**Read these yourself for the task domain** — they are documents, not scoped rules:

| Task type                                                      | Load                                              |
| -------------------------------------------------------------- | ------------------------------------------------- |
| JS core functions (`packages/engine/src/`, engine, alignments) | `ARCHITECTURE.md` §AD-4 "Extract, do not rewrite" |
| Vue components, CSS, stores, UI wiring                         | `docs/spec/SPEC_UI.md` §4 (UI-1…UI-4)             |
| A field's unit, `:scale`, unit group, or a `.wdr`/`.wpr` value | `docs/research/UNIT_BOUNDARY_AUDIT.md` — file/SI/display/WinISD unit per field, with the oracle for each |
| Either                                                         | "Two suites, both required" above                 |

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

## External claims — require evidence, label inline — hard rule

- Never assert facts about external systems (WinISD, LEAP, REW, websites, APIs) without primary-source evidence obtained in the current conversation: a tool call, a fetched URL, a read file, or directly observed output.
- **NEVER DEFEND AN INFERRED ROOT CAUSE OR CONJECTURE AS FACT.** If the exact internal binary execution path, disassembly, or code line of an external tool is not directly observed, explicitly state that it is an unverified hypothesis (`⚠ unverified`). Never double down, speculate, or defend inferred internal mechanisms to the human.
- **Render JS SPAs with Playwright — do not conclude a page is empty from `WebFetch`/`curl`.** Most modern tool sites (loudspeakerlab.io, speakerboxlite.com, simulator.00aud.io, speakerdesign.dev, sonella.app …) are client-side SPAs: `WebFetch` and `curl` return only the empty app shell, which is **not** evidence about the tool. To get primary-source evidence, drive the site with headless Chromium via the repo's Playwright (`@playwright/test` — `import { chromium }`), `waitUntil: 'networkidle'`, expand any accordions/tabs, then read `document.body.innerText`. Put the throwaway probe script in `build/` (never `/tmp`) and delete it when done. Forum posts and search snippets are second-hand — prefer the rendered app, and only fall back to them when the app cannot be driven. Findings obtained this way are directly observed output (primary evidence); still mark anything the render did not settle as "⚠ unverified".
- **The user must not have to verify my claims.** Any unverified external claim must be flagged inline with "⚠ unverified" before it reaches the user.
- Inferred or assumed behaviour **must** be labelled as such. Record tool-behaviour assumptions in `docs/research/WINISD_PARITY.md` with an explicit "⚠ Assumption — NOT directly verified" marker.
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

---

## For new human contributors

You do not need to be an acoustician to help here. If you can edit a Vue component or open
a pull request, you can contribute.

**Quick start:** read `ARCHITECTURE.md` (hard decisions) and this file's Quality Gates section
above, then `npm install && bash scripts/health-check.sh`. Pick work from `BACKLOG.md` — P0
gates everything else. Never hand-edit driver data under `drivers/`; it's produced by
`winisd_tools` and lands here as records — a wrong value is fixed at the source, not patched
here. `drivers/matt/` is human-curated and off-limits to any script or agent.

**Who owns what:**

| Concern                                     | Human          | Agent      | Tooling             |
| ------------------------------------------- | -------------- | ---------- | ------------------- |
| What to build / priority (`BACKLOG.md`)     | **Decides**    | Suggests   | —                   |
| Physics & calculation correctness           | **Decides**    | Implements | Cross-check (ref)   |
| `packages/engine/src/` formulas & constants | **Approves**   | Proposes   | Unit + oracle tests |
| Driver data (`drivers/**`)                  | Authorises     | Reads only | winisd_tools writes |
| `drivers/matt/` (human-curated)             | **Owns**       | Excludes   | Excludes            |
| `reviewed_by` / "human-verified" flags      | **Only**       | Never sets | —                   |
| Tests                                       | Reviews        | **Writes** | Runs (CI)           |
| Commits & merges                            | **Authorises** | Drafts msg | —                   |

Rule of thumb: **human owns truth and intent, agent owns encoding and diligence, tooling owns
repeatability.**

**Project shape** (current — `packages/` is a monorepo, not a single `src/`):

- `packages/engine/src/` — the physics engine, alignments, state. Pure TS, no DOM.
- `packages/model/src/` — the OpenISD record and `OpenISDDriver`: the driver model, its
  provenance and its derivation. Pure TS, no DOM, no file format.
- `packages/winisd/src/` — WinISD interop: `.wdr`/`.wpr` parse/serialize, E/C/N provenance.
- `packages/ui/src/` — Vue 3 UI, layered `ui/`/`logic/`/`db/`/`diagnostics/`/`logging/`.
- `drivers/` — community driver records.

**How the engine works, conceptually:** a lumped-element electro-mechano-acoustical circuit
solved in the acoustical impedance analogy, one complex value per frequency
(`packages/engine/src/sweep.ts`/`circuit.ts` — see `ARCHITECTURE.md` AD-6 for the full layer
diagram, `docs/spec/SPEC_ENGINE.md` for the actual formulas with test citations). `eg` is
**RMS**, so SPL is RMS-referenced; excursion and port velocity are reported as **peak** (×√2)
against Xmax/chuffing limits. For a vented/PR box, net radiated volume velocity is
`U_0 = U_D − U_port` — the minus sign is load-bearing, it's what gives the 24 dB/oct rolloff;
don't "simplify" it away.

**Pull requests:** keep changes focused, describe what and why; if it touches the engine,
paste the test output. By contributing you agree your work is released under the project's
MIT license.
