"""
رجیستریِ بازی‌ها: نام‌گذاری، مرتب‌سازی، تطبیقِ هویت، همگام‌سازی و API.

سناریوها از کارِ واقعیِ تیمِ محتوا آمده‌اند: فایلِ تازه، جا باز کردن بینِ دو
بازی، تغییرِ نام، کپیِ اشتباهی، نامِ غلط، پاک کردنِ فایل، و آپلودِ نیمه‌کاره.
"""
import hashlib
import importlib
import random
import tempfile
from pathlib import Path

from django.apps import apps as django_apps
from django.core.cache import cache as django_cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile, User
from apps.parent.models import DailyAssignment

from . import registry
from .models import Book, Game, GameCompletion, GameEvent
from .naming import BOOKS, parse
from .registry import (CONFLICT, INVALID, MISSING, READY, GameFile, Known, clean_title,
                       plan, scan)


def gf(name: str, content: str | None = None, title: str = "بازی", folder: str = "") -> GameFile:
    """یک فایلِ ساختگی برای برنامه‌ریز (بی‌دیسک)."""
    body = content if content is not None else f"<title>{title}</title>{name}"
    path = f"/games/{folder}{name}"
    return GameFile(path=path, name=name, digest=hashlib.sha256(body.encode()).hexdigest(),
                    title=title, parsed=parse(name))


def known_from(entries, **overrides) -> list[Known]:
    """ردیف‌های «موجود» پس از اعمالِ یک برنامه — برای شبیه‌سازیِ همگام‌سازیِ بعدی."""
    rows = []
    for i, e in enumerate(entries):
        code = e.code
        rows.append(Known(
            slug=e.slug or f"s{i}-{e.file.name}",
            path=e.file.path, digest=e.file.digest, status=e.status,
            slot=code.slot if e.status == READY else None, title=e.title,
            referenced=overrides.get("referenced", False),
        ))
    return rows


# ====================================================================== نام
class NamingTests(SimpleTestCase):
    def test_canonical_name(self):
        r = parse("C1-Kr-F1-S2-G2.html")
        self.assertTrue(r.ok)
        self.assertEqual((r.code.grade, r.code.book, r.code.chapter, r.code.week, r.code.number),
                         (1, "r", 1, 2, 2))
        self.assertEqual(r.code.slot, (1, 1, 2, 2, "r"))
        self.assertEqual(r.code.sort_key, (1, 1, 2, 2, 0))
        self.assertEqual(r.code.book_id, "math-1")
        self.assertEqual(str(r.code), "C1-Kr-F1-S2-G2")
        self.assertEqual(r.notes, ())

    def test_compact_names_are_accepted(self):
        """تیمِ محتوا بی‌خط‌تیره نام می‌گذارد: C1KrF1S2g2 همان C1-Kr-F1-S2-G2 است."""
        for name in ("C1KrF1S2g2.html", "C1KrF1S2G2.html", "c1krf1s2g2.html",
                     "C1Kr-F1-S2-G2.html"):
            r = parse(name)
            self.assertTrue(r.ok, name)
            self.assertEqual(r.code.slot, (1, 1, 2, 2, "r"), name)
            self.assertEqual(r.notes, (), name)

    def test_compact_name_with_a_book_whose_letter_is_also_a_part(self):
        # «Kf» نباید به K و F شکسته شود
        r = parse("C1KfF2S2g2.html")
        self.assertTrue(r.ok)
        self.assertEqual((r.code.book, r.code.chapter, r.code.week), ("f", 2, 2))

    def test_broken_studio_names(self):
        """نام‌هایی که واقعاً در مخزنِ استودیو خراب بودند."""
        self.assertInvalid("C1KrF11Sg1.html", "S")        # هفته عدد ندارد
        self.assertInvalid("C3KrF1S14.html", "بخشِ G")     # شماره‌ی بازی نیست
        self.assertInvalid("C1KrK2S1g2.html", "دو بار")    # K دو بار، F نیست
        self.assertInvalid("g5.html", "قالب")

    def test_every_book_code(self):
        for code, book in BOOKS.items():
            r = parse(f"C2-K{code}-F3-S1-G4.html")
            self.assertTrue(r.ok, code)
            self.assertEqual(r.code.book_id, f"{book.slug}-2")

    def test_case_and_leading_zeros_are_accepted_with_a_note(self):
        r = parse("c1-kR-f01-s02-g010.html")
        self.assertTrue(r.ok)
        self.assertEqual(r.code.slot, (1, 1, 2, 10, "r"))
        self.assertIn("C1-Kr-F1-S2-G10.html", r.notes[0])

    def test_round_trip_for_many_valid_names(self):
        rng = random.Random(7)
        for _ in range(500):
            name = (f"C{rng.randint(1, 6)}-K{rng.choice(list(BOOKS))}-F{rng.randint(1, 40)}"
                    f"-S{rng.randint(1, 30)}-G{rng.randint(1, 120)}.html")
            r = parse(name)
            self.assertTrue(r.ok, name)
            self.assertEqual(r.code.filename, name)

    def assertInvalid(self, name, fragment, suggestion=None):
        r = parse(name)
        self.assertFalse(r.ok, name)
        self.assertIsNone(r.code)
        self.assertTrue(any(fragment in e for e in r.errors), f"{name}: {r.errors}")
        self.assertEqual(r.suggestion, suggestion, name)

    def test_wrong_order_is_invalid_but_tells_the_right_name(self):
        self.assertInvalid("C1-F1-Kr-S2-G2.html", "ترتیب", "C1-Kr-F1-S2-G2.html")
        self.assertInvalid("Kr-C1-F1-S2-G2.html", "ترتیب", "C1-Kr-F1-S2-G2.html")
        self.assertInvalid("G2-S2-F1-Kr-C1.html", "ترتیب", "C1-Kr-F1-S2-G2.html")

    def test_separator_digits_and_extension(self):
        self.assertInvalid("C1_Kr_F1_S2_G2.html", "خط‌تیره", "C1-Kr-F1-S2-G2.html")
        self.assertInvalid("C۱-Kr-F۱-S۲-G۲.html", "انگلیسی", "C1-Kr-F1-S2-G2.html")
        self.assertInvalid("C1-Kr-F1-S2-G2.HTML", "پسوند", "C1-Kr-F1-S2-G2.html")
        self.assertInvalid("C1-Kr-F1-S2-G2.htm", "پسوند", "C1-Kr-F1-S2-G2.html")
        self.assertInvalid("C1--Kr-F1-S2-G2.html", "خط‌تیره‌ی اضافه", "C1-Kr-F1-S2-G2.html")

    def test_a_copy_never_gets_a_suggestion(self):
        # پیشنهادِ «نامِ درست» برای کپی همان جایگاهِ اصل را دوباره پر می‌کرد
        self.assertInvalid("C1-Kr-F1-S2-G2 copy.html", "فاصله", None)
        self.assertInvalid("C1-Kr-F1-S2-G2 (1).html", "فاصله", None)

    def test_incomplete_codes(self):
        self.assertInvalid("C1-Kr-F1-S2.html", "بخشِ G")
        self.assertInvalid("C1-F1-S2-G2.html", "بخشِ K")
        self.assertInvalid("Kr-F1-S2-G2.html", "بخشِ C")
        self.assertInvalid("C1-Kr-S2-G2.html", "بخشِ F")

    def test_bad_values(self):
        self.assertInvalid("C1-Kx-F1-S2-G2.html", "Kx")
        self.assertInvalid("C1-Kmath-F1-S2-G2.html", "Kmath")
        self.assertInvalid("C7-Kr-F1-S2-G2.html", "C7")
        self.assertInvalid("C0-Kr-F1-S2-G2.html", "C0")
        self.assertInvalid("C1-Kr-F0-S2-G2.html", "F0")
        self.assertInvalid("C1-Kr-F1-S0-G2.html", "S0")
        self.assertInvalid("C1-Kr-F1-S2-G0.html", "G0")
        self.assertInvalid("C1-Kr-F1-S2-G1000.html", "بزرگ")
        self.assertInvalid("C1-Kr-F1-S2-G2x.html", "G2x")
        self.assertInvalid("C1-Kr-F1-S2-G-2.html", "")

    def test_duplicate_and_extra_parts(self):
        self.assertInvalid("C1-Kr-F1-S2-G2-G3.html", "دو بار")
        self.assertInvalid("C1-Kr-F1-S2-G2-final.html", "final")

    def test_unrelated_names_get_one_clear_message(self):
        for name in ("game_6aval_riyazi.html", "01-riyazi_f1_g1.html", "index.html", "x.html"):
            r = parse(name)
            self.assertFalse(r.ok)
            self.assertEqual(len(r.errors), 1, name)
            self.assertIn("قالب", r.errors[0])


