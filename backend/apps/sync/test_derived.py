"""
تنفس، پادکست، مأموریت و ورزشِ بچه که فقط در داده‌ی هم‌رسان بودند حالا به پنلِ والد می‌رسند — هم از اپِ
اندرویدیِ قدیمی (فقط هم‌رسانی) و هم از اپِ تازه (مستقیم)، بی‌آنکه یک کار دوبار شمرده شود.
"""
import json
from datetime import datetime, time, timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.content.models import Podcast, PodcastListen
from apps.health.models import BreathingSession
from apps.parent.gating import gate_report
from apps.parent.services import build_child_report


def day(days_ago: int) -> str:
    return (timezone.localdate() - timedelta(days=days_ago)).isoformat()


class SyncedKidDataTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121117001", role=User.Role.STUDENT, first_name="نیما", grade=1)
        cls.story = Podcast.objects.create(title="قصه", category="قصه", audio_url="https://example.com/a.mp3")
        cls.song = Podcast.objects.create(title="آواز", category="موسیقی", audio_url="https://example.com/b.mp3")

    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.api.force_authenticate(self.kid)
        self.versions = {}

    def sync(self, **values):
        changes = [{"key": key, "value": value if value is None or isinstance(value, str) else json.dumps(value),
                    "baseVersion": self.versions.get(key, 0)} for key, value in values.items()]
        res = self.api.post("/api/v1/sync", {"changes": changes}, format="json")
        self.assertEqual(res.status_code, 200)
        for row in res.json()["data"]["applied"]:
            self.versions[row["key"]] = row["version"]

    def breathe(self, cycles: int, seconds: int):
        return self.api.post("/api/v1/breathing/sessions", {"cycles": cycles, "seconds": seconds}, format="json")

    # ---------------------------------------------------------------- تنفس
    def test_breathing_mission_day_becomes_one_session(self):
        self.sync(**{f"luko_club_done_{day(3)}": ["mood", "breath"], f"luko_club_done_{day(0)}": ["game"]})
        session = BreathingSession.objects.get(user=self.kid)
        self.assertEqual((session.cycles, session.seconds), (1, 0))
        self.assertEqual(timezone.localtime(session.created_at).date().isoformat(), day(3))
        # همان روز دوباره هم‌رسان شود (دستگاهِ دیگر) → باز یکی
        self.sync(**{f"luko_club_done_{day(3)}": ["mood", "breath", "garden"]})
        self.assertEqual(BreathingSession.objects.filter(user=self.kid).count(), 1)
        # امروز هم تنفس کرد
        self.sync(**{f"luko_club_done_{day(0)}": ["game", "breath"]})
        self.assertEqual(BreathingSession.objects.filter(user=self.kid).count(), 2)

    def test_app_session_completes_the_synced_guess_instead_of_doubling(self):
        # مأموریت ۱.۵ ثانیه بعد از دورِ اول هم‌رسان می‌شود، تمرینِ کامل وقتی بچه «بس» را بزند
        self.sync(**{f"luko_club_done_{day(0)}": ["breath"]})
        res = self.breathe(5, 60)
        self.assertEqual((res.status_code, res.json()["data"]["cycles"]), (201, 5))
        self.assertEqual(list(BreathingSession.objects.filter(user=self.kid).values_list("cycles", "seconds")),
                         [(5, 60)])
        # تمرینِ دومِ همان روز تمرینِ جداست
        self.breathe(2, 24)
        self.assertEqual(BreathingSession.objects.filter(user=self.kid).count(), 2)

    def test_app_session_first_then_sync_is_still_one(self):
        self.assertEqual(self.breathe(3, 36).status_code, 201)
        self.sync(**{f"luko_club_done_{day(0)}": ["breath"]})
        self.assertEqual(list(BreathingSession.objects.filter(user=self.kid).values_list("cycles", "seconds")),
                         [(3, 36)])

    def test_bad_breathing_input(self):
        self.assertEqual(self.breathe(0, 10).status_code, 400)
        self.assertEqual(self.breathe(2, 0).status_code, 400)
        self.assertEqual(self.api.post("/api/v1/breathing/sessions", {"cycles": 2}, format="json").status_code, 400)
        self.sync(**{f"luko_club_done_{day(-5)}": ["breath"],          # ساعتِ دستگاه خیلی جلو
                     f"luko_club_done_{day(1)}": "not json",
                     f"luko_club_done_{day(2)}": {"breath": True}})
        self.assertFalse(BreathingSession.objects.filter(user=self.kid).exists())

    # ---------------------------------------------------------------- پادکست
    def test_synced_listened_episode_reaches_the_server_once(self):
        # «p1» قسمتِ نمونه‌ی نسخه‌ی قدیمیِ اپ است و کنار می‌رود؛ شناسه‌ی ناموجود هم
        self.sync(luko_podcast_listened=["p1", str(self.story.id), "99999"])
        self.assertEqual(list(PodcastListen.objects.filter(user=self.kid).values_list("podcast_id", "seconds")),
                         [(self.story.id, 0)])
        self.sync(luko_podcast_listened=["p1", str(self.story.id), str(self.song.id)])
        self.assertEqual(PodcastListen.objects.filter(user=self.kid).count(), 2)
        flags = {e["title"]: e["listened"] for e in self.api.get("/api/v1/podcasts").json()["data"]["episodes"]}
        self.assertEqual(flags, {"قصه": True, "آواز": True})

    def test_player_listen_completes_the_synced_guess(self):
        self.sync(luko_podcast_listened=[str(self.story.id)])
        self.api.post(f"/api/v1/podcasts/{self.story.id}/listen", {"seconds": 300}, format="json")
        self.assertEqual(list(PodcastListen.objects.filter(user=self.kid).values_list("seconds", flat=True)), [300])
        # دوباره گوش داد → دوتا
        self.api.post(f"/api/v1/podcasts/{self.story.id}/listen", {"seconds": 300}, format="json")
        self.assertEqual(PodcastListen.objects.filter(user=self.kid).count(), 2)
        # هم‌رسانیِ بعدی چیزی اضافه نمی‌کند
        self.sync(luko_podcast_listened=[str(self.story.id)])
        self.assertEqual(PodcastListen.objects.filter(user=self.kid).count(), 2)

    # ---------------------------------------------------------------- مأموریت و ورزش در پنلِ والد
    def test_parent_report_counts_synced_missions_and_sport(self):
        self.sync(luko_club_days=[day(2), day(1), day(0), "bad"],
                  **{f"luko_sport_done_{day(1)}": ["sport-run", "sport-jump"],
                     f"luko_sport_done_{day(0)}": ["sport-squat"],
                     f"luko_sport_done_{day(40)}": ["sport-run"]})
        report = build_child_report(self.kid)
        streak = next(k for k in report["kpis"] if k["key"] == "streak")
        self.assertEqual(streak["value"], 3)
        interests = {i["key"]: i for i in gate_report(report, True)["health"]["daily"]["interests"]}
        self.assertIn("۳ مأموریتِ ورزشی", interests["sport"]["detail"])

    def test_old_synced_days_backfill_matches_the_live_rule(self):
        """مایگریشنِ health.0006 همان قاعده را روی داده‌ی قبلی اجرا کرد؛ اینجا همان قاعده با زمانِ ظهرِ آن روز."""
        self.sync(**{f"luko_club_done_{day(10)}": ["breath"]})
        session = BreathingSession.objects.get(user=self.kid)
        noon = timezone.make_aware(datetime.combine(timezone.localdate() - timedelta(days=10), time(12)))
        self.assertEqual(session.created_at, noon)


class BreathingBackfillTests(TestCase):
    def test_migration_turns_old_breathing_days_into_sessions(self):
        import importlib

        from django.apps import apps

        from apps.sync.models import KidData

        kid = User.objects.create(phone="09121117002", role=User.Role.STUDENT)
        KidData.objects.create(user=kid, key=f"luko_club_done_{day(5)}", value='["breath"]', version=1)
        KidData.objects.create(user=kid, key=f"luko_club_done_{day(4)}", value='["game"]', version=1)
        KidData.objects.create(user=kid, key=f"luko_club_done_{day(3)}", value=None, version=2)
        migration = importlib.import_module("apps.health.migrations.0006_backfill_synced_breathing")
        migration.backfill(apps, None)
        migration.backfill(apps, None)               # دوباره اجرا شود → چیزی دوبار ساخته نمی‌شود
        days = [timezone.localtime(t).date().isoformat()
                for t in BreathingSession.objects.filter(user=kid).values_list("created_at", flat=True)]
        self.assertEqual(days, [day(5)])
