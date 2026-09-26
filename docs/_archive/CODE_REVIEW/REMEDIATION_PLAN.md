# Plan — Address OpenISD code-review findings

## Context

A full-codebase review (JS/Vue, structure/docs) produced a set of
verified findings and 10 preventative practices. This plan tracks remediation.

**Artifacts:**

- `CODE_REVIEW/CODE_REVIEW.md` — the findings, each with file:line, failure
  scenario, and a preventative practice. Source of truth for this plan.
- `SDLC.md` (repo root) — the Human/Agent/Tooling workflow these fixes operate
  within.

**Task list:** umbrella `#2`, broken into linked sub-tasks `#4`–`#9`.

## Approach (priority order)

4. **`#9` — Docs/structure + CI guards** (§13-15). Fix history-in-docs violations,
   broken links, competing canonical sources; add no-history grep + link-checker.

## Blocked / needs human sign-off

- **`#8` — `driver.ts` zero-denominator guard** (§11). `packages/engine/src` calculation code;
  the calculation-stability rule requires explicit human approval before any change,
  even an input-validation guard. **Do not start without sign-off.**

## Verification

corrected field, and check `_problems.log` (per `SDLC.md` §5 data pipeline loop).

- JS fixes (`#7`): `npm test` + `npm run test:visual`; `/verify` for the UI behaviour.
- Docs/CI (`#9`): the new no-history grep and markdown link-checker must pass.
- Each finding is deleted from `CODE_REVIEW/CODE_REVIEW.md` once its fix lands (the
  rationale goes in the commit message, per the no-history rule).