# ============================================================== مرتب‌سازی
class SortingTests(SimpleTestCase):
    def ordered(self, names):
        result = plan([gf(n) for n in names], [])
        return [e.file.name for e in result.ready]

    def test_numeric_not_lexicographic(self):
        names = ["C1-Kr-F1-S1-G10.html", "C1-Kr-F1-S1-G2.html", "C1-Kr-F1-S1-G1.html"]
        self.assertEqual(self.ordered(names),
                         ["C1-Kr-F1-S1-G1.html", "C1-Kr-F1-S1-G2.html", "C1-Kr-F1-S1-G10.html"])

    def test_week_and_chapter_are_numeric_too(self):
        names = ["C1-Kr-F10-S1-G1.html", "C1-Kr-F2-S10-G1.html", "C1-Kr-F2-S2-G1.html",
                 "C1-Kr-F1-S1-G1.html"]
        self.assertEqual(self.ordered(names), [
            "C1-Kr-F1-S1-G1.html", "C1-Kr-F2-S2-G1.html",
            "C1-Kr-F2-S10-G1.html", "C1-Kr-F10-S1-G1.html",
        ])

    def test_book_code_plays_no_part_in_order(self):
        # Kq پیش از Kr نمی‌آید چون الفبایی جلوتر است؛ فقط G ملاک است
        names = ["C1-Kr-F1-S1-G2.html", "C1-Kq-F1-S1-G3.html", "C1-Kn-F1-S1-G1.html"]
        self.assertEqual(self.ordered(names), [
            "C1-Kn-F1-S1-G1.html", "C1-Kr-F1-S1-G2.html", "C1-Kq-F1-S1-G3.html",
        ])

    def test_each_class_has_its_own_path(self):
        names = ["C2-Kr-F1-S1-G1.html", "C1-Kr-F1-S1-G2.html", "C1-Kr-F1-S1-G1.html",
                 "C2-Kr-F1-S1-G2.html"]
        result = plan([gf(n) for n in names], [])
        orders = {e.file.name: (e.code.grade, e.season_order) for e in result.ready}
        self.assertEqual(orders["C1-Kr-F1-S1-G1.html"], (1, 1))
        self.assertEqual(orders["C1-Kr-F1-S1-G2.html"], (1, 2))
        self.assertEqual(orders["C2-Kr-F1-S1-G1.html"], (2, 1))
        self.assertEqual(orders["C2-Kr-F1-S1-G2.html"], (2, 2))

    def test_order_does_not_depend_on_input_order(self):
        names = [f"C{c}-Kr-F{f}-S{s}-G{g}.html"
                 for c in (1, 2) for f in (1, 2, 11) for s in (1, 3) for g in (1, 2, 10)]
        expected = self.ordered(names)
        rng = random.Random(3)
        for _ in range(20):
            shuffled = names[:]
            rng.shuffle(shuffled)
            self.assertEqual(self.ordered(shuffled), expected)

    def test_book_order_counts_per_book(self):
        names = ["C1-Kr-F1-S1-G1.html", "C1-Kq-F1-S1-G2.html", "C1-Kr-F1-S2-G1.html"]
        result = plan([gf(n) for n in names], [])
        by_name = {e.file.name: e.book_order for e in result.ready}
        self.assertEqual(by_name, {"C1-Kr-F1-S1-G1.html": 1, "C1-Kq-F1-S1-G2.html": 1,
                                   "C1-Kr-F1-S2-G1.html": 2})


