"""
Unit tests for scripts/scrapers/scraper_lib.py helpers.

Run:  python scripts/scrapers/test_scraper_lib.py
      python -m pytest scripts/scrapers/test_scraper_lib.py
"""
import sys
import unittest
from pathlib import Path

# scripts/scrapers/ must shadow scripts/ — both have scraper_lib.py, but only
# the child (scrapers/) exports the helpers under test. Force it to position 0
# unconditionally; Python may have already added it elsewhere when running this
# file directly, which would cause the parent to win without this.
_SCRAPERS_DIR = Path(__file__).parent.resolve()
_SCRIPTS_DIR  = _SCRAPERS_DIR.parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))
sys.path.insert(0, str(_SCRAPERS_DIR))  # must be position 0

from scraper_lib import (
    extract_h1,
    extract_li_specs,
    extract_measurement_links,
    match_ts_fields,
    parse_freq_range_str,
    parse_field_value,
    woocommerce_url_filter,
)


# ── parse_field_value: Xmax ────────────────────────────────────────────────────

class TestParseFieldValueXmax(unittest.TestCase):
    """Xmax unit detection — mm (nominal default), bare m (SI), inches, p-p factor."""

    # SB Acoustics publishes Xmax peak-to-peak; scraper passes factor=0.5e-3.
    PP_FACTOR = 0.5e-3
    # All other scrapers use one-way mm; factor=1e-3 is the canonical default.
    OW_FACTOR = 1e-3

    def test_mm_with_unit_string(self):
        """'7 mm' with one-way factor → 0.007 m (millimetres detected, ×1e-3)."""
        self.assertAlmostEqual(parse_field_value("Xmax", "7 mm", self.OW_FACTOR), 0.007, places=7)

    def test_bare_number_uses_nominal_factor(self):
        """'7' with no unit → nominal factor applied unchanged → 0.007 m."""
        self.assertAlmostEqual(parse_field_value("Xmax", "7", self.OW_FACTOR), 0.007, places=7)

    def test_si_metres_detected(self):
        """'0.007 m' — bare 'm' present, no 'mm' → factor=1.0 → 0.007 m."""
        self.assertAlmostEqual(parse_field_value("Xmax", "0.007 m", self.OW_FACTOR), 0.007, places=7)

    def test_si_metres_uppercase_m(self):
        """'0.007 M' uppercased — lowercased before detection → 0.007 m."""
        self.assertAlmostEqual(parse_field_value("Xmax", "0.007 M", self.OW_FACTOR), 0.007, places=7)

    def test_mm_not_mistaken_for_bare_m(self):
        """'7 mm' must NOT trigger the bare-m path — result must be 0.007, not 7.0."""
        result = parse_field_value("Xmax", "7 mm", self.OW_FACTOR)
        self.assertAlmostEqual(result, 0.007, places=7)
        self.assertNotAlmostEqual(result, 7.0, places=3)

    def test_inches(self):
        """'0.5 in' → 0.5 × 25.4e-3 = 0.0127 m."""
        INCH_M = 25.4e-3
        self.assertAlmostEqual(
            parse_field_value("Xmax", "0.5 in", self.OW_FACTOR),
            0.5 * INCH_M, places=7
        )

    def test_pp_factor_with_mm(self):
        """'14 mm' with p-p factor 0.5e-3 (SB Acoustics convention) → 0.007 m."""
        self.assertAlmostEqual(parse_field_value("Xmax", "14 mm", self.PP_FACTOR), 0.007, places=7)

    def test_plus_minus_notation_abs(self):
        """'+/-7 mm' → abs applied → 0.007 m (not -0.007)."""
        result = parse_field_value("Xmax", "+/-7 mm", self.OW_FACTOR)
        self.assertGreater(result, 0)
        self.assertAlmostEqual(result, 0.007, places=7)


# ── parse_field_value: Mms ────────────────────────────────────────────────────

