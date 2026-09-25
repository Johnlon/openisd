---
paths:
  - "packages/ui/test/**"
---

# UI Tests & Fixtures

- **Scratch/probe specs NEVER live in the tree.** A throwaway probe (`zz-*`) goes in
  `build/tmp/` — git-ignored, so it cannot be committed and can be deleted safely. Run it via
  the tracked probe config: `npx playwright test -c scripts/playwright.probe.config.mjs build/tmp/<spec>`
  (the config itself lives in `scripts/`, not `build/`, so it can't be silently lost — only the
  spec files it runs are scratch). If you are about to create a probe spec under
  `packages/ui/test/`, you are putting scratch in the tree — stop and use `build/tmp/` instead.
- The standard fixture `sample-project.owpr` is a **runtime-generated temporary file** created
  by the test fixture code. It is **NOT** to be committed to git, nor should it be manipulated
  or force-added.
- If you change the underlying domain model (e.g. adding new validation rules), do **not** edit
  the JSON manually. Instead, update `packages/ui/test/fixtures/generateSample.ts`. The fixture
  will be generated at runtime.
- **Strict Anti-Deletion Rule (A skip is a fail):** Never delete or skip a failing test to make
  the suite pass. A failing test is information — it tells you the code and the spec disagree.
  Deleting it hides the disagreement; fixing it resolves it. Skipping or deleting tests because
  they fail is never "progress" — the goal is catching specification gaps and bugs through
  good, stable, clean, easy-to-understand coverage. The only legitimate reasons to remove a
  test are:
  - (a) A human ruling in `questions.yml` (status `decided`) or an authoritative design
    document (`ARCHITECTURE.md`, `BACKLOG.md` with a checked box, `docs/spec/`) explicitly
    states the feature is dropped — grep absence alone is never proof (the code may have been
    deleted by a prior AI, or the feature may simply be unbuilt work that belongs in the
    backlog).
  - (b) It is a duplicate of another test that covers the same behaviour.
  - (c) It tests behaviour the project has deliberately decided not to have, confirmed by a
    human ruling in `questions.yml`.
  If a test fails because the UI changed, **fix the test** to match the current UI. If you
  cannot fix it, raise an inbox item explaining what broke and why — do not delete it.