# ============================================================ برنامه‌ریز
class PlanTests(SimpleTestCase):
    def test_new_files(self):
        result = plan([gf("C1-Kr-F1-S1-G1.html"), gf("C1-Kq-F1-S1-G2.html")], [])
        self.assertEqual([e.match for e in result.entries], ["new", "new"])
        self.assertEqual([e.status for e in result.entries], [READY, READY])
        self.assertFalse(result.blocked)

    def test_unchanged_files_are_the_same_games(self):
        first = plan([gf("C1-Kr-F1-S1-G1.html"), gf("C1-Kr-F1-S1-G2.html")], [])
        again = plan([gf("C1-Kr-F1-S1-G1.html"), gf("C1-Kr-F1-S1-G2.html")], known_from(first.entries))
        self.assertEqual({e.match for e in again.entries}, {"same"})

    def test_legacy_row_without_digest_is_matched_by_path(self):
        row = Known(slug="old", path="/games/C1-Kr-F1-S1-G1.html", digest="", status=READY,
                    slot=(1, 1, 1, 1))
        result = plan([gf("C1-Kr-F1-S1-G1.html")], [row])
        self.assertEqual((result.entries[0].match, result.entries[0].slug), ("same", "old"))

    def test_rename_keeps_the_identity(self):
        a = gf("C1-Kr-F1-S1-G1.html", content="A")
        row = Known(slug="game-a", path=a.path, digest=a.digest, status=READY,
                    slot=(1, 1, 1, 1, "r"))
        moved = gf("C1-Kr-F2-S3-G4.html", content="A")
        result = plan([moved], [row])
        entry = result.entries[0]
        self.assertEqual((entry.match, entry.slug, entry.status), ("renamed", "game-a", READY))
        self.assertEqual(entry.code.slot, (1, 2, 3, 4, "r"))
        self.assertEqual(result.gone, [])

    def test_editing_in_place_keeps_the_identity(self):
        old = gf("C1-Kr-F1-S1-G1.html", content="v1")
        row = Known(slug="game-a", path=old.path, digest=old.digest, status=READY,
                    slot=(1, 1, 1, 1, "r"))
        result = plan([gf("C1-Kr-F1-S1-G1.html", content="v2")], [row])
        self.assertEqual((result.entries[0].match, result.entries[0].slug), ("edited", "game-a"))

    def test_swapping_two_names_follows_the_content(self):
        a = gf("C1-Kr-F1-S1-G1.html", content="A")
        b = gf("C1-Kr-F1-S1-G2.html", content="B")
        rows = [Known(slug="a", path=a.path, digest=a.digest, status=READY, slot=(1, 1, 1, 1, "r")),
                Known(slug="b", path=b.path, digest=b.digest, status=READY, slot=(1, 1, 1, 2, "r"))]
        result = plan([gf("C1-Kr-F1-S1-G1.html", content="B"),
                       gf("C1-Kr-F1-S1-G2.html", content="A")], rows)
        by_slug = {e.slug: e.code.number for e in result.entries}
        self.assertEqual(by_slug, {"a": 2, "b": 1})
        self.assertEqual({e.status for e in result.entries}, {READY})

    def test_inserting_a_game_between_two_others(self):
        """
        جریانِ واقعیِ «بازیِ تازه بینِ G1 و G2»: G2 و G3 یکی جلو می‌روند و
        بازیِ تازه G2 می‌شود. پیشرفتِ بچه‌ها باید با خودِ بازی‌ها جابه‌جا شود.
        """
        before = [gf(f"C1-Kr-F1-S1-G{n}.html", content=f"game-{n}") for n in (1, 2, 3)]
        first = plan(before, [])
        rows = [Known(slug=f"slug-{e.file.name}", path=e.file.path,
                      digest=e.file.digest, status=READY, slot=e.code.slot) for e in first.entries]
        slug_of = {r.path.rsplit("/", 1)[1]: r.slug for r in rows}

        after = [
            gf("C1-Kr-F1-S1-G1.html", content="game-1"),
            gf("C1-Kq-F1-S1-G2.html", content="brand-new"),
            gf("C1-Kr-F1-S1-G3.html", content="game-2"),
            gf("C1-Kr-F1-S1-G4.html", content="game-3"),
        ]
        result = plan(after, rows)
        got = {e.file.name: (e.slug, e.match, e.season_order) for e in result.entries}
        self.assertEqual(got["C1-Kr-F1-S1-G1.html"], (slug_of["C1-Kr-F1-S1-G1.html"], "same", 1))
        self.assertEqual(got["C1-Kq-F1-S1-G2.html"], (None, "new", 2))
        self.assertEqual(got["C1-Kr-F1-S1-G3.html"], (slug_of["C1-Kr-F1-S1-G2.html"], "renamed", 3))
        self.assertEqual(got["C1-Kr-F1-S1-G4.html"], (slug_of["C1-Kr-F1-S1-G3.html"], "renamed", 4))
        self.assertEqual(result.gone, [])

    def test_forgetting_to_make_room_does_not_break_the_old_game(self):
        old = gf("C1-Kr-F1-S1-G2.html", content="old")
        row = Known(slug="old", path=old.path, digest=old.digest, status=READY,
                    slot=(1, 1, 1, 2, "r"))
        # همان کتاب و همان جایگاه با فایلِ دیگر — تازه‌وارد کنار می‌رود
        result = plan([old, gf("c1kr-f1-s1-g2.html", content="new")], [row])
        status = {e.file.name: e.status for e in result.entries}
        self.assertEqual(status, {"C1-Kr-F1-S1-G2.html": READY, "c1kr-f1-s1-g2.html": CONFLICT})
        problem = next(e for e in result.entries if e.status == CONFLICT).problems[0]
        self.assertIn("C1-Kr-F1-S1-G2.html", problem)

    def test_same_number_in_two_books_is_not_a_conflict(self):
        """شماره‌ی بازی در هر کتاب جدا می‌رود؛ g1ِ ریاضی و g1ِ نگارش کنارِ هم می‌نشینند."""
        result = plan([gf("C1-Kn-F1-S1-G1.html"), gf("C1-Kr-F1-S1-G1.html"),
                       gf("C1-Kr-F1-S1-G2.html")], [])
        self.assertEqual({e.status for e in result.entries}, {READY})
        # ترتیب: شماره اول، بعد کتاب (ترتیبِ BOOKS: ریاضی پیش از نگارش)
        self.assertEqual([e.file.name for e in result.ready],
                         ["C1-Kr-F1-S1-G1.html", "C1-Kn-F1-S1-G1.html", "C1-Kr-F1-S1-G2.html"])

    def test_two_new_files_in_one_slot_are_both_held_back(self):
        result = plan([gf("C1-Kr-F1-S1-G1.html"), gf("c1krf1s1g1.html")], [])
        self.assertEqual({e.status for e in result.entries}, {CONFLICT})
        self.assertEqual(result.ready, [])

    def test_leading_zero_twin_is_a_conflict_not_a_second_game(self):
        result = plan([gf("C1-Kr-F1-S1-G2.html"), gf("C1-Kr-F1-S1-G02.html")], [])
        self.assertEqual({e.status for e in result.entries}, {CONFLICT})

    def test_invalid_files_are_never_placed(self):
        files = [gf("C1-Kr-F1-S1-G1.html"), gf("C1-F1-Kr-S1-G2.html"), gf("C1-Kr-F1-S1.html"),
                 gf("C1-Kr-F1-S1-G3 copy.html"), gf("random.html")]
        result = plan(files, [])
        self.assertEqual([e.file.name for e in result.ready], ["C1-Kr-F1-S1-G1.html"])
        self.assertEqual(len(result.by_status(INVALID)), 4)
        wrong_order = next(e for e in result.entries if e.file.name == "C1-F1-Kr-S1-G2.html")
        self.assertIn("نامِ درست: C1-Kr-F1-S1-G2.html", wrong_order.problems)
        for entry in result.by_status(INVALID):
            self.assertEqual(entry.season_order, 0)
            self.assertIsNone(entry.code)

    def test_fixing_an_invalid_name_keeps_the_same_row(self):
        bad = gf("C1-F1-Kr-S1-G1.html", content="X")
        first = plan([bad], [])
        rows = [Known(slug="x", path=bad.path, digest=bad.digest, status=INVALID)]
        result = plan([gf("C1-Kr-F1-S1-G1.html", content="X")], rows)
        entry = result.entries[0]
        self.assertEqual((entry.slug, entry.match, entry.status), ("x", "renamed", READY))
        self.assertEqual(first.entries[0].status, INVALID)

    def test_a_copy_of_a_live_game_does_not_steal_its_identity(self):
        live = gf("C1-Kr-F1-S1-G1.html", content="same")
        row = Known(slug="live", path=live.path, digest=live.digest, status=READY, slot=(1, 1, 1, 1))
        result = plan([live, gf("C1-Kr-F1-S1-G1 copy.html", content="same")], [row])
        by_name = {e.file.name: (e.slug, e.status) for e in result.entries}
        self.assertEqual(by_name["C1-Kr-F1-S1-G1.html"], ("live", READY))
        self.assertEqual(by_name["C1-Kr-F1-S1-G1 copy.html"], (None, INVALID))
        self.assertTrue(any("محتوای یکسان" in w for w in result.warnings))

    def test_deleted_file(self):
        row = Known(slug="gone", path="/games/C1-Kr-F1-S1-G9.html", digest="d", status=READY,
                    slot=(1, 1, 1, 9))
        result = plan([gf("C1-Kr-F1-S1-G1.html")], [row])
        self.assertEqual([k.slug for k in result.removed], ["gone"])

    def test_a_new_game_at_a_deleted_path_is_a_new_game(self):
        # تکمیل‌های بازیِ پاک‌شده نباید به بازیِ تازه‌ای که جایش نشسته برسد
        row = Known(slug="old", path="/games/C1-Kr-F1-S1-G1.html", digest="old-content",
                    status=MISSING, referenced=True)
        result = plan([gf("C1-Kr-F1-S1-G1.html", content="different")], [row])
        self.assertEqual((result.entries[0].match, result.entries[0].slug), ("new", None))

    def test_a_restored_file_revives_its_game(self):
        back = gf("C1-Kr-F1-S1-G1.html", content="restored")
        row = Known(slug="old", path="/games/C1-Kr-F1-S1-G7.html", digest=back.digest,
                    status=MISSING, referenced=True)
        result = plan([back], [row])
        self.assertEqual((result.entries[0].slug, result.entries[0].status), ("old", READY))

    def test_mass_removal_is_blocked(self):
        rows = [Known(slug=f"g{n}", path=f"/games/C1-Kr-F1-S1-G{n}.html", digest=f"d{n}",
                      status=READY, slot=(1, 1, 1, n)) for n in range(1, 11)]
        keep = [gf(f"C1-Kr-F1-S1-G{n}.html", content=f"x{n}") for n in (1, 2, 3)]
        # سه فایل با محتوای تازه در همان مسیر («ویرایش»)؛ هفت‌تای دیگر ناپدید
        result = plan(keep, rows)
        self.assertEqual(len(result.removed), 7)
        self.assertIn("ناپدید", result.blocked)
        self.assertFalse(plan(keep, rows, allow_mass_removal=True).blocked)

    def test_removing_a_few_games_is_fine(self):
        rows = [Known(slug=f"g{n}", path=f"/games/C1-Kr-F1-S1-G{n}.html", digest=f"d{n}",
                      status=READY, slot=(1, 1, 1, n)) for n in range(1, 5)]
        keep = [gf(f"C1-Kr-F1-S1-G{n}.html", content=f"x{n}") for n in (1, 2, 3)]
        self.assertFalse(plan(keep, rows).blocked)

    def test_no_files_at_all_is_blocked(self):
        self.assertTrue(plan([], []).blocked)

    def test_adding_games_never_disturbs_existing_ones(self):
        """خاصیتِ اصلی: فایلِ تازه (هر جا) شناسه و ترتیبِ نسبیِ بقیه را عوض نمی‌کند."""
        rng = random.Random(11)
        for _ in range(40):
            slots = rng.sample([(c, f, s, g) for c in (1, 2) for f in (1, 2, 12)
                                for s in (1, 2, 3) for g in range(1, 8)], 25)
            names = [f"C{c}-K{rng.choice(list(BOOKS))}-F{f}-S{s}-G{g}.html" for c, f, s, g in slots]
            existing, extra = names[:18], names[18:]
            first = plan([gf(n) for n in existing], [])
            rows = [Known(slug=f"id-{i}", path=e.file.path, digest=e.file.digest,
                          status=e.status, slot=e.code.slot) for i, e in enumerate(first.entries)]
            second = plan([gf(n) for n in existing + extra], rows)
            old = [e for e in second.entries if e.slug]
            self.assertEqual({e.match for e in old}, {"same"})
            self.assertEqual({e.status for e in old}, {READY})
            for grade in (1, 2):
                before = [e.slug for e in sorted(
                    (x for x in second.entries if x.slug and x.code.grade == grade),
                    key=lambda x: x.season_order)]
                expected = [r.slug for r in sorted(
                    (r for r in rows if r.slot[0] == grade), key=lambda r: r.slot)]
                self.assertEqual(before, expected)


