# ALL AGENTS !!!! — read this first

## File links — httpd extras

Base link-formatting rules are always active: `.claude/rules/links.md` (Claude Code) /
`.opencode/rules/links.md` (OpenCode). Project-specific additions:

- Server: `/home/john/work/agentutils/httpd/`, base `http://lap:8000`. Usage spec:
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
  simplification WinISD may intend, such as the ABC intra-port velocity dropping a small leak
  term) is copied by default. The other form sits behind an option switch, or behind an existing
  switch whose tooltip is extended to name the case. An option is never yellow.
- **A calculation bug** (a wrong formula, or a value that contradicts WinISD's own other charts)
  can be reproduced: OpenISD does the correct thing by default and provides a yellow bug switch
  that makes WinISD's calculation come back. Only a straight WinISD bug is yellow (John,
  2026-10-04): the driver model (two BLs), the VA model, the PR Npr resonance, the Bessel
  high-pass, the ABC group delay, the per-driver impedance. The switch is off by default, with no exception, editable only where it applies, and
  looks different from ordinary switches even when off. While it is off, a ≠W Difference cue by
  the affected control (or chart) says what WinISD does. The bug switches sit in one group
  headed "Enable WinISD bugs", and each is a visible, listed WinISD issue: the switches are how OpenISD
  tells users what is wrong in WinISD, and they build trust. Record each as a
  WinISD bug (a `bugs/BUG_*_winisd-*.md` file, a row in the "fixed by default" section of
  `docs/research/ACCURACY_IMPROVEMENTS.md`, and `docs/research/WINISD_PARITY.md`).
- **A trigger, linkage or update bug** (an edit that does not recalculate where a load or another
  event does; a crash, hang or data loss) is NEVER copied and gets no switch: there is nothing to
  reproduce on purpose. OpenISD does the correct thing. Record it the same way.
- **An input WinISD ignores entirely** (the Linkwitz-Riley Order box always draws LR4; Allpass
  orders above 2 act as 2) is a plain bug, not a calculation bug: no switch. OpenISD honours the
  input with the correct maths, and a Difference icon by the control opens a popup saying what
  WinISD does instead. The icon is enough (John, 2026-10-04).
- **One test that tells them apart:** the same value entered by hand and loaded from a file give
  different results. That is a strong signal of a linkage bug, not a calculation difference. There
  are other tests and signals. It also means OpenISD may already have copied such a bug while
  chasing parity: look for it, and remove it.
- When it is unclear which kind a WinISD behaviour is, ask John.
- **The ≠W Difference cue is for significant differences only** (John, 2026-10-19, QO279: "the
  diff thing is for significant diffs not trivial stuff like this"). It goes by a control or chart
  where OpenISD gives a different result from WinISD that a user would notice and care about: a
  chart, a calculated value, an input WinISD ignores, a field WinISD does not let you type. A
  trivial difference gets no cue and no question to John: keep OpenISD's way and record it in the
  bug file. Example: a value the file never gave is blank in OpenISD and an entered 0 in WinISD.

- Every control OpenISD shares with WinISD behaves exactly as WinISD does, by default (e.g. "Rg
  is at driver side").
- Another form of a WinISD calculation sits behind its own option switch in the WinISD
  Compatibility panel. The native control stays as WinISD has it.
- Group headings name the kind (John, 2026-10-05): the bug switches sit under the "Enable WinISD
  bugs" heading and are named by the bug (e.g. "Re without Rg"); the plain WinISD-vs-OpenISD
  choices sit under "Enable WinISD-style …" and are named by the calculation (e.g. "Phase
  wrapping"). Titles and tooltips live in `packages/design`
  (`ToggleField`, listed by `CompatSwitch`); each tooltip says in plain words what ticked and
  unticked do.
- The panel has only the individual switches: no presets, no reset button (John, 2026-10-05). A
  new project, and a file that does not say, has every bug unticked and every option ticked
  (WinISD's way). Ignored-input bugs have no switch.

(John, 2026-09-26; switch titles and no reset 2026-10-05.)

## Communication — UI issues come with before and after screenshots

John, 2026-10-16: "any time you tell [me] a UI layout issue be prepared with before and after and
be clear what the problem is"; "the before and after is because I need to understand the issue".

- The pictures are how John understands the issue. Pick them so the problem is obvious at a
  glance: the same screen, the same size, before and after side by side.
- Before raising any UI layout issue with John, have the screenshots in hand: before (what he last
  saw, or the last good build) and after (now), at the sizes involved. Name the build each one is
  from. Send them so they open on his phone.
- Lead with one plain sentence on what is visibly wrong on screen. Never pixels, spec names or
  rulings first.
- Failure this came from: F46 was raised as "rows 8 px taller, depth spec fails" with no
  screenshots. John had not seen the change and did not recognise the problem.

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

## Running the app locally — protected and task previews

The protected main checkout and its last-green preview use `bash scripts/preview-4000.sh`, which serves
the live Vite dev server with HMR at `http://lap:4000`. Do not work in that checkout or use its preview
script from a task worktree.

A task worktree uses the reserved port `4XXX`, where `XXX` is the task number. For example, T578 is
previewed at `http://lap:4578` with the dev server started from the T578 worktree. Use the task port,
not an arbitrary port, so previews cannot be mistaken for main or for another task.

## Test output — quiet by default

Run every test/typecheck/gate via `bash scripts/quiet-test.sh <command>`; it hides passing lines and
logs the full output to `build/test-logs/`. Rule: `.claude/rules/verify.md`.
Unit tests, linting, typechecks, and targeted singleton browser specs (`bash scripts/test.sh <spec>`)
run immediately without queueing. Only untargeted/heavy Chromium sweeps queue for the admission slot.

## UI Layout Safety — No clipped controls or unwanted scrollbars

All agent changes to UI components, shells, and dialogs MUST be verified to ensure controls NEVER disappear or get clipped off the bottom or sides of the screen, NOR cause unwanted horizontal or vertical scrollbars to appear.

## PWA updates and announcements — release critical

An installed app must reach the current production build automatically. A user must never need to clear
site data, uninstall OpenISD, or lose saved projects to update. Every release that changes app code or
service-worker behavior MUST verify an upgrade from a previously installed worker in a persistent
mobile browser profile. Keep automatic worker activation and controller takeover enabled; update checks
must bypass HTTP caches. Reload only when there are no unsaved edits; otherwise offer the update and
keep the current app usable. Keep /about/refresh/ as the recovery link for older workers, because old
workers bypass /about/ but may serve their cached app shell for a new top-level path. Never tell users
to clear all site data: that can delete their projects.

A user-announcements endpoint MUST use a Cloudflare Worker response with Cache-Control: no-store
(and matching CDN cache headers), never a GitHub Pages static page. Each announcement has a stable
version. Dismissing one version must not hide later versions; the full announcement list remains
available for review.

After every release, verify that production's build ID matches the GitHub Latest release. A successful
deploy workflow alone does not prove users receive that build.

## General rules — always

`.claude/rules/general.md`: no workarounds for unexpected issues, no backdoor in UI testing, no
reload in tests unless testing reload, and in the app every button shows a visible result.

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
