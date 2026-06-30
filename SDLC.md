# Resonate — Human / Agent / Tooling SDLC

This is the operating manual for how work gets done on Resonate. It defines who
does what across the three actors — **Human**, **AI Agent** (Claude Code), and
**Tooling** (scripts, schema, tests, CI) — and the order work flows through.

If you are a new human picking this project up: read the **Quick start** below,
then the **Who owns what** table. That is enough to be productive. The rest is
detail you can return to.

---

## Quick start (new human, 10 minutes)

1. Read `CLAUDE.md` (the rules every agent must follow), `ARCHITECTURE.md` (hard
   decisions), and `DEVELOPMENT.md` (testing contract).
2. `npm install`, then `npm test` (unit) and `npm run test:visual` (SPL canvas).
3. Pick work from `BACKLOG.md`. **P0 gates everything** — no feature work jumps P0.
4. Drive the AI agent: describe intent, let it propose a plan, approve, let it
   implement + test. You review, you decide, you authorise the commit.
5. Never hand-edit generated data (`drivers/**/*.wdr`, `*_meta.yml`). Fix the
   scraper and re-run. This is the single most important rule.

---

## Who owns what

| Concern                                 | Human          | Agent       | Tooling             |
| --------------------------------------- | -------------- | ----------- | ------------------- |
| What to build / priority (`BACKLOG.md`) | **Decides**    | Suggests    | —                   |
| Physics & calculation correctness       | **Decides**    | Implements  | Cross-check (ref)   |
| `src/core/` formulas & constants        | **Approves**   | Proposes    | Unit + oracle tests |
| Schema (`wdr_meta_schema.py`)           | **Approves**   | Proposes    | Runtime validation  |
| Scraper rules                           | Co-decides     | **Encodes** | Deterministic regen |
| Driver data (`*.wdr`, `*_meta.yml`)     | Authorises     | Reads only  | **Generates**       |
| `drivers/matt/` (human-curated)         | **Owns**       | Excludes    | Excludes            |
| `reviewed_by` / "human-verified" flags  | **Only**       | Never sets  | —                   |
| Tests                                   | Reviews        | **Writes**  | Runs (CI)           |
| Commits & merges                        | **Authorises** | Drafts msg  | —                   |
| Docs                                    | Approves       | **Drafts**  | prettier, linkcheck |

Rule of thumb: **Human owns truth and intent. Agent owns encoding and diligence.
Tooling owns repeatability.** Anything that must be reproducible belongs to
Tooling, never to a one-off human or agent edit.

---

## The lifecycle

### 1. Intake & plan

- Human states intent. Agent enters plan mode for anything non-trivial, explores
  the codebase read-only, and proposes a plan.
- Gate: `BACKLOG.md` P0 items block lower-priority feature work. `PLAN.md` and
  `ARCHITECTURE.md` gates apply before any `src/core/` or structural change.
- Human approves the plan before code is written.

### 2. Implement

- Agent writes code to match surrounding style, plus **direct unit tests** for
  every new `src/core/` function (non-negotiable per `DEVELOPMENT.md`).
- **Calculation-stability rule:** no formula, constant, or display precision in
  `src/core/` changes without explicit human approval in the session.
- **Schema-discipline rule:** no field is written to `.wdr`/`_meta.yml` unless it
  exists in `wdr_meta_schema.py`. New field → propose to human first.

### 3. Verify

- `npm test` (node:test unit), `npm run test:visual` (pixel-exact SPL canvas).
- `npm run test:crosscheck` is **reference-only** (hits micka.de) — a discrepancy
  is documented, never auto-fixed. Not in CI.
- `/verify` drives the real app when a change needs to be seen working.

### 4. Review

- Run `/code-review` (medium for routine, high before a risky merge). It checks
  correctness, reuse, simplification, efficiency, altitude, and CLAUDE.md
  conventions.
- Human reads findings and decides which to act on. Agent never self-approves.

### 5. Data pipeline loop (scrapers)

This loop is special because the output is **regenerable data**, not source.

```
scrape → schema-validate (gate) → dq_check → _problems.log → human review → fix SCRAPER → re-run
```

- A bad value is **never** patched in the data file. The only correct fix is in
  the scraper, because the next run wipes manual edits (`CLAUDE.md`: "No
  normalisation or fix-it scripts").
- Every scraper caches HTML to `_html/`, logs problems to `_problems.log`, and
  validates every written file before counting success.
- The whole `drivers/` tree must be reproducible from scrapers alone.

### 6. Commit & merge

- Agent drafts the commit message (history lives here, **never in `.md` docs**).
- Human authorises the commit. The agent never commits autonomously.

---

## Guardrails (the agent must obey; tooling should enforce)

| Guardrail                | Rule                                                             | Enforce with                          |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------- |
| AI-locked files          | Never edit a file marked `AI LOCKED — DO NOT EDIT`               | Header grep in pre-commit             |
| No history in docs       | No "as of", "previously", struck-through, or closed `[x]` blocks | CI grep over `*.md`                   |
| No fix-it scripts        | No standalone script that rewrites `drivers/` data               | Review + redundant scraper regen test |
| Schema is single source  | All written fields defined in `wdr_meta_schema.py`               | Runtime validation in write path      |
| `matt/` is protected     | Scripts exclude it; stop + warn if touched                       | Path guard in batch scripts           |
| Human-verified is sacred | Only a human sets `reviewed_by` / verification language          | Review                                |

---

## Port assignments — RESERVED (agents and scripts must respect)

| Port range | Owner / purpose                                                          |
| ---------- | ------------------------------------------------------------------------ |
| 4000–4005  | Human dev preview servers (`scripts/preview-4000.sh`, manual use)        |
| 4100       | Playwright / automated browser tests — exclusive, never reused by humans |
| 8000       | Vite dev server (`npm run dev -- --port 8000`), the canonical dev URL    |

**Rules:**
- Playwright config always targets **4100**. `reuseExistingServer: false` so the test harness starts its own vite instance and never accidentally reuses a preview server.
- Agents starting a dev server for the user always use **8000** (kill any occupant first).
- Scripts and scrapers must not bind to 4100 or 8000. Use ephemeral OS-assigned ports (`port=0`) or the 4000–4005 range when a preview is needed.

---

## Maximising efficiency

- **Parallelise review, serialise truth.** Independent review angles (Python, JS,
  docs) run as parallel agents; correctness decisions are made by one human in
  sequence so the source of truth never forks.
- **Push checks left into tooling.** Every recurring review finding should become
  a CI check (schema validation, no-history grep, markdown link-check, dead-link
  in docs), so the agent and human stop re-litigating the same class of issue.
- **One source of truth per concern.** One `scraper_lib.py`, one canonical schema
  doc, one roadmap file. Duplication is where drift and wasted review time live.
- **Let the agent do breadth, the human do depth.** Agents are best at exhaustive
  scans and encoding rules; humans are best at deciding physics, priorities, and
  what "correct" means.
