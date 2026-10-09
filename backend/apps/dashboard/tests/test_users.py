from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import User
from apps.activity.services import record_beat
from apps.billing.models import Payment, Plan
from apps.dashboard.models import AuditLog
from apps.parent.models import ParentChild

from .base import DashboardTestBase


class UsersTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        now = timezone.now()
        plan = Plan.objects.order_by("duration_days").first()

        def paid(child, ends_in_days):
            return Payment.objects.create(
                payer=None, child=child, plan=plan, plan_title=plan.title, duration_days=30,
                amount_toman=plan.price_toman, amount_rial=plan.price_rial, status=Payment.Status.PAID,
                factor_number=f"T{child.pk}{ends_in_days}", paid_at=now,
                starts_at=now + timedelta(days=ends_in_days - 30), ends_at=now + timedelta(days=ends_in_days))

        self.active_kid = User.objects.create_user("09121110001", role="student", first_name="سارا",
                                                   last_name="رضایی", grade=2)
        self.renew_kid = User.objects.create_user("09121110002", role="student", first_name="علی", grade=1)
        self.free_kid = User.objects.create_user("09121110003", role="student", first_name="مینا", grade=1)
        self.lapsed_kid = User.objects.create_user("09121110004", role="student", first_name="رها", grade=3)
        paid(self.active_kid, 20)
        paid(self.renew_kid, 3)
        paid(self.lapsed_kid, -5)                     # پنج روز پیش تمام شد → هنوز «نیاز به تمدید»
        self.parent = User.objects.create_user("09121110010", role="parent", first_name="مریم",
                                               last_name="کاظمی", phone_verified=True)
        ParentChild.objects.create(parent=self.parent, child=self.active_kid)
        ParentChild.objects.create(parent=self.parent, child=self.renew_kid)
        self.lonely_parent = User.objects.create_user("09121110011", role="parent", first_name="بی‌فرزند")
        self.staff = self.make_staff("09121110020", ["users_view"], title="پشتیبان")
        record_beat(user=self.active_kid, device="", platform="android")
        record_beat(user=self.parent, device="", platform="web")
        User.objects.filter(pk=self.free_kid.pk).update(date_joined=now - timedelta(days=60))
        self.sign_in(self.admin)

    def names(self, **params):
        res = self.get("users", **params)
        self.assertEqual(res.status_code, 200, res.content)
        return {r["name"] for r in self.data(res)["results"]}

    def test_rows_show_role_subscription_and_last_seen(self):
        rows = {r["id"]: r for r in self.data(self.get("users"))["results"]}
        kid = rows[self.active_kid.pk]
        self.assertEqual((kid["name"], kid["roleLabel"], kid["gradeLabel"]), ("سارا رضایی", "دانش‌آموز", "دوم"))
        self.assertEqual(kid["subscription"]["status"], "active")
        self.assertEqual(kid["subscription"]["daysLeft"], 20)
        self.assertEqual((kid["lastSeen"]["platform"], kid["lastSeen"]["online"]), ("android", True))
        self.assertEqual(rows[self.renew_kid.pk]["subscription"]["label"], "نیاز به تمدید")
        self.assertEqual(rows[self.lapsed_kid.pk]["subscription"]["status"], "renewal")
        self.assertEqual(rows[self.free_kid.pk]["subscription"]["status"], "inactive")
        self.assertEqual(rows[self.parent.pk]["children"], {"count": 2, "active": 1, "renewal": 1, "inactive": 0})
        self.assertEqual(rows[self.staff.pk]["roleLabel"], "پشتیبان")
        self.assertEqual(rows[self.admin.pk]["role"], "admin")

    def test_filters(self):
        self.assertEqual(self.names(role="student"), {"سارا رضایی", "علی", "مینا", "رها"})
        self.assertEqual(self.names(role="parent"), {"مریم کاظمی", "بی‌فرزند"})
        self.assertEqual(self.names(role="staff"), {"بی‌نام"})              # کارمندِ بی‌نام، نه مدیرِ کل
        self.assertEqual(self.names(role="admin"), {"مدیر کل"})
        self.assertEqual(self.names(q="رضایی"), {"سارا رضایی"})
        self.assertEqual(self.names(q="مریم کاظمی"), {"مریم کاظمی"})
        self.assertEqual(self.names(q="۰۹۱۲۱۱۱۰۰۰۳"), {"مینا"})          # رقمِ فارسی
        self.assertEqual(self.names(q="+989121110002"), {"علی"})
        self.assertEqual(self.names(grade="1", role="student"), {"علی", "مینا"})
        self.assertEqual(self.names(grade="2", role="parent"), {"مریم کاظمی"})   # والدِ بچه‌ی پایه‌ی دوم
        self.assertEqual(self.names(sub="active", role="student"), {"سارا رضایی"})
        self.assertEqual(self.names(sub="renewal", role="student"), {"علی", "رها"})
        self.assertEqual(self.names(sub="inactive", role="student"), {"مینا"})
        self.assertEqual(self.names(sub="renewal", role="parent"), {"مریم کاظمی"})
        self.assertEqual(self.names(sub="active,inactive", role="student"), {"سارا رضایی", "مینا"})
        self.assertEqual(self.names(seen="online"), {"سارا رضایی", "مریم کاظمی"})
        self.assertEqual(self.names(platform="android"), {"سارا رضایی"})
        self.assertNotIn("مینا", self.names(seen="7d"))
        self.assertIn("مینا", self.names(seen="never"))
        self.assertEqual(self.names(verified="true"), {"مریم کاظمی"})
        self.assertEqual(self.names(has_children="false"), {"بی‌فرزند"})
        self.assertEqual(self.names(ids=f"{self.free_kid.pk},{self.parent.pk}"), {"مینا", "مریم کاظمی"})
        old = timezone.localdate() - timedelta(days=30)
        from apps.common.fa import to_jalali

        jy, jm, jd = to_jalali(old)
        self.assertEqual(self.names(joined_to=f"{jy}/{jm}/{jd}", role="student"), {"مینا"})
        self.assertNotIn("مینا", self.names(joined_from=f"{jy}/{jm}/{jd}"))

    def test_pagination_and_summary(self):
        res = self.data(self.get("users", page_size=5, page=2))
        self.assertEqual((res["page"], res["pageSize"], res["pages"]), (2, 5, 2))
        self.assertEqual(res["summary"], {"students": 4, "parents": 2})
        self.assertEqual(len(res["results"]), res["count"] - 5)

    def test_student_detail(self):
        data = self.data(self.get(f"users/{self.active_kid.pk}"))
        self.assertEqual(data["parents"][0]["phone"], self.parent.phone)
        self.assertEqual(data["subscription"]["totalDays"], 30)
        self.assertEqual(data["progress"]["gamesDone"], 0)
        self.assertEqual(len(data["activity"]["series"]), 30)
        self.assertGreaterEqual(data["activity"]["androidMinutes"], 1)
        self.assertEqual(len(data["payments"]), 1)

    def test_parent_detail(self):
        data = self.data(self.get(f"users/{self.parent.pk}"))
        self.assertEqual({c["name"] for c in data["childrenList"]}, {"سارا رضایی", "علی"})
        self.assertEqual(len(data["payments"]), 2)

    def test_detail_hides_payments_without_permission(self):
        self.sign_in(self.staff)
        data = self.data(self.get(f"users/{self.parent.pk}"))
        self.assertEqual(data["payments"], [])
        self.assertEqual(data["history"], [])

    def test_edit_and_deactivate(self):
        version = self.free_kid.session_version
        res = self.patch(f"users/{self.free_kid.pk}", {"firstName": "مینو", "grade": 3, "isActive": False})
        self.assertEqual(res.status_code, 200)
        self.free_kid.refresh_from_db()
        self.assertEqual((self.free_kid.first_name, self.free_kid.grade, self.free_kid.is_active), ("مینو", 3, False))
        self.assertGreater(self.free_kid.session_version, version)        # همان لحظه بیرون
        log = AuditLog.objects.get(action="user_edit")
        self.assertEqual(log.details["first_name"], ["مینا", "مینو"])
        self.assertEqual(self.patch(f"users/{self.free_kid.pk}", {"grade": 99}).status_code, 400)

    def test_rules_for_editing_team_accounts(self):
        editor = self.make_staff("09121110021", ["users_view", "users_edit"])
        self.sign_in(editor)
        self.assertEqual(self.patch(f"users/{self.staff.pk}", {"firstName": "x"}).status_code, 403)
        self.assertEqual(self.post(f"users/{self.admin.pk}/logout-all").status_code, 403)
        self.assertEqual(self.patch(f"users/{editor.pk}", {"isActive": False}).status_code, 403)
        self.sign_in(self.admin)
        self.assertEqual(self.patch(f"users/{self.admin.pk}", {"isActive": False}).status_code, 400)

    def test_logout_all(self):
        version = self.parent.session_version
        self.assertEqual(self.post(f"users/{self.parent.pk}/logout-all").status_code, 200)
        self.parent.refresh_from_db()
        self.assertEqual(self.parent.session_version, version + 1)
        self.assertTrue(AuditLog.objects.filter(action="user_logout_all", target_id=str(self.parent.pk)).exists())