class TestParseFieldValueMms(unittest.TestCase):
    """Mms unit detection — g (default), kg passthrough, mg for ultra-light domes."""

    # Nominal: grams → kg, factor 1e-3
    G_FACTOR = 1e-3

    def test_grams_with_unit_string(self):
        """'5 g' → 5 × 1e-3 = 0.005 kg."""
        self.assertAlmostEqual(parse_field_value("Mms", "5 g", self.G_FACTOR), 0.005, places=9)

    def test_bare_number_assumes_grams(self):
        """'5' with no unit → nominal ×1e-3 → 0.005 kg."""
        self.assertAlmostEqual(parse_field_value("Mms", "5", self.G_FACTOR), 0.005, places=9)

    def test_kilograms_passthrough(self):
        """'0.005 kg' → ×1.0 → 0.005 kg (already SI)."""
        self.assertAlmostEqual(parse_field_value("Mms", "0.005 kg", self.G_FACTOR), 0.005, places=9)

    def test_milligrams(self):
        """'500 mg' (ultra-light tweeter) → 500 × 1e-6 = 5e-4 kg = 0.5 g."""
        # 500 mg = 0.5 g = 5e-4 kg; old code would give 0.5 (500 × 1e-3) which is 500× wrong.
        self.assertAlmostEqual(parse_field_value("Mms", "500 mg", self.G_FACTOR), 5e-4, places=9)

    def test_mg_not_confused_with_g(self):
        """'mg' must not fall through to the bare-g path and be treated as grams."""
        result_mg = parse_field_value("Mms", "500 mg", self.G_FACTOR)
        result_g  = parse_field_value("Mms", "500 g",  self.G_FACTOR)
        # mg result must be 1000× smaller than g result.
        self.assertAlmostEqual(result_mg * 1000, result_g, places=6)


# ── parse_field_value: Le ─────────────────────────────────────────────────────

class TestParseFieldValueLe(unittest.TestCase):
    """Le unit detection — mH (default), µH, bare H (no prefix)."""

    # Nominal: millihenries → henries, factor 1e-3
    MH_FACTOR = 1e-3

    def test_millihenries(self):
        """'0.5 mH' → 0.5 × 1e-3 = 5e-4 H."""
        self.assertAlmostEqual(parse_field_value("Le", "0.5 mH", self.MH_FACTOR), 5e-4, places=9)

    def test_microhenries_uh(self):
        """'500 uH' → 500 × 1e-6 = 5e-4 H."""
        self.assertAlmostEqual(parse_field_value("Le", "500 uH", self.MH_FACTOR), 5e-4, places=9)

    def test_microhenries_symbol(self):
        """'500 µH' (Unicode µ) → 500 × 1e-6 = 5e-4 H."""
        self.assertAlmostEqual(parse_field_value("Le", "500 µH", self.MH_FACTOR), 5e-4, places=9)

    def test_bare_henries_no_prefix(self):
        """'0.0005 H' (full SI unit, no milli prefix) → ×1.0 → 5e-4 H.
        Old code applied ×1e-3 → 5e-7 H (off by 1000×)."""
        self.assertAlmostEqual(parse_field_value("Le", "0.0005 H", self.MH_FACTOR), 5e-4, places=9)

    def test_bare_number_assumes_mh(self):
        """'0.5' no unit → nominal ×1e-3 → 5e-4 H."""
        self.assertAlmostEqual(parse_field_value("Le", "0.5", self.MH_FACTOR), 5e-4, places=9)

    def test_mh_not_mistaken_for_bare_h(self):
        """'0.5 mH' must produce 5e-4 H, not 0.5 H (mH must not match bare-H path)."""
        result = parse_field_value("Le", "0.5 mH", self.MH_FACTOR)
        self.assertAlmostEqual(result, 5e-4, places=9)
        self.assertNotAlmostEqual(result, 0.5, places=3)


# ── parse_freq_range_str ──────────────────────────────────────────────────────

