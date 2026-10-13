"""ابزارهای متنی و پذیرشِ خروجیِ مدل — بی‌پایگاه‌داده."""
from django.test import SimpleTestCase

from apps.ai.prompts import assistant_prompt, insight_prompt, insight_sections
from apps.ai.text import clean, collect_numbers, extract_json
from apps.ai.validate import Rejected, check_text, clean_reply, validate_bundle, word_numbers

FACTS = {
    "plan": "free", "period": "۱۶ تا ۲۲ مهر", "played_this_week": True,
    "week": {"active_days_of_7": 4, "minutes": 28, "previous_week_minutes": 8, "answers": 50, "accuracy_percent": 44},
    "concepts_last_8_weeks": [{"name": "شمارش", "accuracy_percent": 31, "answers": 36}],
    "locked_subjects": ["علوم", "قرآن"],
    "mood_this_week": {"verdict": "خوب", "checkins": 6, "moods": {"آرام": 4, "خسته": 2}},
}
SECTIONS = ["weekly", "analysis", "tips", "health"]

GOOD = {
    "weekly": {"title": "هفته‌ای پرتلاش برای [نام]",
               "body": "[نام] این هفته در ۴ روز از ۷ روز بازی کرد و ۲۸ دقیقه با لوکو یاد گرفت؛ هفته‌ی پیش ۸ دقیقه بود."},
    "analysis": {
        "headline": "زمانِ بازی بیشتر شد، شمارش تمرین می‌خواهد",
        "narrative": "این هفته ۵۰ پاسخ ثبت شد و دقتِ کلی ۴۴٪ بود. در «شمارش» دقت ۳۱٪ است و تمرینِ بیشتری لازم دارد.",
        "findings": [
            {"tone": "good", "title": "زمانِ بیشتر", "body": "زمانِ بازی از ۸ دقیقه به ۲۸ دقیقه رسید."},
            {"tone": "watch", "title": "شمارش", "body": "در «شمارش» از ۳۶ پاسخ، دقت ۳۱٪ بوده است."},
            {"tone": "oops", "title": "تونِ ناشناخته", "body": "این یافته با تونِ پیش‌فرض پذیرفته می‌شود."},
        ],
        "action": {"title": "روزی ۱۰ دقیقه شمارش", "body": "با قاشق‌ها و دکمه‌های خانه روزی ۱۰ دقیقه بشمارید."},
    },
    "tips": [
        {"kind": "practice", "title": "شمارش با وسایلِ خانه", "body": "روزی ۱۰ دقیقه با هم قاشق‌ها را بشمارید."},
        {"kind": "weird", "title": "یک زمانِ ثابت", "body": "هر روز در یک ساعتِ ثابت بازی کند تا عادت شود."},
    ],
    "health": {"title": "هفته‌ای آرام", "body": "[نام] ۶ بار حالش را ثبت کرد و بیشتر آرام بود.",
               "tips": [{"kind": "together", "title": "گفت‌وگوی شبانه", "body": "پیش از خواب درباره‌ی روزش بپرسید."}]},
}


