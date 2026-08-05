# OpenISD — Human / Agent / Tooling SDLC

This is the operating manual for how work gets done on OpenISD. It defines who
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
5. Never hand-edit driver data under `drivers/`. It is produced by winisd_tools and
   lands here as records; a wrong value is fixed at the source. This is the single
   most important rule.

---

## Who owns what

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
| Docs                                        | Approves       | **Drafts** | prettier, linkcheck |

Rule of thumb: **Human owns truth and intent. Agent owns encoding and diligence.
Tooling owns repeatability.** Anything that must be reproducible belongs to
Tooling, never to a one-off human or agent edit.

---

## The lifecycle

### 1. Intake & plan

- Human states intent. Agent enters plan mode for anything non-trivial, explores
  the codebase read-only, and proposes a plan.
- Gate: `BACKLOG.md` P0 items block lower-priority feature work. `PLAN.md` and
  `ARCHITECTURE.md` gates apply before any `packages/engine/src/` or structural change.
- Human approves the plan before code is written.

### 2. Implement

- Agent writes code to match surrounding style, plus **direct unit tests** for
  every new `packages/engine/src/` function (non-negotiable per `DEVELOPMENT.md`).
- **Calculation-stability rule:** no formula, constant, or display precision in
  `packages/engine/src/` changes without explicit human approval in the session.

### 3. Verify

- `npm run test:unit` (Vitest unit + golden), `npm run test:visual` (pixel-exact SPL canvas).
- `npm run test:crosscheck` is **reference-only** (hits micka.de) — a discrepancy
  is documented, never auto-fixed. Not in CI.
- `/verify` drives the real app when a change needs to be seen working.

### 4. Review

- Run `/code-review` (medium for routine, high before a risky merge). It checks
  correctness, reuse, simplification, efficiency, altitude, and CLAUDE.md
  conventions.
- Human reads findings and decides which to act on. Agent never self-approves.

### 5. Commit & merge

- Agent drafts the commit message (history lives here, **never in `.md` docs**).
- Human authorises the commit. The agent never commits autonomously.

---

## Guardrails (the agent must obey; tooling should enforce)

| Guardrail                | Rule                                                             | Enforce with                          |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------- |
| AI-locked files          | Never edit a file marked `AI LOCKED — DO NOT EDIT`               | Header grep in pre-commit             |
| No history in docs       | No "as of", "previously", struck-through, or closed `[x]` blocks | CI grep over `*.md`                   |
| No fix-it scripts        | No standalone script that rewrites `drivers/` data               | Review + redundant scraper regen test |
| `matt/` is protected     | Scripts exclude it; stop + warn if touched                       | Path guard in batch scripts           |
| Human-verified is sacred | Only a human sets `reviewed_by` / verification language          | Review                                |

---

## Port assignments — RESERVED (agents and scripts must respect)

| Port | Owner / purpose                                         | Script                                                |
| ---- | ------------------------------------------------------- | ----------------------------------------------------- |
| 4000 | **The app** — every build, preview and check, human and agent alike | `scripts/preview-4000.sh` or `scripts/start-http.sh`   |
| 4100 | Playwright browser tests — Playwright manages this port             | `playwright.config.js` (`reuseExistingServer: false`)  |

**Rules:**

- **4000 is the only app port** (human standing order 2026-08-05). No agent starts a server anywhere else; see `AGENTS.md` §"4000 IS THE ONLY APP PORT".
- Playwright always targets **4100** with `reuseExistingServer: false`. It starts and stops its own Vite instance.
- Scripts must not bind 4000 or 4100 for anything else. Use OS-assigned ephemeral ports (`port=0`).

---

## Maximising efficiency

- **Parallelise review, serialise truth.** Independent review angles (engine, UI,
  docs) run as parallel agents; correctness decisions are made by one human in
  sequence so the source of truth never forks.
- **Push checks left into tooling.** Every recurring review finding should become
  a CI check (schema validation, no-history grep, markdown link-check, dead-link
  in docs), so the agent and human stop re-litigating the same class of issue.
- **One source of truth per concern.** One canonical schema doc, one roadmap file. Duplication is where drift and wasted review time live.
- **Let the agent do breadth, the human do depth.** Agents are best at exhaustive
  scans and encoding rules; humans are best at deciding physics, priorities, and
  what "correct" means.
