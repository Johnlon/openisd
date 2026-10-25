#!/usr/bin/env python3
"""Tests for feedback-page.py and check-answerable.mjs. Run: python3 feedback_page_test.py"""
import importlib.util, os, subprocess, tempfile, unittest, pathlib

HERE = pathlib.Path(__file__).resolve().parent
NODE_OK = (HERE.parent.parent / "node_modules/playwright/index.mjs").exists()


def load():
    spec = importlib.util.spec_from_file_location("feedback_page", HERE / "feedback-page.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def run_check(*urls):
    return subprocess.run(["node", str(HERE / "check-answerable.mjs"), *urls], capture_output=True, text=True, cwd="/tmp")


def _png(marked):
    import base64, io
    from PIL import Image, PngImagePlugin
    info = PngImagePlugin.PngInfo()
    if marked:
        info.add_text("marked", "1")
    buf = io.BytesIO(); Image.new("RGB", (200, 100), "white").save(buf, "PNG", pnginfo=info)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


MARKED, PLAIN = _png(True), _png(False)


def fig(alt, src=MARKED, look="Look at: the thing", box=True):
    return (f'<figure data-item data-name="{alt}"><p class="look">{look}</p><img src="{src}" alt="{alt}">'
            + ("<form><input type=text></form>" if box else "") + "</figure>")


def good_page(*figs):
    return '<!doctype html><meta name=viewport content="width=device-width"><body><p><b>What to do:</b> type below.</p>' + "".join(figs) + "</body>"


GOOD = good_page(fig("a"), fig("b"))


class Generate(unittest.TestCase):
    def test_writes_page_from_template(self):
        m = load()
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d, "index.md").write_text("# My fixes\n| a |\n|---|\n| b |\n")
            m.write_page(pathlib.Path(d), "QO12", "Look at each picture.")
            html = pathlib.Path(d, "index.html").read_text()
            self.assertIn("QO12", html)
            self.assertIn("Look at each picture.", html)
            self.assertIn("My fixes", html)
            self.assertNotIn("__ITEM__", html)
            self.assertNotIn("__TODO__", html)
            self.assertLess(html.index("What to do"), html.index("<h1>"))

    def test_todo_is_escaped(self):
        m = load()
        with tempfile.TemporaryDirectory() as d:
            m.write_page(pathlib.Path(d), "QO1", "<script>x</script> & y")
            html = pathlib.Path(d, "index.html").read_text()
            self.assertNotIn("<script>x</script>", html)

    def test_same_source_for_every_folder(self):
        m = load()
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            m.write_page(pathlib.Path(a), "QO1", "t"); m.write_page(pathlib.Path(b), "QO1", "t")
            self.assertEqual(pathlib.Path(a, "index.html").read_text().replace(pathlib.Path(a).name, ""),
                             pathlib.Path(b, "index.html").read_text().replace(pathlib.Path(b).name, ""))


@unittest.skipUnless(NODE_OK, "playwright missing")
class Checker(unittest.TestCase):
    def page(self, body):
        d = tempfile.mkdtemp(); p = pathlib.Path(d, "p.html"); p.write_text(body); return "file://" + str(p)

    def test_good_page_passes(self):
        r = run_check(self.page(GOOD)); self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_missing_box_named(self):
        r = run_check(self.page(good_page(fig("a"), fig("pic-b", box=False))))
        self.assertEqual(r.returncode, 1); self.assertIn("pic-b", r.stdout)

    def test_two_pictures_one_box_fails(self):
        two = '<figure data-item data-name="x"><p class="look">Look at: x</p><img src="%s"><img src="%s"><form><input type=text></form></figure>' % (MARKED, MARKED)
        r = run_check(self.page(good_page(two))); self.assertEqual(r.returncode, 1)

    def test_before_after_pair_is_one_item(self):
        pair = '<figure data-item data-pair="pair" data-name="x"><p class="look">Look at: x</p><img src="%s"><img src="%s"><form><textarea></textarea></form></figure>' % (MARKED, MARKED)
        r = run_check(self.page(good_page(pair))); self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        three = pair.replace("<form>", '<img src="%s"><form>' % MARKED)
        self.assertEqual(run_check(self.page(good_page(three))).returncode, 1)

    def test_unmarked_after_in_pair_names_the_after(self):
        pair = ('<figure data-item data-pair="pair" data-name="F/x/before.png"><p class="look">Look at: x</p>'
                '<a href="x/before.png"><img src="%s"></a><a href="x/after.png"><img src="%s"></a>'
                '<form><textarea></textarea></form></figure>') % (MARKED, PLAIN)
        r = run_check(self.page(good_page(pair)))
        self.assertEqual(r.returncode, 1); self.assertIn("not marked", r.stdout)
        self.assertIn("x/after.png", r.stdout); self.assertNotIn("before.png", r.stdout)

    def test_unmarked_picture_fails(self):
        r = run_check(self.page(good_page(fig("plain-one", src=PLAIN))))
        self.assertEqual(r.returncode, 1); self.assertIn("not marked", r.stdout); self.assertIn("plain-one", r.stdout)

    def test_legacy_skips_marked_check(self):
        r = run_check("--legacy", self.page(good_page(fig("plain-one", src=PLAIN))))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_answered_fold_is_not_checked(self):
        folded = '<details class="ruled"><summary>Already answered (1)</summary>%s</details>' % fig("old-one", src=PLAIN, look="Look at:")
        r = run_check(self.page(good_page(fig("a"), folded)))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_live_mock_item_passes(self):
        ok = '<figure data-item data-name="m"><p class="look">Look at: the handle</p><a class="live" href="mock-a.html?look=fb-handle">Open live mock</a><form><input type=text></form></figure>'
        r = run_check(self.page(good_page(ok))); self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_empty_statement_fails(self):
        r = run_check(self.page(good_page(fig("nostate", look="Look at:"))))
        self.assertEqual(r.returncode, 1); self.assertIn("no clear statement", r.stdout)

    def test_text_only_item_needs_statement_and_box(self):
        ok = '<figure data-item data-name="q"><p class="look">Question: A or B?</p><form><input type=text></form></figure>'
        self.assertEqual(run_check(self.page(good_page(ok))).returncode, 0)
        bad = '<figure data-item data-name="q"><p class="look"></p></figure>'
        self.assertEqual(run_check(self.page(good_page(bad))).returncode, 1)

    def test_no_what_to_do_first(self):
        bad = GOOD.replace("<p><b>What to do:</b> type below.</p>", "<h1>Title</h1>")
        r = run_check(self.page(bad)); self.assertEqual(r.returncode, 1); self.assertIn("What to do", r.stdout)

    def test_wide_page_fails(self):
        bad = GOOD.replace("</body>", '<div style="width:3000px">x</div></body>')
        r = run_check(self.page(bad)); self.assertEqual(r.returncode, 1); self.assertIn("scrollWidth", r.stdout)


