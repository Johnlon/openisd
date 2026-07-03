# Is OpenISD "vibe-coded"?

Maybe you landed here because someone waved at this project and called it
"vibe-coded" — or because you're about to. Good. Let's do this properly.

## First: say what you actually mean

People throw "vibe-coded" around as an insult, but the word is vague — it can mean
almost anything. So say plainly what you're objecting to. Which of these is it?

- That an AI wrote some of the code? (A compiler writes the machine code too. What
  matters is never _who typed it_ — it's _whether the result holds up_.)
- That it was written fast, or without ceremony?
- Or that it behaves the way bad software behaves — unverified, unmaintainable,
  silently wrong, impossible to debug?

The first two are just about taste. The third is the only real complaint, and it is
a claim about **verification**. That claim can be settled with facts. Here they are.

## The facts

Every item below names the file or command that proves it. Nothing here is a
promise or an intention — it exists in the repo today and you can check each one.

**1. The physics is proven against closed-form theory on every page load.**
The shipped app runs three self-test gates in your browser every time it starts
(`packages/ui/src/utils/selftest.ts`):

- GATE 1 — the simulated sealed-box response must match the exact closed-form
  2nd-order high-pass solution to within **0.1 dB** at every frequency in the sweep.
- GATE 2 — the passband must converge to the driver's analytically predicted
  reference sensitivity within **0.5 dB**.
- GATE 3 — the vented box must roll off at the theoretical 24 dB/octave and show
  exactly two impedance peaks straddling Fb.

A failure prints FAIL to the console and raises a visible warning in the UI. Not
in a lab — on your machine, on every load.

**2. 175 unit tests, including a zero-tolerance golden master.**
`npm run test:unit` runs 175 tests over the engine: complex arithmetic (35),
the circuit solver (8), box alignments (23), driver derivation and WDR file
round-trip (50), engine physics (36), sweep behaviour (10). Six golden-master
fixtures (sealed, vented, bandpass, passive radiator, single and multi-driver)
are compared with **exact `===` equality — no tolerance at all**
(`packages/engine/test/golden.test.ts`). The engine is deterministic, so any
divergence, however small, fails the suite.

**3. 31 browser tests drive the real UI.**
Playwright starts the actual app in Chromium, clicks the actual controls, and
asserts the actual numbers: a 20 L sealed box must show Qtc = 0.601 and
fc = 58.5 Hz in the stat bar; a 5 cm × 10 cm vent must tune to Fb = 37.1 Hz; a
50 g passive radiator must show Fp = 37.9 Hz. The failure paths are tested too:
Vb = 0 must surface a blocking error (not a blank chart); a missing Pe or Xmax
must degrade only the specific curve that depends on it, with a visible notice
(`packages/ui/test/*.browser.spec.ts`).

**4. An independent implementation is used as an external oracle.**
`packages/ui/test/micka-crosscheck.browser.spec.ts` submits the same scenarios to
micka.de — a loudspeaker calculator that shares no code with OpenISD — and asserts
agreement. The one known divergence (vented Fb, ~2%) is not hidden: it is
documented in the test header with its cause (a port end-correction convention,
0.85·d per Beranek 1954 vs micka's ~0.75·d) and the reasoned choice OpenISD made.

**5. A red result cannot ride along.**
Git hooks (`scripts/hooks/`) block any commit that fails lint, typecheck, or the
unit + golden suite, and block any push that fails the full CI including all 31
browser tests. GitHub Actions (`.github/workflows/ci.yml`) re-runs lint,
typecheck, unit + golden, browser, and a production build on every push and pull
request. `bash scripts/health-check.sh` is the single local entry point: six
gates — ESLint, typecheck, unit, browser, data-quality validation over the driver
library, and 50 Python scraper tests.

**6. The type system and linter are gates, not decoration.**
TypeScript `strict: true` across the codebase (`tsconfig.base.json`); the lint
gate is zero errors. The project rules ban silencing the linter — no
`eslint-disable`, no renaming a variable to `_x` to dodge a warning. (Current
count of suppressions in `packages/`: one — a `no-console` on the self-test's
console reporter, whose output _is_ the console.)

**7. Numbers are human-gated; data is never hand-patched.**
No formula or constant in the engine changes without explicit human sign-off.
Where OpenISD disagrees with another tool, the discrepancy is documented with its
cause (`WINISD.md`, `COMPARISON.md`) rather than silently "fixed". The 6,405
driver files in `drivers/` are never edited by hand or by patch script — that is
a hard rule; a wrong value means fixing the scraper and regenerating, so the same
error can't creep back on the next run.

**8. The docs are forbidden to lie.**
Documentation may describe only the current state — no "as of" notes, no
migration blurbs, no closed-item graveyards. History lives in git, where it can't
drift from the truth. That rule is itself written down and enforced in review
(`CLAUDE.md`).

That is the machinery. Now the honest part.

## The scorecard — including where it's still weak

Rule of thumb used throughout the project: **a rule that isn't enforced is just a
vibe.** The goal is to move every safeguard from "we try to remember" to "a tool
fails the build if we don't." That migration isn't finished, and the table says
so in public. Finding numbers (`§N`) refer to `CODE_REVIEW/CODE_REVIEW.md`.

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

Read the last column. Some ✓, plenty ◐, one **✗ Guilty** in plain sight. Software
that was _actually_ just vibes could not produce this table, because nothing would
be measuring it. A public scorecard that can say "guilty" is itself evidence of
the opposite of vibe-coding.

## Worked example — "return a named error, not `NaN`"

The best single illustration of how this project treats its own defects. Several
specific `NaN` leaks have been plugged — a missing `Xmax` (§10), a missing `Pe`
(§19), and the file-import path now rejects incomplete-Q drivers (§16). But the
**validation boundary itself still does not exist**: the live UI computes
`deriveDriver(state.driverRaw)` directly, so incomplete input from the editors can
still become a silent `NaN` and a blank graph (§22; plus the degenerate cases
§11/§17/§18). Point-fixes close individual holes; only a boundary closes the
class. The fix is two cheap layers:

- **Precondition** — validate inputs once at the engine entry; throw a clear named
  `EngineError`.
- **Postcondition** — one pass over the sweep output; if anything is non-finite,
  fail loud. (An input guard alone can't prove `div/0` won't happen mid-sweep.)

Result: a clear message ("driver needs Qms to derive Bl") instead of a blank
graph — _fast, loud, near the cause._ No formula changes.

Full design: `CODE_REVIEW/ENGINE_HARDENING.md`.
Action checklist: `CODE_REVIEW/ENGINE_HARDENING_TODO.md`.

## Don't take this document's word for it

Every claim above is reproducible on your machine in a few minutes:

```bash
git clone https://github.com/Johnlon/openisd
cd openisd
npm install
npm run test:unit        # 175 tests, incl. the exact-equality golden master
npx playwright test      # 31 tests driving the real UI in Chromium
bash scripts/health-check.sh   # all six gates, one command
```

Then open the app and open your browser console: the three physics gates print
their PASS/FAIL against closed-form theory right there, on your hardware.

So decide. If "vibe-coded" means anything, it means **nobody checked**. Here, the
machine checks on every commit, every push, and every page load — and the parts
that still fall short are enumerated above with their finding numbers, not hidden.
Call that whatever you like; the code doesn't care. If instead you want to make
one of those ◐ rows into a ✓, that's the interesting conversation —
`CONTRIBUTING.md` is the door.
