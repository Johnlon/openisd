# How not to be shitty vibe-coded

The playbook for this project. Each row names a trait of shitty vibe-coded
software, the **antidote** (the practice that avoids it), how it's **enforced**
(so it can't quietly rot back), and where **Resonate stands today** with evidence.

This is the prescriptive companion to two other docs:

- `SDLC.md` — _who_ does what and in _what order_ (Human / Agent / Tooling).
- `CODE_REVIEW/CODE_REVIEW.md` — the evidence (findings `§N` referenced below).

Rule of thumb: **a rule that isn't enforced is just a vibe.** The goal is to move
every antidote from "we try to remember" to "a tool fails the build if we don't."

---

## The traits → antidotes

Backbone (1–5) is the locked **Version B** definition; 6–12 are the additions.

| #   | Shitty trait                           | Antidote (do this)                                               | Enforced by                                             | Resonate today                                                                                                                                                       |
| --- | -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Guess-ware** — no enforced rules     | Explicit rules _and_ a machine that checks them                  | Schema validation in the write path; lint; CLAUDE.md    | ◐ Improving — §4 resolved (validation now in shared write path); not yet locked by a test                                                                            |
| 2   | **Unmaintainable** — change ripples    | One source of truth per concern; shared helpers                  | One module per concern; review                          | ◐ Improving — §23 resolved (single persistence source); §5 partly resolved (shared via re-export, `scrape_sbacoustics` dedup'd); two `scraper_lib.py` modules remain |
| 3   | **Security-unsafe** — secrets leak     | No secrets in code; audit inputs                                 | Secret-scan in CI (e.g. gitleaks)                       | ✓ Clear — none found; **add the scan** so it stays clear                                                                                                             |
| 4   | **Doesn't scale** — no architecture    | Generalise the mechanism; don't bolt on special cases            | Architecture review against `ARCHITECTURE.md`/`PLAN.md` | ◐ Mixed — engine (`packages/engine`) modular & clean; scraper side accretive (§5)                                                                                    |
| 5   | **Impossible to debug**                | Timestamped logs, problem logs, tests, fail-loud                 | Script rules; `_problems.log`; test suite               | ⚠ Partial — strong logging mandate, but swallowed errors remain (§6)                                                                                                 |
| 6   | **Silently wrong** — trusts happy path | Validate inputs; fail fast/loud; no fabricated defaults          | Boundary guards + output finite-check + schema          | ◐ Improving — engine §10/§16/§19 resolved; §22 boundary fix in progress; §11/§17/§18 + scraper §1–3 remain                                                           |
| 7   | **Global mutable vars**                | Read-only/derived state; stable ids; single update path          | Lint (no global mutation); `Object.freeze`              | ✓ Engine pure; §9 resolved (`crypto.randomUUID`); §23 resolved (single persistence source)                                                                           |
| 8   | **Side-effecting "transforms"**        | Pure functions; isolate I/O at the edges                         | Keep engine pure (verified); centralise persistence     | ◐ Engine pure ✓; edges mixed — write-on-keystroke persistence                                                                                                        |
| 9   | **No enforcement boundary**            | Enforce architecture with lint/types/freeze — _not_ file count   | ESLint rules; CI                                        | ⚠ Relies on review today; add ESLint arch rules                                                                                                                      |
| 10  | **No invariants / no validation**      | Precondition + postcondition guards at the engine boundary       | `assertValid*` + finite-check + unit tests              | ◐ Gap narrowing — `parseWdr` guards (§16); `deriveDriver`/live UI path (§22) fix in progress; §11/§17/§18 remain                                                     |
| 11  | **Lies about its own state**           | Docs reflect reality; delete dead code; comments match behaviour | No-history grep; link-check; review                     | ◐ Improving — §4 (validation real now) & §12 (dead link) resolved; history in docs remains (§13)                                                                     |
| 12  | **Rot & staleness**                    | Content-addressed caches; retry policy; consolidate docs         | Hash/mtime cache keys; markdown link-check CI           | ✗ Guilty — OCR cache (§8), no retry (§7), doc sprawl (§15), broken cross-refs (§14) all remain                                                                       |

Legend: ✓ clear · ◐ mixed · ⚠ partial · ✗ guilty.

---

## Worked example — trait #6/#10: "return a named error, not `NaN`"

The single best illustration of the whole playbook. Several specific `NaN` leaks have
since been plugged — a missing `Xmax` (§10), a missing `Pe` (§19), and the file-import
path now rejects incomplete-Q drivers (§16). But the **validation boundary itself still
does not exist**: the live UI computes `deriveDriver(state.driverRaw)` directly, so
incomplete input from the editors still becomes a silent `NaN` and a blank graph (§22;
plus the degenerate cases §11/§17/§18). Point-fixes close individual holes; only a
boundary closes the class. The antidote is two cheap layers:

- **Precondition** — validate inputs once at the engine entry; throw a clear named
  `EngineError`.
- **Postcondition** — one pass over the sweep output; if anything is non-finite,
  fail loud. (An input guard alone can't prove `div/0` won't happen mid-sweep.)

Result: a clear message ("driver needs Qms to derive Bl") instead of a blank
graph — _fast, loud, near the cause._ No formula changes.

Full design: `CODE_REVIEW/ENGINE_HARDENING.md`.
Action checklist (HIGH priority, awaiting sign-off): `CODE_REVIEW/ENGINE_HARDENING_TODO.md`.

---

## What "good" looks like

When every row above is enforced by a tool rather than a memory:

- Rules can't drift, because the build fails when they're broken.
- The engine refuses bad input with a message instead of producing a silent wrong
  answer.
- One source of truth per concern; no copy that can rot independently.
- Docs describe only what is true now; git holds the history.

That is the difference between "looks structured" and **is** structured — which is
the whole difference between vibe-coded and not.