class TestParseFreqRangeStr(unittest.TestCase):
    """parse_freq_range_str — unit-aware frequency range parsing (Hz and kHz mixed)."""

    def test_hz_to_khz(self):
        """'20 Hz - 20 kHz' → (20.0, 20000.0)."""
        lo, hi = parse_freq_range_str("20 Hz - 20 kHz")
        self.assertAlmostEqual(lo, 20.0, places=3)
        self.assertAlmostEqual(hi, 20000.0, places=3)

    def test_both_khz(self):
        """'0.5 kHz - 5 kHz' → (500.0, 5000.0)."""
        lo, hi = parse_freq_range_str("0.5 kHz - 5 kHz")
        self.assertAlmostEqual(lo, 500.0, places=3)
        self.assertAlmostEqual(hi, 5000.0, places=3)

    def test_bare_numbers_trailing_hz(self):
        """'20 - 20000 Hz' — trailing Hz applies to both ends → (20.0, 20000.0)."""
        lo, hi = parse_freq_range_str("20 - 20000 Hz")
        self.assertAlmostEqual(lo, 20.0, places=3)
        self.assertAlmostEqual(hi, 20000.0, places=3)

    def test_wavecor_style_unit_in_separate_arg(self):
        """Wavecor style: val='0.5 - 5', unit_str='[kHz]' → (500.0, 5000.0)."""
        lo, hi = parse_freq_range_str("0.5 - 5", unit_str="[kHz]")
        self.assertAlmostEqual(lo, 500.0, places=3)
        self.assertAlmostEqual(hi, 5000.0, places=3)

    def test_single_hz_upper_limit(self):
        """'80 Hz' — single value → upper limit only: (None, 80.0)."""
        lo, hi = parse_freq_range_str("80 Hz")
        self.assertIsNone(lo)
        self.assertAlmostEqual(hi, 80.0, places=3)

    def test_single_khz_upper_limit(self):
        """'20 kHz' — kHz applied → (None, 20000.0)."""
        lo, hi = parse_freq_range_str("20 kHz")
        self.assertIsNone(lo)
        self.assertAlmostEqual(hi, 20000.0, places=3)

    def test_empty_string(self):
        """Empty string → (None, None)."""
        lo, hi = parse_freq_range_str("")
        self.assertIsNone(lo)
        self.assertIsNone(hi)

    def test_full_range_text(self):
        """'full range' (Wavecor non-numeric string) → (None, None)."""
        lo, hi = parse_freq_range_str("full range")
        self.assertIsNone(lo)
        self.assertIsNone(hi)

    def test_soundimports_bug_regression(self):
        """'20 Hz - 20 kHz' was previously stored as freq_high_hz=20 (kHz dropped).
        Regression guard: high must be 20000, not 20."""
        _, hi = parse_freq_range_str("20 Hz - 20 kHz")
        # If kHz had been ignored, hi would be 20.  Correct answer is 20000.
        self.assertGreater(hi, 1000.0,
            "freq_high_hz='20 kHz' was silently stored as 20 Hz — kHz multiplier lost")


# ── woocommerce_url_filter ────────────────────────────────────────────────────

class TestWoocommerceUrlFilter(unittest.TestCase):
    """woocommerce_url_filter — accept /product/, reject /product-category/ and nav."""

    def test_product_url_accepted(self):
        """'/product/18w8546-00/' → True."""
        self.assertTrue(woocommerce_url_filter("https://www.scan-speak.dk/product/18w8546-00/"))

    def test_sbacoustics_product_accepted(self):
        """SB Acoustics product URL → True."""
        self.assertTrue(woocommerce_url_filter("https://sbacoustics.com/product/sb23nrxs45-8/"))

    def test_product_category_rejected(self):
        """'/product-category/woofers/' → False."""
        self.assertFalse(woocommerce_url_filter("https://www.scan-speak.dk/product-category/woofers/"))

    def test_homepage_rejected(self):
        """Bare homepage with no /product/ segment → False."""
        self.assertFalse(woocommerce_url_filter("https://www.scan-speak.dk/"))

    def test_checkout_rejected(self):
        """'/checkout/' has no /product/ → False."""
        self.assertFalse(woocommerce_url_filter("https://www.scan-speak.dk/checkout/"))


# ── extract_h1 ────────────────────────────────────────────────────────────────

