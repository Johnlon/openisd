"""
Unit tests for pdf_lib._ocr_via_subprocess and full_text warn_fn plumbing.

Run:  python -m pytest scripts/scrapers/test_pdf_lib.py -v
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

_SCRAPERS_DIR = Path(__file__).parent.resolve()
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

import pdf_lib


class TestOcrViaSubprocessWarnFn(unittest.TestCase):
    """_ocr_via_subprocess must call warn_fn instead of silently returning '' on error."""

    def test_render_page_failure_calls_warn_fn(self):
        """render_page raises → warn_fn called with a message containing 'render_page'."""
        warnings = []
        with patch.object(pdf_lib, "render_page", side_effect=RuntimeError("disk full")):
            with patch.object(pdf_lib, "_TESSERACT_PATH", "/fake/tesseract"):
                result = pdf_lib._ocr_via_subprocess(
                    Path("fake.pdf"), page_num=0, warn_fn=warnings.append
                )
        self.assertEqual(result, "")
        self.assertEqual(len(warnings), 1)
        self.assertIn("render_page", warnings[0])
        self.assertIn("disk full", warnings[0])

    def test_subprocess_failure_calls_warn_fn(self):
        """subprocess.run raises → warn_fn called with a message containing 'tesseract'."""
        import subprocess
        warnings = []
        fake_png = b"\x89PNG\r\n"
        with patch.object(pdf_lib, "render_page", return_value=fake_png):
            with patch.object(pdf_lib, "_TESSERACT_PATH", "/fake/tesseract"):
                with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("t", 60)):
                    result = pdf_lib._ocr_via_subprocess(
                        Path("fake.pdf"), page_num=2, warn_fn=warnings.append
                    )
        self.assertEqual(result, "")
        self.assertEqual(len(warnings), 1)
        self.assertIn("tesseract", warnings[0].lower())

    def test_no_warn_fn_still_returns_empty_string(self):
        """Without warn_fn, failure still returns '' without raising."""
        with patch.object(pdf_lib, "render_page", side_effect=OSError("boom")):
            with patch.object(pdf_lib, "_TESSERACT_PATH", "/fake/tesseract"):
                result = pdf_lib._ocr_via_subprocess(Path("fake.pdf"), page_num=0)
        self.assertEqual(result, "")


class TestFullTextWarnFnPlumbing(unittest.TestCase):
    """full_text must thread warn_fn down to _ocr_via_subprocess."""

    def test_warn_fn_reaches_ocr_subprocess(self):
        """full_text(warn_fn=...) passes the callback into _ocr_via_subprocess."""
        warnings = []
        dummy_pdf = Path("dummy.pdf")

        with patch.object(pdf_lib, "extract_text", return_value=[""]):
            with patch.object(pdf_lib, "_page_needs_ocr", return_value=True):
                with patch.object(pdf_lib, "_OCR_OK", False):
                    with patch.object(
                        pdf_lib, "_ocr_via_subprocess",
                        side_effect=lambda path, page, warn_fn=None: (
                            warn_fn("synthetic warning") or ""
                            if warn_fn else ""
                        )
                    ) as mock_ocr:
                        pdf_lib.full_text(dummy_pdf, warn_fn=warnings.append)

        self.assertTrue(
            mock_ocr.called,
            "_ocr_via_subprocess was never called — full_text may have taken a cache path"
        )
        self.assertEqual(len(warnings), 1)
        self.assertEqual(warnings[0], "synthetic warning")


if __name__ == "__main__":
    unittest.main(verbosity=2)
