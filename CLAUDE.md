# openisd

## Testing — the strategy is in TESTING_STRATEGY.md

**Read [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) before touching any code.** It is the single
authority: TDD (red→green first, never edit source first), the skip-is-a-fail rule, naming
files by the object under test, feature decoupling at the test level, and the tier structure.

Emphasised here because it governs every change:

> **TDD is mandatory.** Say you are doing TDD when you start. Never begin by editing a source
> file: write the failing test, watch it fail for the right reason, implement, watch it pass,
> run the domain suite. Reference: the `/test-driven-development` skill.

> **A skip is a fail.** Never delete, skip, weaken or corrupt a test to make the suite green.
> A failing test is information — fix the test to match the current UI, or raise an inbox
> item; do not delete it. The full removal rules are in `TESTING_STRATEGY.md`.

## Work in progress is never discarded

Several agent sessions work this tree at once, so uncommitted changes you did not make are another session's live work.

Rule — COMMIT FIRST: never discard uncommitted work, yours or anyone else's, until it has been COMMITTED. A WIP commit is fine. Committed work is recoverable; uncommitted work is not.

- Covers `git checkout`, `git restore`, `git clean`, `git reset --hard`, and `git stash` (read-only `stash list` / `stash show` are fine).
- Covers every other route to the same outcome: writing a file back from `git show` or `git cat-file`, restoring a backup, copying an older version over a modified one, or re-editing a file to a previous state. Same violation as the blocked command.
- Order: 1. COMMIT the work in progress. 2. Then revert.
- Wanting to undo work is a WARNING SIGN, not a step. An agent reaching for a revert is probably in a tail spin: it has stopped applying analysis and design, and stopped following the plan. Stop there and work the problem with the other agents (leader + collaborators) before touching anything.
- Every tail-spin event RAISES AN INBOX ITEM, so the human can see afterwards that the agents struggled and what the issue was. Use the `inbox` skill's "raise a question" flow: a new entry in `questions.yml` at the repo root, taking the file's `next` QO number, `status: open`. Write it in plain English for a reader with no context — what task you were on, what you were trying to do, what went wrong, what you were about to undo and why, who you coordinated with and what was decided. Facts only; no code identifiers or jargon unless a file name is the fact. Raise it BEFORE resuming work.
- A guard blocked the command? STOP and report to the human. Never look for another way round it.
- Stage by filename. Never `git add -A`, never stash.

## Two sessions, one tree

- The leader assigns each task a disjoint set of files. Work only inside your assignment; never touch a file outside it, and never another session's package.
- The leader dispatches serially for tricky or cross-package work, or when a worker is making mistakes, and in parallel only for disjoint mechanical tasks.

## Task lists are granular

- Maintain the running task list (`todowrite`) at the FINEST granularity the work has — one line per distinct action, not one line per file or feature. A reader with no context must be able to see exactly what is being worked on, in what order, and what each item means.
- Break each feature/bug into its concrete steps (implement X, verify Y, run Z, remove the temporary debug log, run the regression) so "what are we working on?" is answerable from the list alone.
- **Every task line MUST follow the mandatory format in [`docs/TASK_LIST_FORMAT.md`](docs/TASK_LIST_FORMAT.md):** `The <human-recognisable object> MUST <visible behaviour> when <condition>, except <exception>`. Run the format's self-audit before writing any list — read each line as a person who has never seen the codebase, and rewrite any line that names an internal mechanism (a computed, a ref, a file, a function) instead of a user-visible object and outcome. If you cannot name the subject and behaviour in plain English, you do not understand the task — stop.
- Keep one item `in_progress` at a time; tick items only when actually verified done, never on intent.
- Distinguish BLOCKING work from DEFERRED/background items (e.g. pending human rulings, another session's files), and say so in the list.
- Keep one item `in_progress` at a time; tick items only when actually verified done, never on intent.
- Distinguish BLOCKING work from DEFERRED/background items (e.g. pending human rulings, another session's files), and say so in the list.

## UI Tests & Fixtures
- **Scratch/probe specs NEVER live in the tree.** A throwaway probe (`zz-*`) goes in
  `build/tmp/` — git-ignored, so it cannot be committed and can be deleted safely. Run it via
  the probe config: `npx playwright test -c build/tmp/playwright.config.mjs build/tmp/<spec>`. If
  you are about to create a probe spec under `packages/ui/test/`, you are putting scratch in
  the tree — stop and use `build/tmp/` instead.
- The standard fixture `sample-project.owpr` is a **runtime-generated temporary file** created by the test fixture code. It is **NOT** to be committed to git, nor should it be manipulated or force-added.
- If you change the underlying domain model (e.g. adding new validation rules), do **not** edit the JSON manually. Instead, update `packages/ui/test/fixtures/generateSample.ts`. The fixture will be generated at runtime.
- **Strict Anti-Deletion Rule (A skip is a fail):** Never delete or skip a failing test to make the suite pass. A failing test is information — it tells you the code and the spec disagree. Deleting it hides the disagreement; fixing it resolves it. Skipping or deleting tests because they fail is never "progress" — the goal is catching specification gaps and bugs through good, stable, clean, easy-to-understand coverage. The only legitimate reasons to remove a test are:
  - (a) A human ruling in `questions.yml` (status `decided`) or an authoritative design document (`ARCHITECTURE.md`, `BACKLOG.md` with a checked box, `docs/spec/`) explicitly states the feature is dropped — grep absence alone is never proof (the code may have been deleted by a prior AI, or the feature may simply be unbuilt work that belongs in the backlog).
  - (b) It is a duplicate of another test that covers the same behaviour.
  - (c) It tests behaviour the project has deliberately decided not to have, confirmed by a human ruling in `questions.yml`.
  If a test fails because the UI changed, **fix the test** to match the current UI. If you cannot fix it, raise an inbox item explaining what broke and why — do not delete it.