class WarningTests(SimpleTestCase):
    def warnings(self, names, **kw):
        return plan([gf(n, **kw) for n in names], []).warnings

    def test_gaps_in_numbers(self):
        w = self.warnings(["C1-Kr-F1-S1-G1.html", "C1-Kr-F1-S1-G4.html", "C1-Kr-F1-S3-G1.html"])
        self.assertTrue(any("G2، G3" in x for x in w), w)
        self.assertTrue(any("S2" in x for x in w), w)

    def test_a_week_without_a_book_of_its_class(self):
        w = self.warnings(["C1-Kr-F1-S1-G1.html", "C1-Kq-F1-S1-G2.html", "C1-Kr-F1-S2-G1.html"])
        self.assertTrue(any("C1-F1-S2" in x and "Kq" in x for x in w), w)
        self.assertFalse(any("C1-F1-S1" in x and "بازی ندارد" in x for x in w), w)

    def test_a_single_book_class_is_not_nagged(self):
        w = self.warnings(["C2-Kr-F1-S1-G1.html", "C2-Kr-F1-S2-G1.html"])
        self.assertFalse(any("بازی ندارد" in x for x in w), w)

    def test_titles_that_give_away_the_lesson(self):
        w = plan([gf("C1-Kr-F1-S1-G1.html", title="مزرعه‌ی ریاضی"),
                  gf("C1-Kr-F1-S1-G2.html", title="جزیره‌ی حیوانات")], []).warnings
        self.assertTrue(any("ریاضی" in x for x in w), w)
        self.assertFalse(any("حیوانات" in x for x in w), w)

    def test_missing_title(self):
        w = plan([gf("C1-Kr-F1-S1-G1.html", title="")], []).warnings
        self.assertTrue(any("<title>" in x for x in w), w)

    def test_non_standard_spelling(self):
        # حروفِ کوچک و نامِ فشرده عادی‌اند؛ صفرِ اول ولی یادآوری می‌شود
        self.assertEqual(self.warnings(["c1kr-f1-s1-g1.html"]), [])
        w = self.warnings(["C1-Kr-F1-S1-G01.html"])
        self.assertTrue(any("C1-Kr-F1-S1-G1.html" in x for x in w), w)