class MarkDiff(unittest.TestCase):
    def test_box_mode_writes_marker(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d, "p.png"); Image.new("RGB", (100, 100), "white").save(f)
            subprocess.run(["python3", str(HERE / "mark-diff.py"), str(f), "--box", "10,10,30,30"], check=True, capture_output=True)
            self.assertEqual(Image.open(f).text.get("marked"), "1")

    def test_stamp_mode_writes_marker(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d, "p.png"); Image.new("RGB", (50, 50), "white").save(f)
            subprocess.run(["python3", str(HERE / "mark-diff.py"), "--stamp", str(f)], check=True, capture_output=True)
            self.assertEqual(Image.open(f).text.get("marked"), "1")

    def test_print_box_gives_the_drawn_boxes_as_json(self):
        import json
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as d:
            a = Image.new("RGB", (300, 400), "white"); b = a.copy()
            ImageDraw.Draw(b).rectangle((40, 100, 200, 140), fill="black")
            fa, fb = pathlib.Path(d, "a.png"), pathlib.Path(d, "b.png"); a.save(fa); b.save(fb)
            r = subprocess.run(["python3", str(HERE / "mark-diff.py"), str(fa), str(fb), "--print-box"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            boxes = json.loads(r.stdout.strip().splitlines()[-1])
            self.assertEqual(boxes["before"], [])
            self.assertEqual(len(boxes["after"]), 1)
            x, y, w, h = boxes["after"][0]
            self.assertTrue(x <= 40 and y <= 100 and x + w >= 200 and y + h >= 140)


class SharedThreadModule(unittest.TestCase):
    """One conversation, one code (T508): the page draws, sends and polls through the board's thread module."""
    def test_template_uses_board_thread_module_only(self):
        t = (HERE / "feedback-page.template.html").read_text(encoding="utf-8")
        self.assertIn('<script src="/board/thread.js"></script>', t)
        self.assertIn("store.list(", t); self.assertIn("store.compose(", t)
        for own_copy in ("waitingLine", "pollThread", "/board/api/inbox", "/board/api/thread", "function said("):
            self.assertNotIn(own_copy, t)


@unittest.skipUnless(NODE_OK, "playwright missing")
class RuledPictures(unittest.TestCase):
    def test_answered_pictures_fold_away(self):
        with tempfile.TemporaryDirectory() as d:
            folder = pathlib.Path(d) / "F"; folder.mkdir()
            page = load().write_page(folder, "QO0", "t")
            done = subprocess.run(["node", str(HERE / "feedback_page_ruled_test.mjs"), str(page)],
                                  capture_output=True, text=True, cwd="/tmp")
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)

    def test_same_change_pictures_fold_and_keep_their_boxes(self):
        with tempfile.TemporaryDirectory() as d:
            folder = pathlib.Path(d) / "F"; folder.mkdir()
            page = load().write_page(folder, "QO0", "t")
            done = subprocess.run(["node", str(HERE / "feedback_page_group_test.mjs"), str(page)],
                                  capture_output=True, text=True, cwd="/tmp")
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)

    def test_live_thread_send_order_and_poll(self):
        with tempfile.TemporaryDirectory() as d:
            folder = pathlib.Path(d) / "F"; folder.mkdir()
            page = load().write_page(folder, "QO0", "t")
            done = subprocess.run(["node", str(HERE / "feedback_page_live_test.mjs"), str(page)],
                                  capture_output=True, text=True, cwd="/tmp")
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)

if __name__ == "__main__":
    unittest.main()
