# ALL AGENTS !!!! — read this first

## File links — httpd extras

Base link-formatting rules are always active: `.claude/rules/links.md` (Claude Code) /
`.opencode/rules/links.md` (OpenCode). Project-specific additions:

- Server: `/home/john/work/agentutils/httpd/`, base `http://localhost:8000`. Usage spec:
  `/home/john/work/agentutils/specs/SPEC_HTTPD.md`.
- This repo's mount: `/winisd/openisd/...`.
- For `.md` docs ALWAYS add `?html` before the anchor (`…doc.md?html#L<n>`) — without it the
  user gets raw markdown.

## HARD NON-NEGOTIABLE — NEVER WRITE TO `winisd_drivers/db`

Under NO circumstances is any agent, script, test, or process in `openisd` permitted to write to, modify, or project into `winisd_drivers/db`. That tree is strictly read-only for `openisd`. **ONLY the `winisd_tools` project is permitted to write to `winisd_drivers/db`.**

## HARD NON-NEGOTIABLE — commit EVERYTHING, never leave work vulnerable

If you commit, you commit **everything** — including other agents' work you do not recognise,
their staged changes, their uncommitted files, and untracked files. A "pure" or "scoped"
commit that deliberately excludes someone else's uncommitted work is a FAILURE: that work
stays vulnerable to loss. Once something is committed it is cheap to undo or rewrite; work
that was never committed can be destroyed for free. When in doubt, commit. When you have
committed everything, THEN (and only then) is it safe to revert or clean up.

## Work in progress is never discarded

Project addition to the global COMMIT-FIRST rule (already in `~/.claude/CLAUDE.md`, which
covers the mechanics — never `checkout`/`restore`/`reset --hard`/`clean`/`stash`, commit
first, a tail spin means stop and raise an inbox item): several agent sessions work this tree
at once, so uncommitted changes you did not make are another session's live work — the same
protection applies to them as to your own.

## WinISD controls behave as native WinISD

Goal: by default OpenISD behaves 100% like WinISD, including WinISD's deliberate calculation
choices. A straight WinISD bug is not copied. Stretch goal: other conventions, for interest and
education.

Three kinds of WinISD difference, handled differently:

- **A different calculation** (the maths differs: another formula, loss model, convention, or a
  consistent calculation error such as the passive-radiator ωr using Npr where the tuning divides
  by it) is copied by default. The conventional maths sits behind a compat switch, or behind an
  existing switch whose tooltip is extended to name the case.
- **A calculation bug** (a wrong formula, or a value that contradicts WinISD's own other charts)
  can be reproduced: OpenISD does the correct thing by default and provides a yellow error switch
  that makes WinISD's calculation come back. The switch is off by default (a WinISD default that is
  itself the bug is the one exception: it stays as WinISD has it, shown yellow), editable only
  where it applies, and looks different from ordinary switches even when off. The error switches
  sit in one group headed "WinISD errors", and each is a visible, listed WinISD issue: the switches
  are how OpenISD tells users what is wrong in WinISD, and they build trust. Which state is the
  default follows the parity goal: a wrong formula or contradiction proven in WinISD's own outputs
  defaults to the correct maths; an inaccuracy WinISD may intend (a dropped small term, as in the
  ABC intra-port velocity) defaults to WinISD's form, ticked and yellow, with the exact formula
  unticked: convention (accurate) versus WinISD parity (inaccurate). Record each as a
  WinISD bug (a `bugs/BUG_*_winisd-*.md` file, a row in the "fixed by default" section of
  `docs/research/ACCURACY_IMPROVEMENTS.md`, and `docs/research/WINISD_PARITY.md`).
- **A trigger, linkage or update bug** (an edit that does not recalculate where a load or another
  event does; a crash, hang or data loss) is NEVER copied and gets no switch: there is nothing to
  reproduce on purpose. OpenISD does the correct thing. Record it the same way.