class TitleTests(SimpleTestCase):
    def test_real_titles(self):
        cases = {
            "جزیره جادویی - ماجراجویی پیکسل": "جزیره جادویی",
            "سفر ریتم - LOKO UI": "سفر ریتم",
            "آموزش اعداد فارسی 🌟": "آموزش اعداد فارسی",
            "🎮 بازی اعداد لوکو": "اعداد لوکو",
            "بازی هیولاهای گرسنه": "هیولاهای گرسنه",
            "بالون‌های پروازی | لوکو": "بالون‌های پروازی",
            "نعمت‌یاب | LOKO System": "نعمت‌یاب",
            "کارخانه خوراکی‌ها - علوم پایه اول": "کارخانه خوراکی‌ها",
            "مأموریت مدار — ریاضی ششم": "مأموریت مدار",
            "LUKO — معماری مرجعِ بازی": "معماری مرجعِ بازی",
            "  چوب‌کبریت‌های آشپزخانه  ": "چوب‌کبریت‌های آشپزخانه",
            "قطار &amp; ستاره": "قطار & ستاره",
            "LOKO": "",
        }
        for raw, expected in cases.items():
            self.assertEqual(clean_title(raw), expected, raw)

    def test_zwnj_survives(self):
        self.assertIn("‌", clean_title("نعمت‌یاب"))


# ================================================================= دیسک
class ScanTests(SimpleTestCase):
    def test_scan_rules(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "assets").mkdir()
            (root / "_reference").mkdir()
            (root / ".hidden").mkdir()
            (root / "c2").mkdir()
            (root / "C1-Kr-F1-S1-G1.html").write_text("<title>یک</title>", encoding="utf-8")
            (root / "c2" / "C2-Kr-F1-S1-G1.html").write_text("<TITLE>دو</TITLE>", encoding="utf-8")
            (root / "C1-Kr-F1-S1-G2.HTML").write_text("x")
            (root / "README.md").write_text("x")
            (root / "assets" / "page.html").write_text("x")
            (root / "_reference" / "base.html").write_text("x")
            (root / ".hidden" / "x.html").write_text("x")
            files = scan(root)
        self.assertEqual([f.path for f in files], [
            "/games/C1-Kr-F1-S1-G1.html",
            "/games/C1-Kr-F1-S1-G2.HTML",
            "/games/c2/C2-Kr-F1-S1-G1.html",
        ])
        self.assertEqual([f.title for f in files], ["یک", "", "دو"])
        self.assertFalse(files[1].parsed.ok)
        self.assertEqual(files[0].digest, hashlib.sha256("<title>یک</title>".encode()).hexdigest())


