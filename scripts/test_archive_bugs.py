"""Tests for scripts/archive-bugs.py: a status region is the record's own, never a quoted example."""
import importlib.util
import os
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("archive_bugs", os.path.join(HERE, "archive-bugs.py"))
archive_bugs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive_bugs)


def region(text):
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as f:
        f.write(text)
    try:
        return archive_bugs.status_region_lines(f.name)
    finally:
        os.unlink(f.name)


def test_indented_example_header_is_not_a_status_region():
    text = "Status: FIXED\n\n## Evidence\n\n    # Status\n    - harness dialog: FIXED\n    - golden: OPEN\n"
    assert region(text) == ["Status: FIXED"]


def test_fenced_example_header_is_not_a_status_region():
    text = "Status: FIXED\n\n```\n# Status\n- golden: OPEN\n```\n"
    assert region(text) == ["Status: FIXED"]


def test_a_real_status_section_is_read():
    text = "# Title\n\n## Status\nCLOSED — done\n\n## Symptom\nOPEN is a word here.\n"
    assert region(text) == ["CLOSED — done"]


def test_bold_status_line_is_read():
    assert region("**Status:** FIXED 2026-10-03\n") == ["**Status:** FIXED 2026-10-03"]
