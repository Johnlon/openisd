"""
Unit tests for pdf_lib._ocr_via_subprocess and full_text error logging.

Unexpected OCR failures (render_page crash, tesseract crash) must ALWAYS
emit a warning to stderr — never silently return empty string with no trace.

Run:  python -m pytest scripts/scrapers/test_pdf_lib.py -v
"""
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

_SCRAPERS_DIR = Path(__file__).parent.resolve()
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

import pdf_lib


class TestOcrViaSubprocessAlwaysLogs(unittest.TestCase):
    """_ocr_via_subprocess must always write to stderr on unexpected failure."""

    def test_render_page_failure_logs_to_stderr(self):
        """render_page raises → message containing 'render_page' always emitted to stderr."""
        stderr_capture = io.StringIO()
        with patch.object(pdf_lib, "render_page", side_effect=RuntimeError("disk full")):
            with patch.object(pdf_lib, "_TESSERACT_PATH", "/fake/tesseract"):
                with patch("sys.stderr", stderr_capture):
                    result = pdf_lib._ocr_via_subprocess(Path("fake.pdf"), page_num=0)
        self.assertEqual(result, "")
        output = stderr_capture.getvalue()
        self.assertIn("render_page", output)
        self.assertIn("disk full", output)

    def test_subprocess_failure_logs_to_stderr(self):
        """subprocess.run raises → message containing 'tesseract' always emitted to stderr."""
        import subprocess
        stderr_capture = io.StringIO()
        with patch.object(pdf_lib, "render_page", return_value=b"\x89PNG\r\n"):
            with patch.object(pdf_lib, "_TESSERACT_PATH", "/fake/tesseract"):
                with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("t", 60)):
                    with patch("sys.stderr", stderr_capture):
                        result = pdf_lib._ocr_via_subprocess(Path("fake.pdf"), page_num=2)
        self.assertEqual(result, "")
        output = stderr_capture.getvalue()
        self.assertIn("tesseract", output.lower())

    def test_missing_tesseract_warns_to_stderr(self):
        """_TESSERACT_PATH=None (tesseract not installed) → warning on stderr.
        Missing tesseract means OCR pages get no text extracted — that is data loss,
        not a graceful degradation, so it must always be visible."""
        stderr_capture = io.StringIO()
        with patch.object(pdf_lib, "_TESSERACT_PATH", None):
            with patch("sys.stderr", stderr_capture):
                result = pdf_lib._ocr_via_subprocess(Path("fake.pdf"), page_num=0)
        self.assertEqual(result, "")
        output = stderr_capture.getvalue()
        self.assertIn("tesseract", output.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
