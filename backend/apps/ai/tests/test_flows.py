"""
کلاینتِ گیت‌وی، تحلیلِ گزارشِ والد و دستیار — با گیت‌وی ساختگی (هیچ درخواستِ واقعی‌ای نمی‌رود).
"""
import json
import uuid
from datetime import timedelta
from unittest.mock import patch

import requests
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai import client, insights
from apps.ai.assistant import answer
from apps.ai.models import AIInsight, AIUsage, AssistantMessage
from apps.billing.services import gift_subscription
from apps.games.models import Book, ConceptTag, Game
from apps.games.telemetry import store_events
from apps.parent.models import ParentChild

AI = {"AI_ENABLED": True, "AI_BASE_URL": "https://gateway.test/v1", "AI_API_KEY": "test-key",
      "AI_QUOTA_FREE": 2, "AI_QUOTA_PREMIUM": {"flash": 5, "pro": 3, "luna": 1}}


class FakeResponse:
    def __init__(self, status=200, content="", usage=None):
        self.status_code = status
        self._content = content
        self._usage = usage or {"prompt_tokens": 100, "completion_tokens": 50}

    def json(self):
        return {"choices": [{"message": {"role": "assistant", "content": self._content}}], "usage": self._usage}


class Gateway:
    """گیت‌وی ساختگی: پاسخ‌ها را به ترتیب برمی‌گرداند و بدنه‌ی درخواست‌ها را نگه می‌دارد"""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.bodies = []

    def __call__(self, body, timeout):
        self.bodies.append(body)
        item = self.responses.pop(0) if self.responses else FakeResponse(500)
        if isinstance(item, Exception):
            raise item
        return item


def bundle(minutes: int) -> str:
    return json.dumps({
        "weekly": {"title": "هفته‌ی پرتلاشِ [نام]", "body": f"[نام] این هفته {minutes} دقیقه با لوکو بازی کرد و پیوسته تمرین کرد."},
        "analysis": {
            "headline": "شمارش خوب پیش می‌رود",
            "narrative": f"[نام] این هفته {minutes} دقیقه بازی کرد و در شمارش پیشرفت داشت.",
            "findings": [{"tone": "good", "title": "شمارش", "body": "در شمارش پاسخ‌های درستِ زیادی داد."},
                         {"tone": "tip", "title": "ادامه", "body": "همین روال را روزی ۱۰ دقیقه ادامه دهید."}],
            "action": {"title": "روزی ۱۰ دقیقه", "body": "هر روز ۱۰ دقیقه کنارش بنشینید و تشویقش کنید."},
        },
        "tips": [{"kind": "practice", "title": "شمارشِ قاشق‌ها", "body": "سرِ سفره با [نام] قاشق‌ها را بشمارید."},
                 {"kind": "routine", "title": "ساعتِ ثابت", "body": "هر روز در یک ساعتِ ثابت بازی کند."},
                 {"kind": "praise", "title": "تشویقِ تلاش", "body": "برای تلاشش تشویقش کنید، نه فقط نتیجه."}],
    }, ensure_ascii=False)


