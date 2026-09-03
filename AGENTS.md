@../_agent_files/_AGENTS.md

# openisd

Workspace-wide rules are in `../_agent_files/_AGENTS.md`, imported above. Anything here that
would also be true of another repo belongs there — move it, never copy it.

File-scoped rules live in `.claude/rules/` and load when a matching file is read:
`typescript.md`, `ui.md`, `engine.md`, `winisd-interop.md`, `scripts.md`, `markdown.md`,
`openisd-result-contract.md`, `openisd-engine-source.md`, `openisd-engine-tests.md`,
`openisd-ui-design.md`, `openisd-ui-tests.md`.

## Quality gates

| Domain | Command |
| --- | --- |
| Unit tests | `npm run test:unit` |
| Browser suite | `npx playwright test` |
| Lint | `npm run lint` (0 errors) |
| Everything | `bash scripts/health-check.sh` |

Never claim done, fixed or ready until `bash scripts/health-check.sh` is green — run it, do not
assume. A hand-picked subset passing is not evidence.

During the TDD loop run only the target test file. Save the full health check for the final gate.
Never run two suites at once; kill any stale run first.

**Red is red.** "Pre-existing", "stale", "unrelated", "flaky", "HMR" and "someone else's" are not
permitted. Either make it green or stop and read the actual error output.

Hooks (`core.hooksPath=scripts/hooks`): `pre-commit` runs lint + unit + golden, `pre-push` runs
`npm run ci`. Never use `--no-verify`. A commit touching only `*.md` skips them automatically.
Fresh clones run `git config core.hooksPath scripts/hooks` once.

### A failing gate is a finding

Every gate here exists to catch the agent. Two permitted responses:

1. **Name the defect, then repair it** — state what is wrong with the code that would still be
   wrong if the gate did not exist, then make the gate's property genuinely true.
2. **Stop and report** — what the gate found, and what satisfying it honestly would cost.

Everything else is hacking around it: `as any` or `as unknown as X`, widening a type, renaming so
a matcher stops firing, allow-lists, ignore globs, narrowing the assertion, deleting the test,
writing the value the gate wants while the thing it guards stays broken.

**After editing any gate, make it fail on purpose.** Break what it guards, watch it go red,
restore.

## TDD — mandatory for every code change

Say you are doing TDD when you start. Never begin by editing a source file.

1. Write a test that reproduces the bug or specifies the feature.
2. Watch it fail, for the right reason.
3. Implement.
4. Watch it pass.
5. Run the domain suite.

Reference: the `/test-driven-development` skill.

## Linting

Never add `// eslint-disable` or any suppression. Never rename to `_foo` to bypass
`no-unused-vars`. Never delete code to silence a lint error.

## Git

`dev` is the working branch. `main` is release-only: never commit or push to it except through
`/release-drivers` or an explicit instruction naming `main` in the current conversation. Check the
branch at the start of every conversation.

Commit messages describe the change only. Never add a `Co-Authored-By` line naming Claude or
Anthropic, never a "Generated with Claude Code" line, never override `--author`/`user.name`/
`user.email`.

## Port 4000 is the only app port

| Port | Purpose | Started by |
| --- | --- | --- |
| 4000 | The app — every build, preview and check | `scripts/preview-4000.sh` |
| 4100 | Playwright's own vite | the test runner |

Start no server on any other port. Kill a stray one with `bash scripts/kill-http.sh <port>`.
Clear a stale 4100 the same way, only when no run is in flight.

4000 serves `packages/ui/dist`, not the working tree — a source edit is invisible until
`npm run build`. "The fix isn't showing" is a stale bundle until the served asset hash is compared
against `packages/ui/dist/assets/`.

A request to bundle or rebuild is also a request to leave 4000 serving that build. Verify
`curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/` returns 200 and the served asset
filename matches what was just written. Unregister stale service workers before handing off.

Do not re-run `node scripts/bundle-drivers.mjs` for TS/Vue/CSS changes — only on evidence of
upstream changes in `winisd_drivers/`.

## Transient files

Throwaway scripts, probe output, redirected logs and diagnostic dumps go in `build/` at the repo
root — git-ignored and excluded from Vite's watcher, proven by `packages/ui/test/config.test.ts`.
Never an OS temp path, never a new scratch directory.

## AI-locked files

A file whose header says "AI LOCKED — DO NOT EDIT" is never edited, even with permission in
conversation. The human removes the lock first.

## Evidence

**Name the exact device.** Every finding names brand + model. Banned: "an 8Ω driver", "some
drivers", "those files", "the affected ones", "etc.". A data-quality report states all six: exact
driver, exact field, exact wrong value + file path + location in the file, exact correct value +
URL or path, exact cause (the verbatim raw string misread and which tool misread it), and the row
or section it sits in. If you cannot name all six, look it up before reporting.

**External systems.** No claim about WinISD, LEAP, REW, a website or an API without primary-source
evidence obtained in the current conversation. An inferred internal mechanism is marked
`⚠ unverified` and never defended as fact. Tool sites are client-side apps: `WebFetch` and `curl`
return an empty shell, so drive them with headless Chromium via `@playwright/test`
(`waitUntil: 'networkidle'`, then `document.body.innerText`), with the probe script in `build/`.
Record tool-behaviour assumptions in `docs/research/WINISD_PARITY.md` marked
"⚠ Assumption — NOT directly verified".

**Our own code.** Same bar. Never state what this app has, does or lacks without reading the
source in the current conversation; a type definition is not proof of what the app does. Grep for
an existing implementation before writing state tracking, a computation, a mapping, serialization
or a formatter. Before declaring a new interface, read the closest existing one side by side with
what you are about to write.

A hardcoded literal standing in for data that should vary per record is a correctness bug.
Serialization to someone else's format reflects real state for every field, never a placeholder.
Provenance — human-supplied vs computed — is captured where entry happens, never reconstructed
from presence.

Pressure for speed raises the verification bar.

## Safe restricted tools

`.claude/tools/` holds read-only, project-scoped CLIs that are safe to auto-approve. Prefer them
over the raw command. Use the built-in `Grep` for in-project search. When you notice a broad
unrestricted command being issued repeatedly, propose a restricted tool for it — the `safe-tools`
skill is the reference — and add it to `.claude/settings.json`.

## Reading context

Before starting work:

- `BACKLOG.md` — P0 gates all feature work
- `ARCHITECTURE.md` — hard decisions, component diagram, dependency rules, §3 the driver model
- `docs/spec/SPEC_ENGINE.md`, `docs/spec/SPEC_UI.md` — engine and UI contracts
- `docs/plans/OPENISD_MODEL_MIGRATION_READINESS.md` with `docs/plans/PLAN_OPENISD_DRIVER_MODEL.md`
  — before any driver-model work

## Project shape

- `packages/engine/src/` — physics engine, alignments, state. Pure TS, no DOM.
- `packages/model/src/` — the OpenISD record and `OpenISDDriver`: provenance and derivation.
- `packages/winisd/src/` — `.wdr`/`.wpr` parse/serialize, E/C/N provenance.
- `packages/ui/src/` — Vue 3 UI.
- `drivers/` — community driver records.

Ownership: the human decides what to build, physics correctness, driver data authorisation and
`reviewed_by`. The agent writes tests, encoding and diligence. Tooling owns repeatability.
Contributor guide: `CONTRIBUTING.md`.