# ======================================================== همگام‌سازی (DB)
class SyncTestBase(TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        django_cache.delete(registry.LOCK_KEY)

    def tearDown(self):
        self.tmp.cleanup()

    def put(self, name, content=None, title="بازی"):
        (self.root / name).write_text(content or f"<title>{title}</title><!-- {name} -->",
                                      encoding="utf-8")

    def rename(self, old, new):
        (self.root / old).rename(self.root / new)

    def sync(self, **kw):
        return registry.sync(self.root, **kw)

    def game(self, name) -> Game:
        return Game.objects.get(game_file=f"/games/{name}")


class SyncTests(SyncTestBase):
    def test_first_sync_builds_the_catalog(self):
        self.put("C1-Kr-F1-S1-G1.html", title="اولی")
        self.put("C1-Kq-F1-S1-G2.html", title="دومی")
        self.put("C2-Kh-F1-S1-G1.html", title="هنری")
        self.put("bad-name.html")
        self.sync()
        a, b, c = (self.game(n) for n in ("C1-Kr-F1-S1-G1.html", "C1-Kq-F1-S1-G2.html",
                                          "C2-Kh-F1-S1-G1.html"))
        self.assertEqual((a.title, a.season_order, a.book_id, a.code), ("اولی", 1, "math-1",
                                                                          "C1-Kr-F1-S1-G1"))
        self.assertEqual((b.season_order, b.book_id), (2, "quran-1"))
        self.assertEqual((c.grade, c.season_order, c.book_id), (2, 1, "art-2"))
        self.assertTrue(a.slug.startswith("g-") and "math" not in a.slug)
        bad = self.game("bad-name.html")
        self.assertEqual((bad.status, bad.season_order), (Game.Status.INVALID, 0))
        self.assertIn("قالب", bad.review_note)
        # کتابِ تازه خودکار ساخته می‌شود
        self.assertEqual(Book.objects.get(book_id="art-2").title, "هنر دوم")

    def test_second_sync_changes_nothing(self):
        self.put("C1-Kr-F1-S1-G1.html")
        self.put("C1-Kr-F1-S1-G2.html")
        self.sync()
        before = list(Game.objects.values_list("slug", "updated_at", "season_order"))
        result = self.sync()
        self.assertEqual({e.match for e in result.entries}, {"same"})
        self.assertEqual(list(Game.objects.values_list("slug", "updated_at", "season_order")), before)

    def test_admin_fields_survive_a_sync(self):
        self.put("C1-Kr-F1-S1-G1.html", title="از فایل")
        self.sync()
        Game.objects.update(title="عنوانِ ادمین", coin_reward=25, is_active=False, max_stars=2)
        self.put("C1-Kr-F1-S1-G1.html", title="عنوانِ تازه‌ی فایل")   # ویرایشِ فایل
        self.sync()
        game = self.game("C1-Kr-F1-S1-G1.html")
        self.assertEqual((game.title, game.coin_reward, game.is_active, game.max_stars),
                         ("عنوانِ ادمین", 25, False, 2))

    def test_progress_follows_a_renamed_game(self):
        user = User.objects.create(phone="09121117001", role=User.Role.STUDENT)
        self.put("C1-Kr-F1-S1-G1.html", content="<title>A</title>A")
        self.put("C1-Kr-F1-S1-G2.html", content="<title>B</title>B")
        self.sync()
        slug_b = self.game("C1-Kr-F1-S1-G2.html").slug
        GameCompletion.objects.create(user=user, game_slug=slug_b, stars=3)

        # جا برای بازیِ تازه: B می‌شود G3
        self.rename("C1-Kr-F1-S1-G2.html", "C1-Kr-F1-S1-G3.html")
        self.put("C1-Kn-F1-S1-G2.html", content="<title>N</title>N")
        self.sync()

        moved = self.game("C1-Kr-F1-S1-G3.html")
        self.assertEqual((moved.slug, moved.season_order, moved.number), (slug_b, 3, 3))
        fresh = self.game("C1-Kn-F1-S1-G2.html")
        self.assertNotEqual(fresh.slug, slug_b)
        self.assertEqual(fresh.season_order, 2)
        self.assertEqual(GameCompletion.objects.get(user=user).game_slug, slug_b)

    def test_deleted_files(self):
        user = User.objects.create(phone="09121117002", role=User.Role.STUDENT)
        for n in (1, 2, 3, 4):
            self.put(f"C1-Kr-F1-S1-G{n}.html")
        self.sync()
        played = self.game("C1-Kr-F1-S1-G3.html").slug
        GameCompletion.objects.create(user=user, game_slug=played)
        (self.root / "C1-Kr-F1-S1-G3.html").unlink()
        (self.root / "C1-Kr-F1-S1-G4.html").unlink()
        self.sync()
        # تاریخچه دارد → «حذف‌شده» می‌ماند؛ بی‌تاریخچه → پاک می‌شود
        kept = Game.objects.get(slug=played)
        self.assertEqual((kept.status, kept.season_order), (Game.Status.MISSING, 0))
        self.assertFalse(Game.objects.filter(game_file="/games/C1-Kr-F1-S1-G4.html").exists())

    def test_invalid_row_without_history_disappears_with_its_file(self):
        self.put("C1-Kr-F1-S1-G1.html")
        self.put("C1-Kr-F1-S1-G1 copy.html", content="<title>x</title>other")
        self.sync()
        self.assertEqual(Game.objects.filter(status=Game.Status.INVALID).count(), 1)
        (self.root / "C1-Kr-F1-S1-G1 copy.html").unlink()
        self.sync()
        self.assertFalse(Game.objects.filter(status=Game.Status.INVALID).exists())

    def test_conflict_is_stored_with_a_reason(self):
        self.put("C1-Kr-F1-S1-G1.html")
        self.sync()
        self.put("C1KrF1S1g1.html", content="<title>q</title>q")
        self.sync()
        newcomer = self.game("C1KrF1S1g1.html")
        self.assertEqual(newcomer.status, Game.Status.CONFLICT)
        self.assertIn("C1-Kr-F1-S1-G1.html", newcomer.review_note)
        self.assertEqual(self.game("C1-Kr-F1-S1-G1.html").status, Game.Status.READY)

    def test_missing_folder_is_an_error_not_a_wipe(self):
        self.put("C1-Kr-F1-S1-G1.html")
        self.sync()
        with self.assertRaises(FileNotFoundError):
            registry.sync(self.root / "nope")
        self.assertEqual(Game.objects.playable().count(), 1)

    def test_blocked_sync_leaves_the_database_alone(self):
        for n in range(1, 7):
            self.put(f"C1-Kr-F1-S1-G{n}.html")
        self.sync()
        for n in range(2, 7):
            (self.root / f"C1-Kr-F1-S1-G{n}.html").unlink()
        result = self.sync()
        self.assertTrue(result.blocked)
        self.assertEqual(Game.objects.playable().count(), 6)
        self.sync(allow_mass_removal=True)
        self.assertEqual(Game.objects.playable().count(), 1)

    def test_only_one_sync_at_a_time(self):
        self.put("C1-Kr-F1-S1-G1.html")
        django_cache.add(registry.LOCK_KEY, 1, 60)
        try:
            with self.assertRaises(registry.SyncBusy):
                self.sync()
        finally:
            django_cache.delete(registry.LOCK_KEY)

    def test_dry_run_writes_nothing(self):
        self.put("C1-Kr-F1-S1-G1.html")
        self.sync(dry_run=True)
        self.assertFalse(Game.objects.exists())

    def test_command(self):
        from io import StringIO
        self.put("C1-Kr-F1-S1-G1.html", title="اولی")
        self.put("C1-F1-Kr-S1-G2.html")
        out = StringIO()
        call_command("sync_games", "--check", "--dir", str(self.root), stdout=out)
        self.assertIn("C1-Kr-F1-S1-G1", out.getvalue())
        self.assertIn("نامِ درست: C1-Kr-F1-S1-G2.html", out.getvalue())
        self.assertFalse(Game.objects.exists())
        call_command("sync_games", "--dir", str(self.root), stdout=StringIO())
        self.assertEqual(Game.objects.playable().count(), 1)
        with self.assertRaises(CommandError):
            call_command("sync_games", "--dir", str(self.root / "nope"), stdout=StringIO())


# ================================================================= API
class PathApiTests(SyncTestBase):
    def setUp(self):
        super().setUp()
        for name, title in [
            ("C1-Kr-F1-S1-G1.html", "یک"), ("C1-Kq-F1-S1-G2.html", "دو"),
            ("C1-Kn-F1-S2-G1.html", "سه"), ("C1-Kr-F2-S1-G10.html", "پنج"),
            ("C1-Kr-F2-S1-G2.html", "چهار"), ("C2-Kr-F1-S1-G1.html", "دومی-یک"),
            ("C2-Kr-F1-S1-G2.html", "دومی-دو"), ("C1-F1-Kr-S9-G1.html", "غلط"),
        ]:
            self.put(name, title=title)
        self.sync()
        self.api = APIClient()

    def path(self, **params):
        res = self.api.get("/api/v1/games/path", params)
        return res

    def test_path_is_game_first(self):
        res = self.path(grade=1)
        self.assertEqual(res.status_code, 200)
        stages = res.json()["data"]["stages"]
        self.assertEqual([s["title"] for s in stages], ["یک", "دو", "سه", "چهار", "پنج"])
        self.assertEqual([s["order"] for s in stages], [1, 2, 3, 4, 5])
        self.assertEqual([s["week"] for s in stages], [1, 1, 2, 3, 3])
        for stage in stages:
            self.assertEqual(set(stage), {"id", "title", "order", "week", "coinReward", "maxStars"})
        # هیچ ردی از کتاب، درس یا کد در پاسخ نیست
        raw = res.content.decode()
        for leak in ("math", "quran", "writing", "book", "subject", "Kr", "C1-", "ریاضی", "قرآن"):
            self.assertNotIn(leak, raw)

    def test_each_class_sees_only_its_own_games(self):
        stages = self.path(grade=2).json()["data"]["stages"]
        self.assertEqual([s["title"] for s in stages], ["دومی-یک", "دومی-دو"])
        self.assertEqual(self.path(grade=3).json()["data"]["stages"], [])

    def test_grade_defaults_to_the_student(self):
        kid = User.objects.create(phone="09121117003", role=User.Role.STUDENT, grade=2)
        self.api.force_authenticate(kid)
        self.assertEqual(self.api.get("/api/v1/games/path").json()["data"]["grade"], 2)

    def test_open_grades_lists_each_class_once(self):
        res = self.api.get("/api/v1/games/grades")
        self.assertEqual(res.json()["data"]["grades"], [1, 2])

    def test_bad_grade(self):
        self.assertEqual(self.path(grade=9).status_code, 400)
        self.assertEqual(self.path(grade="x").status_code, 400)

    def test_a_new_file_shows_up_right_after_sync(self):
        self.assertEqual(len(self.path(grade=2).json()["data"]["stages"]), 2)
        self.put("C2-Kq-F1-S1-G3.html", title="تازه")
        self.sync()
        self.assertEqual(len(self.path(grade=2).json()["data"]["stages"]), 3)

    def test_admin_edits_show_up_immediately(self):
        self.path(grade=1)                       # کش پر شود
        game = Game.objects.get(title="دو")
        game.is_active = False
        game.save()
        titles = [s["title"] for s in self.path(grade=1).json()["data"]["stages"]]
        self.assertNotIn("دو", titles)


class PerClassRulesTests(SyncTestBase):
    def setUp(self):
        super().setUp()
        for name in ("C1-Kr-F1-S1-G1.html", "C1-Kr-F1-S1-G2.html",
                     "C2-Kr-F1-S1-G1.html", "C2-Kr-F1-S1-G2.html", "C1-F1-Kr-S1-G3.html"):
            self.put(name, content=f"<title>{name}</title>{name}")
        self.sync()
        self.slug = {n: self.game(n).slug for n in (
            "C1-Kr-F1-S1-G1.html", "C1-Kr-F1-S1-G2.html", "C2-Kr-F1-S1-G1.html",
            "C2-Kr-F1-S1-G2.html", "C1-F1-Kr-S1-G3.html")}
        self.kid = User.objects.create(phone="09121117004", role=User.Role.STUDENT, grade=2)
        Profile.objects.get_or_create(user=self.kid)
        self.api = APIClient()

    def complete(self, name):
        return self.api.post(f"/api/v1/games/{self.slug[name]}/complete", {}, format="json")

    def test_classes_do_not_block_each_other(self):
        self.api.force_authenticate(self.kid)
        # مرحله‌ی اولِ کلاسِ دوم پشتِ کلاسِ اول نمی‌ماند
        self.assertEqual(self.complete("C2-Kr-F1-S1-G1.html").status_code, 200)
        self.assertEqual(self.complete("C2-Kr-F1-S1-G2.html").status_code, 200)
        # ولی درونِ هر کلاس ترتیب سرِ جایش است
        self.assertEqual(self.complete("C1-Kr-F1-S1-G2.html").status_code, 403)

    def test_guests_get_the_first_stage_of_every_class(self):
        link = lambda n: self.api.get(f"/api/v1/games/{self.slug[n]}/play-link").status_code
        self.assertEqual(link("C1-Kr-F1-S1-G1.html"), 200)
        self.assertEqual(link("C2-Kr-F1-S1-G1.html"), 200)
        self.assertEqual(link("C2-Kr-F1-S1-G2.html"), 401)

    def test_off_path_games_give_nothing(self):
        self.api.force_authenticate(self.kid)
        coins = Profile.objects.get(user=self.kid).coins
        for slug in ("made-up-slug", self.slug["C1-F1-Kr-S1-G3.html"]):
            res = self.api.post(f"/api/v1/games/{slug}/complete", {}, format="json")
            self.assertEqual(res.status_code, 404)
            self.assertEqual(self.api.get(f"/api/v1/games/{slug}/play-link").status_code, 404)
        self.assertEqual(Profile.objects.get(user=self.kid).coins, coins)
        self.assertFalse(GameCompletion.objects.filter(user=self.kid).exists())


# ============================================================ مهاجرت
LEGACY_MIGRATION = importlib.import_module("apps.games.migrations.0008_legacy_games_to_codes")


class LegacyMigrationTests(TestCase):
    """
    ۲۷ بازیِ قدیمی: شناسه‌ی تازه، جایگاهِ تازه، و تاریخچه‌ی دست‌نخورده.
    آخرین تست ثابت می‌کند مهاجرت و همگام‌سازی دقیقاً یک چیز می‌گویند.
    """

    def setUp(self):
        for position, (old, old_file, _) in enumerate(
            sorted(LEGACY_MIGRATION.LEGACY, key=lambda item: item[1].split("/")[1]), start=1
        ):
            Game.objects.create(slug=old, title=old, book_id=old.rsplit("-", 1)[0],
                                order=int(old.rsplit("-", 1)[1]), season_order=position,
                                game_file=f"/games/grade-1/{old_file}")
        self.kid = User.objects.create(phone="09121117005", role=User.Role.STUDENT)
        parent = User.objects.create(phone="09121117006", role=User.Role.PARENT)
        for old in ("math-1-1", "math-1-2", "quran-1-1"):
            GameCompletion.objects.create(user=self.kid, game_slug=old, stars=2)
            GameEvent.objects.create(user=self.kid, game_slug=old, event_type="answer")
        DailyAssignment.objects.create(child=self.kid, assigned_by=parent, game_slug="science-1-1",
                                       date="2026-09-20")

    def migrate(self):
        LEGACY_MIGRATION.forwards(django_apps, None)

    def test_rows_move_to_the_new_names(self):
        self.migrate()
        self.assertFalse(Game.objects.filter(slug__contains="-1-").exists())
        first = Game.objects.get(season_order=1)
        self.assertEqual((first.game_file, first.code, first.status),
                         ("/games/C1-Kr-F1-S1-G1.html", "C1-Kr-F1-S1-G1", "ready"))
        self.assertEqual(first.title, "math-1-1")          # عنوان دست نمی‌خورد
        orders = list(Game.objects.order_by("season_order").values_list("season_order", flat=True))
        self.assertEqual(orders, list(range(1, 28)))
        science = Game.objects.get(book_id="science-1")
        self.assertEqual((science.code, science.season_order), ("C1-Ko-F3-S1-G2", 24))

    def test_history_moves_with_the_games(self):
        self.migrate()
        new = LEGACY_MIGRATION.new_slug
        self.assertEqual(set(GameCompletion.objects.values_list("game_slug", flat=True)),
                         {new("math-1-1"), new("math-1-2"), new("quran-1-1")})
        self.assertEqual(set(GameEvent.objects.values_list("game_slug", flat=True)),
                         {new("math-1-1"), new("math-1-2"), new("quran-1-1")})
        self.assertEqual(DailyAssignment.objects.get().game_slug, new("science-1-1"))
        slugs = set(Game.objects.values_list("slug", flat=True))
        self.assertTrue(set(GameCompletion.objects.values_list("game_slug", flat=True)) <= slugs)

    def test_migration_can_be_reversed(self):
        self.migrate()
        LEGACY_MIGRATION.backwards(django_apps, None)
        self.assertEqual(Game.objects.get(slug="math-1-5").game_file,
                         "/games/grade-1/math/05-riyazi_f1_g5.html")
        self.assertEqual(Game.objects.get(slug="quran-1-1").season_order, 24)
        self.assertEqual(GameCompletion.objects.filter(game_slug="math-1-1").count(), 1)

    def test_empty_database_is_a_no_op(self):
        Game.objects.all().delete()
        self.migrate()
        self.assertFalse(Game.objects.exists())

    def test_migration_and_sync_agree(self):
        """
        مهاجرت و همگام‌سازی باید یک چیز بگویند: ردیف‌هایی که مهاجرت جابه‌جا
        کرده، با اسکنِ همان فایل‌ها دقیقاً همان‌جا بنشینند.

        پوشه این‌جا ساختگی است تا تست به محتوای واقعیِ پروژه وابسته نباشد؛
        با هر بازیِ تازه‌ای که تیمِ محتوا اضافه کند، ترتیبِ واقعی عوض می‌شود.
        """
        self.migrate()
        before = dict(Game.objects.values_list("slug", "season_order"))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for _, _, name in LEGACY_MIGRATION.LEGACY:
                (root / name).write_text(f"<title>{name}</title>", encoding="utf-8")
            result = registry.sync(root)
        legacy = [e for e in result.entries if e.slug in before]
        self.assertEqual(len(legacy), 27)
        self.assertEqual({e.match for e in legacy}, {"same"})
        self.assertEqual(dict(Game.objects.filter(slug__in=before)
                              .values_list("slug", "season_order")), before)
        self.assertEqual(Game.objects.exclude(content_hash="").filter(slug__in=before).count(), 27)


class StatusValuesTests(SimpleTestCase):
    def test_registry_and_model_agree(self):
        self.assertEqual({READY, INVALID, CONFLICT, MISSING}, set(Game.Status.values))


# ============================================================ پنلِ ادمین
class RegistryAdminTests(SyncTestBase):
    """صفحه‌ی «همگام‌سازی با فایل‌ها»: پیش‌نمایش تغییری نمی‌دهد، دکمه اعمال می‌کند."""

    def setUp(self):
        super().setUp()
        from apps.common.tests_admin import BROKEN_TEMPLATES, SKIP_WHY
        if BROKEN_TEMPLATES:
            self.skipTest(SKIP_WHY)
        boss = User.objects.create(phone="09120000778", role=User.Role.TEAM_ADMIN,
                                   is_staff=True, is_superuser=True)
        self.client.force_login(boss)
        self.put("C1-Kr-F1-S1-G1.html", title="اولی")
        self.put("C1-F1-Kr-S1-G2.html", title="غلط")

    def url(self, name, *args):
        from django.urls import reverse
        return reverse(f"admin:games_game_{name}", args=args)

    def test_sync_button_on_the_list(self):
        with self.settings(GAME_FILES_DIR=self.root):
            body = self.client.get(self.url("changelist")).content.decode()
        self.assertIn(self.url("sync"), body)
        self.assertIn("همگام‌سازی با فایل‌ها", body)

    def test_preview_then_apply(self):
        with self.settings(GAME_FILES_DIR=self.root):
            preview = self.client.get(self.url("sync"))
            self.assertEqual(preview.status_code, 200)
            self.assertIn("C1-Kr-F1-S1-G1", preview.content.decode())
            self.assertIn("نامِ درست: C1-Kr-F1-S1-G2.html", preview.content.decode())
            self.assertFalse(Game.objects.exists())

            applied = self.client.post(self.url("sync"))
            self.assertEqual(applied.status_code, 200)
            self.assertIn("اعمال شد", applied.content.decode())
        self.assertEqual(Game.objects.playable().count(), 1)
        self.assertEqual(Game.objects.filter(status=Game.Status.INVALID).count(), 1)

    def test_list_and_detail_render_every_status(self):
        with self.settings(GAME_FILES_DIR=self.root):
            self.client.post(self.url("sync"))
        (self.root / "C1-Kr-F1-S1-G1.html").unlink()
        self.put("C1-Kq-F1-S1-G3.html")
        self.put("C1-Kr-F1-S1-G3.html", content="<title>x</title>other")
        Game.objects.update(title="مزرعه‌ی ریاضی")
        with self.settings(GAME_FILES_DIR=self.root):
            registry.sync(self.root, allow_mass_removal=True)
        body = self.client.get(self.url("changelist")).content.decode()
        self.assertIn("درس را لو می‌دهد", body)
        for game in Game.objects.all():
            with self.subTest(status=game.status):
                self.assertEqual(self.client.get(self.url("change", game.pk)).status_code, 200)

    def test_a_game_on_the_path_cannot_be_deleted(self):
        with self.settings(GAME_FILES_DIR=self.root):
            self.client.post(self.url("sync"))
        ready = Game.objects.get(status=Game.Status.READY)
        invalid = Game.objects.get(status=Game.Status.INVALID)
        self.assertEqual(self.client.get(self.url("delete", ready.pk)).status_code, 403)
        self.assertEqual(self.client.get(self.url("delete", invalid.pk)).status_code, 200)

    def test_missing_folder_is_reported_not_crashed(self):
        with self.settings(GAME_FILES_DIR=self.root / "nope"):
            res = self.client.get(self.url("sync"))
        self.assertEqual(res.status_code, 200)
        self.assertIn("پیدا نشد", res.content.decode())
