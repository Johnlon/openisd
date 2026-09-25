# `archive-bugs.py` reads a `# Status` header inside a code block as a real status header

## Status
OPEN

## Symptom

`bugs/BUG_20260822_archive_bugs_script_classifies_by_first_status_line_and_carries_per_file_overrides.md`
states `Status: FIXED` and is never archived. Its status region reads:

    Status: FIXED — classifier rewritten to scan every status line; overrides deleted
    - harness dialog handling: FIXED 2026-08-14
    - missing golden for solve-from-mms-cms: OPEN

The last two lines are not that record's status. They are a quoted example inside its `## Evidence`
section, illustrating the shape of a different record. `is_closed_bug()` sees `OPEN` among them and
returns `False`, so a genuinely fixed record is pinned in `bugs/` permanently.

## Cause

`status_region_lines()` (`scripts/archive-bugs.py:23-45`) strips each line before matching:

```python
stripped = line.strip()
if re.match(r"^#+\s*status\b", stripped, re.IGNORECASE):
    in_status = True
```

An indented code block containing an example header

        # Status
        - harness dialog handling: FIXED 2026-08-14
        - missing golden for solve-from-mms-cms: OPEN

has its indentation removed by `.strip()`, so the example `# Status` matches as a real header and
the following bullets are absorbed as status lines. The scanner tracks no code-block state, in
either the indented or the fenced form.

The same mechanism makes the status region absorb ordinary prose. Three further records currently
carry both an open and a closed term for that reason — `address-bar-carries-no-design-state`
(the word "fixed" in a sentence), `winisd-compatibility-air-does-not-scale-with-temperature`
("NOT FIXED"), and `model_depends_on_winisd_and_re_exports_its_cellstate` ("docs fixed
2026-08-21"). Those three classify correctly by luck: an open term is present and open wins.

## Severity

The failure direction is conservative — a record is kept in `bugs/` rather than wrongly archived —
so nothing is lost. The cost is that the release gate's row-4 count includes records that are done,
and no amount of correcting a record's own status can free it while the parser reads its examples.

## Fix

Track code-block state in `status_region_lines()`: skip fenced blocks between ``` delimiters, and
skip lines indented four or more spaces, before testing for a status header. Match the header on
the raw line's leading `#`, not on the stripped line.

Editing the affected record to dodge the parser is not the fix — the parser is what is wrong, and
the next record to quote an example would hit it again.

## Verification

`is_closed_bug('BUG_20260822_archive_bugs_script_classifies_by_first_status_line_and_carries_per_file_overrides.md')`
returns `True`, and a record whose real status region says OPEN still returns `False` with an
example block present.