@override_settings(**AI)
class AIFlowBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.parent = User.objects.create(phone="09121118001", role=User.Role.PARENT, first_name="مریم")
        cls.other = User.objects.create(phone="09121118002", role=User.Role.PARENT)
        cls.kid = User.objects.create(phone="09121118003", role=User.Role.STUDENT, first_name="سارا", grade=1)
        cls.admin = User.objects.create(phone="09121118004", role=User.Role.TEAM_ADMIN, is_staff=True)
        ParentChild.objects.create(parent=cls.parent, child=cls.kid)
        Book.objects.update_or_create(book_id="math-1", defaults={"title": "ریاضی ۱", "subject": "ریاضی", "grade": 1})
        Book.objects.update_or_create(book_id="science-1", defaults={"title": "علوم ۱", "subject": "علوم", "grade": 1})
        Game.objects.create(slug="g-math", title="مزرعه", book_id="math-1", grade=1, order=1, season_order=1)
        Game.objects.create(slug="g-sci", title="آزمایشگاه", book_id="science-1", grade=1, order=1, season_order=2)
        ConceptTag.objects.update_or_create(code="count", defaults={"title": "شمارش", "subject": "math"})
        ConceptTag.objects.update_or_create(code="plants", defaults={"title": "گیاهان", "subject": "science"})

    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.api.force_authenticate(self.parent)

    def play(self, minutes=10, slug="g-math", tag="count"):
        sid = uuid.uuid4().hex[:8]
        now = timezone.now() - timedelta(minutes=30)
        events = [{"game_slug": slug, "event_type": "answer", "event_id": str(uuid.uuid4()), "session_id": sid,
                   "concept_tag": tag, "is_correct": i % 4 != 0, "attempt_number": 1, "time_taken_ms": 4000,
                   "occurred_at": int((now + timedelta(seconds=i)).timestamp() * 1000)} for i in range(8)]
        events.append({"game_slug": slug, "event_type": "game_complete", "event_id": str(uuid.uuid4()), "session_id": sid,
                       "duration_ms": minutes * 60000, "occurred_at": int((now + timedelta(minutes=1)).timestamp() * 1000)})
        store_events(self.kid, events)

    def report(self):
        res = self.api.get(f"/api/v1/parent/children/{self.kid.id}/report")
        self.assertEqual(res.status_code, 200)
        return res.json()["data"]


class ClientTests(AIFlowBase):
    def test_request_shape_retry_and_usage_log(self):
        gateway = Gateway(FakeResponse(429), FakeResponse(200, "سلام"))
        with patch("apps.ai.client._post", gateway), patch("apps.ai.client.time.sleep"):
            result = client.complete("flash", "پرسش", feature="assistant", user=self.parent)
        self.assertEqual(result.text, "سلام")
        self.assertEqual(len(gateway.bodies), 2)
        body = gateway.bodies[0]
        self.assertEqual(body["model"], "DeepSeek-V4-Flash")
        # فقط یک پیامِ کاربر: گیت‌وی system را برای Flash نادیده می‌گیرد
        self.assertEqual(body["messages"], [{"role": "user", "content": "پرسش"}])
        usage = AIUsage.objects.get()
        self.assertEqual((usage.ok, usage.prompt_tokens, usage.user_id), (True, 100, self.parent.id))

    def test_auth_header_uses_apikey_scheme(self):
        with patch("apps.ai.client.requests.post", return_value=FakeResponse(200, "باشه")) as post:
            client.complete("luna", "پرسش", feature="assistant")
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "apikey test-key")
        self.assertEqual(post.call_args.args[0], "https://gateway.test/v1/chat/completions")
        self.assertEqual(post.call_args.kwargs["json"]["model"], "GPT-5.6-Luna")

    def test_failures_raise_and_are_logged(self):
        class ListResponse(FakeResponse):
            def json(self):
                return ["نه شیء"]

        for responses, code in [((FakeResponse(401),), "http:401"),
                                ((ListResponse(), ListResponse()), "bad-shape"),
                                ((FakeResponse(200, ""),), "empty"),
                                ((requests.Timeout(), requests.Timeout()), "network:Timeout")]:
            with self.subTest(code=code), patch("apps.ai.client._post", Gateway(*responses)), \
                    patch("apps.ai.client.time.sleep"), self.assertRaises(client.AIError) as ctx:
                client.complete("pro", "پرسش", feature="insight")
            self.assertEqual(ctx.exception.code, code)
        self.assertEqual(AIUsage.objects.filter(ok=False).count(), 4)

    @override_settings(AI_ENABLED=False)
    def test_disabled(self):
        with self.assertRaises(client.AIError):
            client.complete("flash", "پرسش", feature="insight")
        self.assertFalse(AIUsage.objects.exists())