class TextTests(SimpleTestCase):
    def test_extract_json_from_fenced_or_chatty_output(self):
        self.assertEqual(extract_json('```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(extract_json('بفرمایید:\n{"a": {"b": 2}}\nموفق باشید'), {"a": {"b": 2}})
        self.assertIsNone(extract_json("پاسخ بی‌JSON"))
        self.assertIsNone(extract_json('{"a": '))
        self.assertIsNone(extract_json("[1, 2]"))

    def test_clean_normalizes_persian_digits_markdown_and_emoji(self):
        self.assertEqual(clean("## **عالي** بود 😊 دقت 85%"), "عالی بود دقت ۸۵٪")
        self.assertEqual(clean("كتاب"), "کتاب")

    def test_numbers_of_the_facts_are_allowed(self):
        numbers = collect_numbers(FACTS)
        self.assertTrue({"28", "8", "44", "31", "16", "22"} <= numbers)
        self.assertNotIn("True", numbers)

    def test_word_numbers(self):
        found = word_numbers("روزِ پنج‌شنبه شش روز بازی کرد، دقت شصت‌وپنج درصد، یک بازی و نه بیشتر، نوزده دقیقه")
        self.assertEqual(found, [(6, False), (65, True), (19, False)])


class CheckTextTests(SimpleTestCase):
    allowed = {"28", "44", "6"}

    def check(self, text, **kw):
        return check_text(text, max_len=200, allowed=self.allowed, locked=["علوم"], **kw)

    def test_real_numbers_pass(self):
        self.assertEqual(self.check("[نام] ۲۸ دقیقه بازی کرد و دقتش ۴۴٪ بود."), "[نام] ۲۸ دقیقه بازی کرد و دقتش ۴۴٪ بود.")

    def test_fabrications_are_rejected(self):
        for text, reason in [
            ("دقتش ۹۰٪ بود.", "percent:90"),
            ("۳۵ دقیقه بازی کرد.", "number:35"),
            ("نوزده دقیقه بازی کرد.", "number-word:19"),
            ("دقتش هفتاد درصد بود.", "number-word:70"),
            ("در علوم خوب بود.", "locked:علوم"),
            ("He played well امروز", "latin"),
            ("۲۸ دقیقه... یعنی", "ellipsis"),
            ("[نام] و [نام] و [نام]", "name-repeated"),
        ]:
            with self.subTest(text=text), self.assertRaisesMessage(Rejected, reason):
                self.check(text)

    def test_advice_allows_small_quantities_but_not_percentages(self):
        self.assertTrue(self.check("روزی ۱۵ دقیقه با هم بشمارید.", advice=True))
        self.assertTrue(self.check("روزی ده دقیقه تمرین کنید.", advice=True))
        with self.assertRaises(Rejected):
            self.check("تا دقتش ۸۰٪ شود تمرین کنید.", advice=True)

    def test_weekly_report_never_states_a_zero(self):
        with self.assertRaisesMessage(Rejected, "zero"):
            self.check("هفته‌ی قبل ۰ دقیقه بود و این هفته ۲۸ دقیقه.", no_zero=True)
        with self.assertRaisesMessage(Rejected, "zero"):
            self.check("هفته‌ی قبل صفر دقیقه بود.", no_zero=True)
        self.assertTrue(self.check("هفته‌ی قبل ۰ دقیقه بود.", advice=True))      # جای دیگر آزاد است

    def test_mood_must_be_in_the_data(self):
        self.assertTrue(self.check("بیشتر آرام بود.", moods={"آرام"}))
        with self.assertRaisesMessage(Rejected, "mood:شاد"):
            self.check("بیشتر شاد بود.", moods={"آرام"})


class BundleTests(SimpleTestCase):
    def test_good_bundle_is_accepted_and_normalized(self):
        ok, bad = validate_bundle(GOOD, FACTS, SECTIONS)
        self.assertEqual(bad, {})
        self.assertEqual(set(ok), set(SECTIONS))
        self.assertEqual(ok["analysis"]["findings"][2]["tone"], "tip")        # تونِ ناشناخته → tip
        self.assertEqual(ok["tips"][1]["kind"], "practice")                  # نوعِ ناشناخته → اولی
        self.assertEqual(len(ok["health"]["tips"]), 1)

    def test_bad_sections_fall_back_one_by_one(self):
        data = {**GOOD, "weekly": {"title": "هفته‌ی خوب", "body": "[نام] این هفته ۹۹ دقیقه بازی کرد و عالی بود."},
                "health": {"title": "هفته‌ای شاد", "body": "[نام] بیشتر شاد بود و حالش خوب بود.", "tips": []}}
        ok, bad = validate_bundle(data, FACTS, SECTIONS)
        self.assertEqual(set(bad), {"weekly", "health"})
        self.assertIn("number:99", bad["weekly"])
        self.assertIn("mood:شاد", bad["health"])
        self.assertEqual(set(ok), {"analysis", "tips"})

    def test_missing_or_broken_output(self):
        ok, bad = validate_bundle(None, FACTS, SECTIONS)
        self.assertEqual(ok, {})
        self.assertEqual(set(bad), set(SECTIONS))
        ok, _ = validate_bundle({"tips": [{"kind": "practice", "title": "یک", "body": "کوتاه"}]}, FACTS, ["tips"])
        self.assertEqual(ok, {})

    def test_locked_subject_in_free_plan_rejects_the_tip(self):
        tips = [GOOD["tips"][0], {"kind": "practice", "title": "علوم هم مهم است", "body": "روزی ۱۰ دقیقه علوم بخوانید."}]
        ok, bad = validate_bundle({"tips": tips + [GOOD["tips"][1]]}, FACTS, ["tips"])
        self.assertEqual([t["title"] for t in ok["tips"]], ["شمارش با وسایلِ خانه", "یک زمانِ ثابت"])

    def test_clean_reply_turns_lists_into_bullets(self):
        self.assertEqual(clean_reply("**سلام**\n- اول\n2. دوم"), "سلام\n• اول\n• دوم")
        self.assertEqual(clean_reply("در لولو می‌توانید: • اول • دوم"), "در لوکو می‌توانید:\n• اول\n• دوم")


class PromptTests(SimpleTestCase):
    def test_sections_follow_the_data(self):
        self.assertEqual(insight_sections(FACTS), ["weekly", "analysis", "tips", "health"])
        quiet = {**FACTS, "played_this_week": False}
        self.assertEqual(insight_sections(quiet), ["health"])
        self.assertIn("health_daily_tips", insight_sections({**FACTS, "mood_details": {"checkins": 3}}))

    def test_prompts_carry_the_rules_and_never_a_name(self):
        prompt = insight_prompt(FACTS)
        self.assertIn("[نام]", prompt)
        self.assertIn('"locked_subjects"', prompt)
        self.assertIn("Return ONE JSON object only", prompt)
        chat = assistant_prompt(FACTS, [("user", "سلام"), ("assistant", "سلام، بفرمایید")], "چه کنم؟")
        self.assertIn("PARENT: سلام", chat)
        self.assertIn("ASSISTANT: سلام، بفرمایید", chat)
        self.assertTrue(chat.rstrip().endswith("Write only your reply in Persian."))
