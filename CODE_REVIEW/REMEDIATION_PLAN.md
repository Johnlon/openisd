# Plan — Address Resonate code-review findings

## Context

A full-codebase review (Python scrapers, JS/Vue, structure/docs) produced 15
verified findings and 10 preventative practices. This plan tracks remediation.

**Artifacts (in `CODE_REVIEW/`):**

- `CODE_REVIEW/CODE_REVIEW.md` — the 15 findings, each with file:line, failure
  scenario, and a preventative practice. Source of truth for this plan.
- `CODE_REVIEW/SDLC.md` — the Human/Agent/Tooling workflow these fixes operate
  within.

**Task list:** umbrella `#2`, broken into linked sub-tasks `#4`–`#9`.

## Approach (priority order)

1. **`#4` — PE scraper data-corruption bugs** (`CODE_REVIEW.md` §1-3). Highest
   value, lowest risk; these silently corrupt scraped data.
   - `scrape_pe.py:188` pagination truncation (missing `total` → break after page 1)
   - `scrape_pe.py:309` freq regex mis-scales kHz (optional low-end unit)
   - `scrape_wavecor.py:251` label gate reads wattage cell as `freq_high_hz`
2. **`#5` — Unify `scraper_lib.py` + shared validation** (§4-5). Collapse the two
   divergent copies (632 vs 834 lines); move validation into the one write path.
3. **`#6` — Scraper robustness** (§6-8). Replace bare `except: pass` with problem-log
   entries; retry non-`ok` URLs; key OCR cache by content hash/mtime.
4. **`#7` — JS/Vue bugs** (§9,10,12). `FiltersPanel` id collision; `sweep.js` NaN
   when `Xmax` absent; `DriverPanel` dead `manuPageUrl` branch.
5. **`#9` — Docs/structure + CI guards** (§13-15). Fix history-in-docs violations,
   broken links, competing canonical sources; add no-history grep + link-checker.

## Blocked / needs human sign-off

- **`#8` — `driver.js` zero-denominator guard** (§11). `src/core` calculation code;
  the calculation-stability rule requires explicit human approval before any change,
  even an input-validation guard. **Do not start without sign-off.**

## Verification

- After each scraper fix: re-run the relevant scraper on a small sample, confirm the
  corrected field, and check `_problems.log` (per `SDLC.md` §5 data pipeline loop).
- Add/extend a test in the shared write path for `#5`.
- JS fixes (`#7`): `npm test` + `npm run test:visual`; `/verify` for the UI behaviour.
- Docs/CI (`#9`): the new no-history grep and markdown link-checker must pass.
- Each finding is deleted from `CODE_REVIEW/CODE_REVIEW.md` once its fix lands (the
  rationale goes in the commit message, per the no-history rule).