class InsightTests(AIFlowBase):
    def run_queued(self, gateway):
        """صف را همان‌جا اجرا می‌کند"""
        def delay(child_id, premium, fp=""):
            insights.generate(User.objects.get(pk=child_id), premium, fp)
        return patch("apps.ai.tasks.generate_insight.delay", side_effect=delay), patch("apps.ai.client._post", gateway)

    @override_settings(AI_ENABLED=False)
    def test_off_without_a_key(self):
        self.play()
        self.assertEqual(self.report()["ai"], {"status": "off"})

    def test_nothing_to_analyse_costs_nothing(self):
        with patch("apps.ai.tasks.generate_insight.delay") as delay:
            self.assertEqual(self.report()["ai"]["status"], "off")
        delay.assert_not_called()

    def test_free_plan_flow_flash_merge_and_locks(self):
        self.play(minutes=10)
        queued, post = self.run_queued(Gateway(FakeResponse(200, bundle(10))))
        with queued as delay, post:
            first = self.report()
            self.assertEqual(first["ai"]["status"], "pending")      # همین الان در صف
            self.assertEqual(first["weekly"].get("source"), None)   # فعلاً متنِ قاعده‌محور
            delay.assert_called_once()
            second = self.report()
        insight = AIInsight.objects.get(child=self.kid)
        self.assertEqual((insight.variant, insight.tier), ("free", "flash"))
        self.assertNotIn("سارا", json.dumps(insight.payload, ensure_ascii=False))   # نام ذخیره نمی‌شود

        self.assertEqual(second["ai"]["status"], "ready")
        self.assertEqual(second["ai"]["tierLabel"], "پایه")
        self.assertEqual(second["weekly"]["title"], "هفته‌ی پرتلاشِ سارا")         # نام سرِ جایش
        self.assertEqual(second["weekly"]["source"], "ai")
        tips = second["tips"]
        self.assertEqual(tips["source"], "ai")
        self.assertFalse(tips["items"][0].get("locked"))
        self.assertTrue(all(t["locked"] and t["body"] == "" for t in tips["items"][1:]))   # قفلِ پلنِ رایگان
        self.assertEqual(second["aiAnalysis"]["headline"], "شمارش خوب پیش می‌رود")
        self.assertEqual(second["weekly"]["highlights"], first["weekly"]["highlights"])   # عددها دست‌نخورده
        self.assertEqual(second["kpis"], first["kpis"])

    def test_free_plan_facts_never_include_locked_subjects(self):
        self.play(slug="g-sci", tag="plants")
        self.play(slug="g-math", tag="count")
        gateway = Gateway(FakeResponse(200, bundle(10)))
        queued, post = self.run_queued(gateway)
        with queued, post:
            self.report()
        prompt = gateway.bodies[0]["messages"][0]["content"]
        self.assertIn('"locked_subjects"', prompt)
        self.assertNotIn("گیاهان", prompt)          # مفهومِ درسِ قفل
        self.assertNotIn("سارا", prompt)            # نام
        self.assertNotIn("09121118003", prompt)     # شماره

    def test_subject_without_answers_has_no_accuracy(self):
        """بازیِ بی‌پاسخ (فقط پایان) نباید برای مدل «دقتِ ۰٪» بسازد"""
        from apps.ai.facts import build_facts
        from apps.games.models import GameCompletion
        from apps.parent.gating import gate_report
        from apps.parent.services import build_child_report

        self.play()
        GameCompletion.objects.create(user=self.kid, game_slug="g-sci", coins_awarded=5)
        facts = build_facts(gate_report(build_child_report(self.kid), True), premium=True, grade=1)
        science = next(s for s in facts["subjects"] if s["name"] == "علوم")
        self.assertNotIn("accuracy_percent_last_8_weeks", science)
        self.assertIn("note", science)
        math = next(s for s in facts["subjects"] if s["name"] == "ریاضی")
        self.assertEqual(math["answers_last_8_weeks"], 8)

    def test_new_play_makes_the_old_analysis_stale(self):
        self.play(minutes=10)
        queued, post = self.run_queued(Gateway(FakeResponse(200, bundle(10)), FakeResponse(200, bundle(20))))
        with queued as delay, post:
            self.report()
            self.assertEqual(self.report()["ai"]["status"], "ready")
            self.play(minutes=10)
            cache.clear()
            stale = self.report()
            self.assertEqual(delay.call_count, 2)
        # داده عوض شد: متنِ کهنه (با عددِ قدیمی) نشان داده نمی‌شود تا تحلیلِ تازه برسد
        self.assertEqual(stale["ai"]["status"], "pending")
        self.assertNotIn("source", stale["weekly"])
        fresh = self.report()
        self.assertEqual(fresh["weekly"]["source"], "ai")
        self.assertIn("۲۰ دقیقه", fresh["weekly"]["body"])

    def test_rejected_output_keeps_rules_and_remembers_failure(self):
        self.play(minutes=10)
        bad = json.dumps({"weekly": {"title": "x", "body": "۹۹۹ دقیقه بازی کرد و همه‌چیز عالی بود."}})
        queued, post = self.run_queued(Gateway(FakeResponse(200, bad)))
        with queued as delay, post:
            self.report()
            again = self.report()
        self.assertEqual(again["ai"]["status"], "failed")
        self.assertEqual(delay.call_count, 1)        # شکست تا نیم ساعت دوباره صف نمی‌شود
        self.assertFalse(AIInsight.objects.exists())
        self.assertNotIn("source", again["weekly"])

    def test_premium_uses_luna_and_falls_back_to_flash(self):
        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        self.play(minutes=10)
        gateway = Gateway(FakeResponse(503), FakeResponse(503), FakeResponse(200, bundle(10)))
        queued, post = self.run_queued(gateway)
        with queued, post, patch("apps.ai.client.time.sleep"):
            self.report()
            ready = self.report()
        self.assertEqual([b["model"] for b in gateway.bodies], ["GPT-5.6-Luna", "GPT-5.6-Luna", "DeepSeek-V4-Flash"])
        self.assertEqual(AIInsight.objects.get().variant, "full")
        self.assertEqual(ready["ai"]["tier"], "flash")
        self.assertFalse(any(t.get("locked") for t in ready["tips"]["items"]))   # مشترک: همه باز


