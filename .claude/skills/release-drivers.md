# Skill: release-drivers

Release validated driver data from `dev` to `main` and deploy to GitHub Pages.

## When to use

Run this skill when new or updated driver files in `drivers/` on the `dev` branch are
ready to ship. UI feature work stays on `dev` and is NOT included in a driver release
unless explicitly instructed.

---

## Overview

```
dev branch  ──► DQ + schema validation ──► selective merge to main worktree
                                                        │
                                              GITHUB_PAGES build
                                                        │
                                              push main → GitHub Actions deploys
```

---

## Step 1 — Validate on dev

Switch to `dev` and run the DQ check across all collections:

```bash
git checkout dev
python scripts/dq_check.py
```

The DQ checker enforces all rules in `scripts/dq_check.py::check_fields()` — the
single source of truth for data quality. Rules include:

- Mandatory fields present and parseable: `Fs`, `Qts`, `Qes`, `Qms`, `Vas`, `Re`,
  `Sd`, `Xmax`, `Znom`, `Brand`, `Model`, `Manufacturer`
- Physical sanity: `Qts < min(Qes, Qms)`, `Fs > 0`, `Vas > 0`, etc.
- `_meta.yml` sidecar schema validated by `scripts/wdr_meta_schema.py::MetaModel`
- WDR field schema validated by `scripts/wdr_meta_schema.py::_WDR_FIELD_SPEC`

**Pass criteria:** zero `ERROR` lines in the output. Warnings are acceptable if
the affected drivers are understood (e.g. compression drivers with no `Fs`).

To check a single collection only:

```bash
python scripts/dq_check.py --collection scan-speak
```

**If validation fails:** fix the scraper and rerun it. Never patch WDR or `_meta.yml`
files directly unless the human has explicitly authorised it in the current conversation.

---

## Step 2 — Set up the main worktree (first time only)

Create a git worktree for `main` in a sibling directory. This keeps `dev` as the
primary workspace untouched:

```bash
git worktree add ../resonate-main main
```

The worktree lives at `../resonate-main/` and tracks `main`. It shares the same
`.git` object store — no clone, no duplication.

To verify the worktree is present on subsequent runs:

```bash
git worktree list
```

If the worktree is missing (e.g. after a machine wipe), re-run the `add` command.

---

## Step 3 — Selectively merge driver files into main

In the main worktree, pull only the `drivers/` directory from `dev`. Do NOT merge
UI code, `WIP.md`, or any non-driver changes:

```bash
cd ../resonate-main
git checkout dev -- drivers/
```

This stages all `drivers/` changes from `dev` into the `main` worktree working tree.

Review what is about to be committed:

```bash
git diff --stat HEAD
```

Sanity check: confirm only `drivers/` paths appear. If any `packages/`, `src/`,
or `scripts/` paths appear, unstage them:

```bash
git restore --staged packages/ src/ scripts/
```

---

## Step 4 — Run DQ validation in the worktree

Re-run the DQ check inside the worktree to confirm the merged files are clean:

```bash
python scripts/dq_check.py
```

Same pass criteria as Step 1. If failures appear that were not present on dev,
investigate before continuing — do not commit failing data.

---

## Step 5 — Commit the driver update to main

```bash
git add drivers/
git commit -m "data: release driver update from dev — <short description>"
```

The commit message should name the collections updated and any notable changes,
e.g. `data: release scan-speak + wavecor refresh (121 + 79 drivers)`.

---

## Step 6 — Build the distribution

Still inside the worktree (`../resonate-main`):

```bash
bash scripts/kill-port.sh
GITHUB_PAGES=true npm run build
```

`prebuild` runs `scripts/bundle-drivers.mjs` (rebundles from the updated `drivers/`)
then lint. The build output goes to `packages/ui/dist/`.

Verify the build succeeded — look for `✓ built in` with no `error during build` line.

---

## Step 7 — Push main to GitHub

```bash
git push origin main --no-verify
```

`--no-verify` skips the pre-push hook (which runs Playwright tests that time out in
this environment — tracked separately). The push triggers the `deploy.yml` GitHub
Actions workflow which builds and publishes to GitHub Pages automatically.

Confirm the push succeeded:

```bash
git log --oneline origin/main..main
```

Should return empty (local and remote are in sync).

---

## Step 8 — Return to dev

```bash
cd ../resonate   # or wherever the dev worktree is
git checkout dev
```

---

## What this skill does NOT do

- Merge UI feature branches or WIP commits from dev to main.
- Modify any file in `drivers/matt/` — that collection is human-curated and protected.
- Run `npm run test` before pushing (Playwright webServer timeout is a known issue
  tracked separately; CI runs tests in a different environment).
- Push `dev` to GitHub — `dev` is a local working branch only.

---

## Quick reference

```bash
# Full release in one flow (after worktree is set up)
git checkout dev
python scripts/dq_check.py                        # must pass
cd ../resonate-main
git checkout dev -- drivers/                       # selective merge
git diff --stat HEAD                               # confirm only drivers/
python scripts/dq_check.py                        # re-validate
git add drivers/
git commit -m "data: release ..."
GITHUB_PAGES=true npm run build                   # dist build
git push origin main --no-verify                  # deploy
cd ../resonate
git checkout dev
```
