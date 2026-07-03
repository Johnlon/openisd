# Is OpenISD "vibe-coded"?

Maybe you landed here because someone waved at this project and called it
"vibe-coded" — or because you're about to. Good. Let's do this properly.

## First: say what you actually mean

People throw "vibe-coded" around as an insult, but the word is vague — it can mean
almost anything. So say plainly what you're objecting to. Which of these is it?

- That an AI wrote some of the code? (A compiler writes the machine code too. What
  matters is never _who typed it_ — it's _whether the result holds up_.)
- That it was written fast, or without ceremony?
- Or that it behaves the way bad software behaves — no enforced rules,
  unmaintainable, insecure, doesn't scale, impossible to debug, silently wrong?

The first two are just about taste. The third is the only real complaint — and you
can check it. So check it. The table below is the evidence, one failure at a time:
what the failure is, what OpenISD does to avoid it, how that's **enforced** so it
can't quietly slip back, and — honestly — how OpenISD is doing on it today.

Rule of thumb used throughout: **a rule that isn't enforced is just a vibe.** The
goal is to move every antidote from "we try to remember" to "a tool fails the
build if we don't."

This doc has two companions:

- `SDLC.md` — _who_ does what and in _what order_ (Human / Agent / Tooling).
- `CODE_REVIEW/CODE_REVIEW.md` — the evidence (findings `§N` referenced below).

---

## The failure modes people mean — and where OpenISD stands

| #   | The failure mode ("vibe-coded" usually means one of these) | Antidote (what OpenISD does)                                     | Enforced by                                             | OpenISD today                                                                                                                                                        |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Guess-ware** — no enforced rules                         | Explicit rules _and_ a machine that checks them                  | Schema validation in the write path; lint; CLAUDE.md    | ◐ Improving — §4 resolved (validation now in shared write path); not yet locked by a test                                                                            |
| 2   | **Unmaintainable** — change ripples                        | One source of truth per concern; shared helpers                  | One module per concern; review                          | ◐ Improving — §23 resolved (single persistence source); §5 partly resolved (shared via re-export, `scrape_sbacoustics` dedup'd); two `scraper_lib.py` modules remain |
| 3   | **Security-unsafe** — secrets leak                         | No secrets in code; audit inputs                                 | Secret-scan in CI (e.g. gitleaks)                       | ✓ Clear — none found; **add the scan** so it stays clear                                                                                                             |
| 4   | **Doesn't scale** — no architecture                        | Generalise the mechanism; don't bolt on special cases            | Architecture review against `ARCHITECTURE.md`/`PLAN.md` | ◐ Mixed — engine (`packages/engine`) modular & clean; scraper side accretive (§5)                                                                                    |
| 5   | **Impossible to debug**                                    | Timestamped logs, problem logs, tests, fail-loud                 | Script rules; `_problems.log`; test suite               | ⚠ Partial — strong logging mandate, but swallowed errors remain (§6)                                                                                                 |
| 6   | **Silently wrong** — trusts happy path                     | Validate inputs; fail fast/loud; no fabricated defaults          | Boundary guards + output finite-check + schema          | ◐ Improving — engine §10/§16/§19 resolved; §22 boundary fix in progress; §11/§17/§18 + scraper §1–3 remain                                                           |
| 7   | **Global mutable vars**                                    | Read-only/derived state; stable ids; single update path          | Lint (no global mutation); `Object.freeze`              | ✓ Engine pure; §9 resolved (`crypto.randomUUID`); §23 resolved (single persistence source)                                                                           |
| 8   | **Side-effecting "transforms"**                            | Pure functions; isolate I/O at the edges                         | Keep engine pure (verified); centralise persistence     | ◐ Engine pure ✓; edges mixed — write-on-keystroke persistence                                                                                                        |
| 9   | **No enforcement boundary**                                | Enforce architecture with lint/types/freeze — _not_ file count   | ESLint rules; CI                                        | ⚠ Relies on review today; add ESLint arch rules                                                                                                                      |
| 10  | **No invariants / no validation**                          | Precondition + postcondition guards at the engine boundary       | `assertValid*` + finite-check + unit tests              | ◐ Gap narrowing — `parseWdr` guards (§16); `deriveDriver`/live UI path (§22) fix in progress; §11/§17/§18 remain                                                     |
| 11  | **Lies about its own state**                               | Docs reflect reality; delete dead code; comments match behaviour | No-history grep; link-check; review                     | ◐ Improving — §4 (validation real now) & §12 (dead link) resolved; history in docs remains (§13)                                                                     |
| 12  | **Rot & staleness**                                        | Content-addressed caches; retry policy; consolidate docs         | Hash/mtime cache keys; markdown link-check CI           | ✗ Guilty — OCR cache (§8), no retry (§7), doc sprawl (§15), broken cross-refs (§14) all remain                                                                       |

Legend: ✓ clear · ◐ mixed · ⚠ partial · ✗ guilty.

Notice the last column. Some of it is ✓, plenty is ◐, and one row says **✗ Guilty**
in plain sight. That's the point — this is a scorecard kept in public, not a
marketing page. Software that were _actually_ "just vibes" wouldn't have a column
that can say "guilty", because nothing would be measuring it.

---

## Then: is the pejorative accurate?

Now decide. An app whose physics is checked against closed-form solutions on every
page load; whose engine is pure and unit-, golden-, and browser-tested; whose rules
are enforced by git hooks that block a red commit; that keeps an honest,
public scorecard of its own weak spots — is _that_ what "vibe-coded" is supposed to
describe?

If yes, then the word has come to mean "software with tests and guardrails," and
it's lost all its sting. If no, then it doesn't apply here — and the interesting
question was never the vibe, it was: **which specific row above is still red, and
do you want to help close it?**

That is the whole invitation. Not "prove it isn't vibe-coded" — but "here are the
rows that are still ◐ and ✗; pick one." The remaining work is tracked openly in
`PLAN.md` and `SDLC.md`.

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

That is the difference between "looks structured" and **is** structured — which is
the whole difference between vibe-coded and not.