class AssistantTests(AIFlowBase):
    def ask(self, text="چطور در شمارش کمکش کنم؟", tier="flash", gateway=None):
        gateway = gateway or Gateway(FakeResponse(200, "**سلام.** با سارا روزی ۱۰ دقیقه بشمارید.\n- قاشق‌ها\n- دکمه‌ها"))
        with patch("apps.ai.tasks.answer_question.delay", side_effect=answer), patch("apps.ai.client._post", gateway):
            res = self.api.post(f"/api/v1/parent/assistant/{self.kid.id}", {"text": text, "tier": tier}, format="json")
        return res, gateway

    def test_thread_quota_and_suggestions(self):
        self.play()
        data = self.api.get(f"/api/v1/parent/assistant/{self.kid.id}").json()["data"]
        self.assertTrue(data["enabled"])
        tiers = {t["key"]: t for t in data["quota"]["tiers"]}
        self.assertEqual((tiers["flash"]["limit"], tiers["flash"]["locked"]), (2, False))
        self.assertTrue(tiers["pro"]["locked"] and tiers["luna"]["locked"])
        self.assertTrue(1 <= len(data["suggestions"]) <= 4)
        self.assertEqual(data["messages"], [])

    def test_ask_and_answer_with_the_name_kept_private(self):
        self.play()
        res, gateway = self.ask("سارا با شمارش مشکل دارد، چه کنم؟")
        self.assertEqual(res.status_code, 201)
        prompt = gateway.bodies[0]["messages"][0]["content"]
        self.assertNotIn("سارا", prompt)
        self.assertIn("[نام] با شمارش مشکل دارد", prompt)
        thread = self.api.get(f"/api/v1/parent/assistant/{self.kid.id}").json()["data"]
        reply = thread["messages"][-1]
        self.assertEqual((reply["role"], reply["status"], reply["tierLabel"]), ("assistant", "done", "پایه"))
        self.assertEqual(reply["content"], "سلام. با سارا روزی ۱۰ دقیقه بشمارید.\n• قاشق‌ها\n• دکمه‌ها")
        self.assertFalse(thread["pending"])

        # پرسشِ دوم تاریخچه را می‌فرستد (بی‌نام)
        _, gateway = self.ask("ممنون، و برای مقایسه؟")
        prompt = gateway.bodies[0]["messages"][0]["content"]
        self.assertIn("CONVERSATION SO FAR", prompt)
        self.assertIn("PARENT: [نام] با شمارش مشکل دارد", prompt)
        self.assertNotIn("سارا", prompt)

    def test_free_plan_limits(self):
        self.assertEqual(self.ask(tier="luna")[0].status_code, 403)       # فقط با اشتراک
        self.assertEqual(self.ask()[0].status_code, 201)
        self.assertEqual(self.ask()[0].status_code, 201)
        res, _ = self.ask()
        self.assertEqual(res.status_code, 429)                            # سهمیه‌ی ۲ تایی تمام شد
        self.assertEqual(res.json()["error"]["reason"], "quota")

    def test_failed_answer_does_not_use_the_quota(self):
        res, _ = self.ask(gateway=Gateway(FakeResponse(401)))
        self.assertEqual(res.status_code, 201)
        reply = AssistantMessage.objects.filter(role="assistant").get()
        self.assertEqual(reply.status, "failed")
        tiers = {t["key"]: t for t in self.api.get(f"/api/v1/parent/assistant/{self.kid.id}").json()["data"]["quota"]["tiers"]}
        self.assertEqual(tiers["flash"]["used"], 0)

    def test_premium_models_open_with_subscription(self):
        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        res, gateway = self.ask(tier="luna")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(gateway.bodies[0]["model"], "GPT-5.6-Luna")
        self.assertEqual(self.ask(tier="luna")[0].status_code, 429)        # سقفِ ۱ پرسشِ «پیشرفته»
        self.assertEqual(self.ask(tier="pro")[0].status_code, 201)

    def test_busy_validation_and_stale(self):
        with patch("apps.ai.tasks.answer_question.delay"):            # پاسخ هنوز نیامده
            first = self.api.post(f"/api/v1/parent/assistant/{self.kid.id}", {"text": "سلام"}, format="json")
            busy = self.api.post(f"/api/v1/parent/assistant/{self.kid.id}", {"text": "سلام"}, format="json")
        self.assertEqual((first.status_code, busy.status_code), (201, 409))
        self.assertEqual(self.api.post(f"/api/v1/parent/assistant/{self.kid.id}", {"text": " "}, format="json").status_code,
                         400)
        AssistantMessage.objects.filter(status="pending").update(created_at=timezone.now() - timedelta(minutes=10))
        thread = self.api.get(f"/api/v1/parent/assistant/{self.kid.id}").json()["data"]
        reply = next(m for m in thread["messages"] if m["role"] == "assistant")
        self.assertEqual(reply["status"], "failed")                         # پاسخِ گم‌شده بسته می‌شود
        self.assertFalse(thread["pending"])

    def test_clear_and_permissions(self):
        self.ask()
        self.assertEqual(self.api.delete(f"/api/v1/parent/assistant/{self.kid.id}").json()["data"]["deleted"], 2)
        stranger = APIClient()
        stranger.force_authenticate(self.other)
        self.assertEqual(stranger.get(f"/api/v1/parent/assistant/{self.kid.id}").status_code, 404)
        kid = APIClient()
        kid.force_authenticate(self.kid)
        self.assertEqual(kid.get(f"/api/v1/parent/assistant/{self.kid.id}").status_code, 403)

    @override_settings(AI_ENABLED=False)
    def test_disabled(self):
        self.assertFalse(self.api.get(f"/api/v1/parent/assistant/{self.kid.id}").json()["data"]["enabled"])
        res = self.api.post(f"/api/v1/parent/assistant/{self.kid.id}", {"text": "سلام"}, format="json")
        self.assertEqual(res.status_code, 503)
