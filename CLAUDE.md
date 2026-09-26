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

Goal: by default OpenISD behaves 100% like WinISD, warts and calculation bugs included (not
crashes, hangs or data loss). Stretch goal: other conventions, for interest and education.

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

## Loaded on demand

The rest of the project's working conventions live in path-scoped rules and docs so they only
enter context when relevant, not on every session:

- **Testing** (TDD mandatory, skip-is-a-fail): `.claude/rules/testing.md` — auto-loads when
  touching `packages/**` or test files. Full strategy: [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md).
- **Task-list format and granularity**: [`docs/TASK_LIST_FORMAT.md`](docs/TASK_LIST_FORMAT.md) —
  read before writing any `todowrite` list.
- **Multi-session coordination** (disjoint file assignment, dispatch): [`docs/MULTI_SESSION_COORDINATION.md`](docs/MULTI_SESSION_COORDINATION.md).
- **UI test fixtures & scratch specs**: `.claude/rules/ui-test-fixtures.md` — auto-loads under
  `packages/ui/test/`.