- **One test that tells them apart:** the same value entered by hand and loaded from a file give
  different results. That is a strong signal of a linkage bug, not a calculation difference. There
  are other tests and signals. It also means OpenISD may already have copied such a bug while
  chasing parity: look for it, and remove it.
- When it is unclear which kind a WinISD behaviour is, ask John.

- Every control OpenISD shares with WinISD behaves exactly as WinISD does, by default (e.g. "Rg
  is at driver side").
- A conventional variant sits behind its own WinISD-vs-conventional control in the WinISD
  Compatibility panel: a checkbox ("WinISD inductance model") or a drop-down (the loss model).
  The native control stays as WinISD has it. (Splitting the native control's "on" state into a
  drop-down, "off / on – WinISD / on – Conventional", is also permitted, but separate controls
  are the pattern in use.)
- "Reset to WinISD" changes only the WinISD-vs-conventional choice. It never changes whether a
  native control is on or off, and never changes project data.

(John, 2026-09-26.)

## Communication — plain bug statements

Report a bug or a split as one plain sentence: "There are two things, X and Y. X does A, Y does
B. We need Z." Then stop. Name the things; no hedge/jargon words (wiring, disconnect, orphaned,
discrepancy, "real vs not real").

- Bad: "Two stores exist, only one is real — the distinction is wiring, not reality, the other
  is orphaned..."
- Good: "There are two stores, X and Y. X gets all the writes, Y gets all the reads. Eliminate
  X, use Y solely."

Trigger — two named things hold the same fact. "Analyse/compare/what is the difference between
X and Y" is this case whenever X and Y are the same fact twice; it is not a request for a
comparison. This rule beats the standing table preference: the sentence goes first, on its own,
and an evidence table follows only when John asks for one.

No supporting facts. For a simple conflict or a decision, send the sentence and stop — no
evidence list, no file/line citations, no consequences section, no "supporting facts" block.
John asks when he wants them.

Failure this came from (2026-09-24): asked to analyse `appSettings.envDefaults()` versus
`presentationState.ui.envDefaults`, an agent produced comparison tables and a consequences list.
John: "why didnt you say that in te first place". The answer was one sentence — two env defaults,
the Options dialog writes one, the engine reads the other, eliminate the first.

Repeat of the same failure, same day: told the rule, the agent led with the correct sentence and
then appended six bullets of file/line evidence nobody asked for.

## Running the app locally — `scripts/preview-4000.sh`

To build or run the app for John to look at, run `bash scripts/preview-4000.sh` from the repo root
(background it). It kills whatever holds port 4000, then starts the live Vite dev server with HMR at
http://localhost:4000. Never hand-roll `npx vite` on another port, and never run the script from
inside `scripts/`: Vite then finds no config and serves 404 on every page.

## Test output — quiet by default

Run every test/typecheck/gate via `bash scripts/quiet-test.sh <command>`; it hides passing lines and
logs the full output to `build/test-logs/`. Rule: `.claude/rules/verify.md`.

## Loaded on demand

The rest of the project's working conventions live in path-scoped rules and docs so they only
enter context when relevant, not on every session:

- **Testing** (TDD mandatory, skip-is-a-fail): `.claude/rules/testing.md` — auto-loads when
  touching `packages/**` or test files. Full strategy: [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md).
- **Task-list format and granularity**: [`docs/TASK_LIST_FORMAT.md`](docs/TASK_LIST_FORMAT.md) —
  read before writing any `todowrite` list.
- **Multi-session coordination** (disjoint file assignment, dispatch): [`docs/MULTI_SESSION_COORDINATION.md`](docs/MULTI_SESSION_COORDINATION.md).
- **UI does no maths, formatting or constants**: `.claude/rules/ui.md` — lint bans `Math.log/pow/…` and `.toFixed(` under `packages/ui/src`; use `packages/design` axes and `fields/format.ts`.
- **UI test fixtures & scratch specs**: `.claude/rules/ui-test-fixtures.md` — auto-loads under
  `packages/ui/test/`.