class TestExtractH1(unittest.TestCase):
    """extract_h1 — first <h1> text content, decoded and stripped."""

    def test_plain_h1(self):
        """<h1>Title</h1> → 'Title'."""
        self.assertEqual(extract_h1("<h1>Title</h1>"), "Title")

    def test_nested_tags_stripped(self):
        """Tags inside h1 stripped: <h1>Foo <b>Bar</b></h1> → 'Foo Bar'."""
        self.assertEqual(extract_h1("<h1>Foo <b>Bar</b></h1>"), "Foo Bar")

    def test_entity_decoded(self):
        """Numeric entity decoded: <h1>18W&#47;8546-00</h1> → '18W/8546-00'."""
        self.assertEqual(extract_h1("<h1>18W&#47;8546-00</h1>"), "18W/8546-00")

    def test_no_h1_returns_fallback(self):
        """No <h1> in HTML → fallback returned."""
        self.assertEqual(extract_h1("<p>no heading</p>", fallback="slug"), "slug")

    def test_no_h1_empty_default(self):
        """No <h1>, no fallback arg → empty string."""
        self.assertEqual(extract_h1("<p>no heading</p>"), "")

    def test_first_h1_wins(self):
        """Multiple <h1> elements → text of the first one."""
        self.assertEqual(extract_h1("<h1>First</h1><h1>Second</h1>"), "First")


# ── extract_measurement_links ─────────────────────────────────────────────────

class TestExtractMeasurementLinks(unittest.TestCase):
    """extract_measurement_links — FRD/ZMA/ZIP/TXT URL extraction with optional filter."""

    HTML = (
        '<a href="http://vendor.com/data.frd">FRD</a>'
        '<a href="http://vendor.com/imp.zma">ZMA</a>'
        '<a href="http://vendor.com/arch.zip">ZIP</a>'
        '<a href="http://vendor.com/photo.jpg">ignore</a>'
    )

    def test_frd_zma_zip_found(self):
        """FRD, ZMA, and ZIP URLs extracted; .jpg ignored."""
        links = extract_measurement_links(self.HTML)
        self.assertIn("http://vendor.com/data.frd", links)
        self.assertIn("http://vendor.com/imp.zma", links)
        self.assertIn("http://vendor.com/arch.zip", links)
        self.assertNotIn("http://vendor.com/photo.jpg", links)

    def test_url_filter_restricts(self):
        """url_filter restricts to URLs matching a predicate."""
        links = extract_measurement_links(
            self.HTML, url_filter=lambda u: u.endswith(".frd")
        )
        self.assertEqual(links, ["http://vendor.com/data.frd"])

    def test_vendor_prefix_filter(self):
        """SB-Acoustics-style filter (CDN path): only CDN-hosted FRD links pass."""
        html = (
            '"https://sbacoustics.com/wp-content/uploads/meas.frd"'
            '"https://otherdomain.com/meas.frd"'
        )
        links = extract_measurement_links(
            html,
            url_filter=lambda u: "sbacoustics.com/wp-content/uploads/" in u,
        )
        self.assertEqual(links, ["https://sbacoustics.com/wp-content/uploads/meas.frd"])


# ── extract_li_specs ──────────────────────────────────────────────────────────

class TestExtractLiSpecs(unittest.TestCase):
    """extract_li_specs — {label: qualifier-stripped value} from <li> items."""

    def test_basic_label_value(self):
        """Label present as key; value is same text."""
        html = "<li>Fs: 45 Hz</li>"
        specs = extract_li_specs(html)
        self.assertIn("Fs: 45 Hz", specs)

    def test_qualifier_stripped_from_value_not_label(self):
        """Parenthetical stripped from value but kept in label key."""
        html = "<li>SPL: 88 dB (2.83V/1m)</li>"
        specs = extract_li_specs(html)
        key = "SPL: 88 dB (2.83V/1m)"
        self.assertIn(key, specs)
        self.assertNotIn("(2.83V/1m)", specs[key])

    def test_multiple_items(self):
        """Multiple <li> items all extracted."""
        html = "<li>Fs: 45 Hz</li><li>Re: 6.1 Ω</li><li>Qts: 0.38</li>"
        specs = extract_li_specs(html)
        self.assertEqual(len(specs), 3)

    def test_entities_decoded(self):
        """HTML entities decoded in both key and value."""
        html = "<li>BL: 7.5 T&middot;m</li>"
        specs = extract_li_specs(html)
        # Middot decoded in key
        self.assertTrue(any("·" in k for k in specs))

    def test_empty_html(self):
        """No <li> items → empty dict."""
        self.assertEqual(extract_li_specs("<p>no list</p>"), {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
