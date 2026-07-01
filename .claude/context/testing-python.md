# Python testing rules — scrapers

TDD applies to all Python code in `scripts/`. Same red→green discipline as JS: write a failing test first, watch it fail, fix, watch it pass.

## Framework

- `unittest.TestCase` (stdlib) — established convention in `scripts/scrapers/test_scraper_lib.py`.
- Tests live alongside the code they test: `scripts/scrapers/test_<module>.py`.
- Run the suite: `python -m pytest scripts/scrapers/ -v`
- This command runs as part of `scripts/health-check.sh` — add new test files there so they run in the CI gate.

## What to test

Scrapers have two layers — only the parsing layer gets unit tests:

**Parsing / extraction (unit test everything here):**

- `parse_field_value`, `extract_h1`, `parse_freq_range_str`, HTML→WDR field mapping.
- Pure functions, testable without network access.
- Every parser function must have direct unit tests before shipping.

**Network / HTTP (integration — do NOT mock):**

- `requests.get`, WooCommerce pagination, rate limiting, caching.
- When a real HTML sample is needed, save it as a fixture file (see Fixtures section below) — never hit the live site from a unit test.

## Test rules

- **Human-readable docstrings:** Every `def test_*` method must have a one-line docstring in the format `'<input>' → <expected>` or `<physical scenario> → <expected outcome>`. A loudspeaker engineer with no Python knowledge must understand what is being verified without reading the code body.

- **No magic numbers:** Every numeric literal (inputs, expected values) must be a named constant at class or module level with a comment explaining its physical meaning. Pattern from `test_scraper_lib.py`:

  ```python
  PP_FACTOR = 0.5e-3  # SB Acoustics publishes Xmax peak-to-peak; halve and convert mm→m
  OW_FACTOR = 1e-3    # one-way mm → m (canonical default for all other scrapers)
  ```

- **Tolerances documented:** Every `assertAlmostEqual(…, places=N)` — explain why N is physically appropriate in the method docstring. Example: `places=7` for Xmax in metres (sub-micron precision suffices; beyond that is floating-point noise).

- **Regression guards for known bugs:** When a parser bug is fixed, add a test that would have caught it. Name it `test_<field>_<bug>_regression`. Include a comment describing what the bug was. See `test_soundimports_bug_regression` in `test_scraper_lib.py` for the pattern.

- **`mg` vs `g`, `mH` vs `H`, `mm` vs `m`:** Every unit-detection path must have an explicit test confirming that the shorter suffix does not swallow the longer one (e.g. `mg` must not fall through to the `g` path).

## Red→green TDD cycle

1. Write a test in `test_<module>.py` that exercises the parser on the specific input exposing the bug or new requirement.
2. `python -m pytest scripts/scrapers/test_<module>.py -v` — confirm the test **fails**, and fails for the right reason (wrong value, not an import error).
3. Fix the parser.
4. Run again — confirm it **passes**.
5. Run the full suite: `python -m pytest scripts/` — confirm no regressions.

Never claim a parser bug is fixed without first seeing a test for it fail.

## Fixtures for HTML-based tests

When a test needs to exercise parsing against real HTML:

1. Save a minimal HTML excerpt as `scripts/scrapers/fixtures/<collection>_<page_type>.html`.
2. Load it in the test with `Path(__file__).parent / "fixtures" / "<filename>"` — no network, no caching, no side effects.
3. Trim the HTML to the minimum that exercises the case under test — smaller fixtures are easier to understand.
