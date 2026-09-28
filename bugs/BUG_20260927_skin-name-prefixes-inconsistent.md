# BUG_20260927_skin-name-prefixes-inconsistent

**Status:** RESOLVED

## Symptom
The original skin's files use two prefixes, `Original*` and `Og*`; the mobile skin's first draft
used `Mobile*` and `Mob*`. Ruling (John, 2026-09-27): a skin prefix is the full skin name —
`Original*`, `Mobile*` — never an abbreviation.

## Evidence
`git ls-files packages | grep /Og[A-Z]` → 9 files: `OgFilters`, `OgNewProject`, `OgTune` (.vue under
`packages/ui/src/ui/shells/original/`, `-hooks.ts` under `packages/ui/src/hooks/`, and their hook
tests). Identifiers: OgNewProject 61, OgTune 48, OgFilters 31, OgFiltersAPI 20, OgTuneAPI 7, and
OgNewProjectDeps, OgSignal, OgProjectList, OgNewProjectAPI, OgFiltersDeps, OgEnclosure, OgTuneKey,
OgToolbar (52 files mention one). Mobile skin (sandbox commit 3e56a35f, not yet pushed):
`MobBoxTab`, `MobChartView`, `MobDriverTab`, `MobSignalTab`, `MobTabBar` + `Mob*-hooks.ts`.
Both skins live in `packages/ui` (`shells/original/`, `shells/mobile/`, flat `hooks/`); no
separate package.

## Fix
- Mobile: `Mob*` → `Mobile*` before its Phase 1 push (asked of the mobile session).
- Original: `Og*` → `Original*` in file names, identifiers, tests and docs, after the mobile push
  (both touch OriginalShell.vue imports).

## Verification
`grep -rE "\bOg[A-Z]|\bMob[A-Z]" packages docs` finds nothing; UI unit and browser suites pass.

## Resolution (2026-09-29)
Og* → Original* in file names, identifiers, tests, docs and bugs; landed inside 2209bcae (swept from the shared index into that commit). Mob* was already gone. Kebab `og-*` DOM ids and CSS classes are unchanged (browser selectors). `git grep -E "\b[Oo]g[A-Z]"` finds only this file and questions.yml.
