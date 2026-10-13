"""پرداخت و هدیه، تیکت، اعلان، کارمند و نمای کلی از راهِ API داشبورد."""
from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import User
from apps.activity.services import record_beat
from apps.billing.models import Payment, Plan
from apps.billing.services import subscription
from apps.dashboard.models import AuditLog, StaffAccess
from apps.notices.models import Broadcast, KidNotice
from apps.parent.models import Notification, ParentChild
from apps.support.models import Ticket, TicketMessage

from .base import DashboardTestBase


class PaymentsTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.kid = User.objects.create_user("09122220001", role="student", first_name="آرش")
        self.parent = User.objects.create_user("09122220002", role="parent")
        ParentChild.objects.create(parent=self.parent, child=self.kid)
        plan = Plan.objects.get(code="monthly")
        Payment.objects.create(payer=self.parent, child=self.kid, plan=plan, plan_title="ماهانه", duration_days=30,
                               amount_toman=199000, amount_rial=1990000, factor_number="LK1", status="paid",
                               paid_at=timezone.now(), starts_at=timezone.now(),
                               ends_at=timezone.now() + timedelta(days=30), payer_phone=self.parent.phone)
        Payment.objects.create(payer=self.parent, child=self.kid, plan=plan, plan_title="ماهانه", duration_days=30,
                               amount_toman=199000, amount_rial=1990000, factor_number="LK2", status="failed")
        self.sign_in(self.admin)

    def test_list_filters_and_summary(self):
        data = self.data(self.get("payments"))
        self.assertEqual(data["summary"], {"count": 2, "paid": 1, "paidToman": 199000, "gifts": 0})
        self.assertEqual([r["factor"] for r in self.data(self.get("payments", status="failed"))["results"]], ["LK2"])
        self.assertEqual(self.data(self.get("payments", q=self.parent.phone))["count"], 2)
        self.assertEqual(self.data(self.get("payments", q="LK1"))["count"], 1)

    def test_gift_and_revoke(self):
        res = self.post("payments/gift", {"childId": self.kid.pk, "days": 10, "note": "تبلیغ"})
        self.assertEqual(res.status_code, 201)
        row = self.data(res)
        self.assertEqual((row["source"], row["statusLabel"], row["amountToman"]), ("gift", "هدیه", 0))
        self.assertEqual(subscription(self.kid).days_left, 40)                     # پشتِ ماهانه
        self.assertEqual(self.data(self.get("payments", source="gift"))["summary"]["gifts"], 1)
        log = AuditLog.objects.get(action="gift_grant")
        self.assertEqual(log.details["days"], 10)
        self.assertEqual(self.post(f"payments/{row['id']}/revoke").status_code, 200)
        self.assertEqual(subscription(self.kid).days_left, 30)
        real = Payment.objects.get(factor_number="LK1")
        self.assertEqual(self.post(f"payments/{real.pk}/revoke").status_code, 400)

    def test_gift_validation(self):
        self.assertEqual(self.post("payments/gift", {"childId": self.parent.pk, "days": 10}).status_code, 400)
        self.assertEqual(self.post("payments/gift", {"childId": self.kid.pk, "days": 0}).status_code, 400)
        self.assertEqual(self.post("payments/gift", {"childId": 999999, "days": 5}).status_code, 404)


class TicketsTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.parent = User.objects.create_user("09122230001", role="parent", first_name="نگار")
        self.ticket = Ticket.objects.create(user=self.parent, subject="پرداخت انجام نشد")
        TicketMessage.objects.create(ticket=self.ticket, sender=self.parent, body="پول کم شد ولی فعال نشد")
        Ticket.objects.create(user=self.parent, subject="قدیمی", status=Ticket.Status.CLOSED)
        self.sign_in(self.admin)

    def test_list_and_search(self):
        data = self.data(self.get("tickets"))
        self.assertEqual(data["counts"], {"open": 1, "answered": 0, "closed": 1})
        self.assertEqual(self.data(self.get("tickets", status="open"))["results"][0]["subject"], "پرداخت انجام نشد")
        self.assertEqual(self.data(self.get("tickets", q="فعال نشد"))["count"], 1)       # جستجو در متنِ پیام‌ها

    def test_reply_notifies_parent(self):
        res = self.post(f"tickets/{self.ticket.pk}/reply", {"body": "بررسی شد؛ فعال است."})
        self.assertEqual(res.status_code, 201)
        thread = self.data(res)["thread"]
        self.assertEqual((thread[-1]["isStaff"], thread[-1]["sender"]), (True, "پشتیبانیِ لوکو"))
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, "answered")
        note = Notification.objects.get(user=self.parent)
        # پیوندِ اعلان مستقیم همان تیکت را در «تنظیمات ← پشتیبانی» باز می‌کند
        self.assertEqual((note.kind, note.link), ("support", f"/parent-panel?p=settings&s=ticket&id={self.ticket.pk}"))
        self.assertEqual(self.post(f"tickets/{self.ticket.pk}/reply", {"body": "  "}).status_code, 400)

    def test_status(self):
        self.assertEqual(self.post(f"tickets/{self.ticket.pk}/status", {"status": "closed"}).status_code, 200)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, "closed")
        self.assertEqual(self.post(f"tickets/{self.ticket.pk}/status", {"status": "x"}).status_code, 400)


class NoticesTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.k1 = User.objects.create_user("09122240001", role="student", first_name="بهار", grade=1)
        self.k2 = User.objects.create_user("09122240002", role="student", first_name="نیما", grade=2)
        self.off = User.objects.create_user("09122240003", role="student", grade=1, is_active=False)
        self.parent = User.objects.create_user("09122240010", role="parent", first_name="رضا")
        self.sign_in(self.admin)

    def test_preview_counts_only_the_chosen_group(self):
        data = self.data(self.post("notices/preview", {"audience": "students", "filters": {"grade": "1"}}))
        self.assertEqual((data["count"], data["sample"]), (1, ["بهار"]))
        self.assertIn("پایه: اول", data["label"])
        data = self.data(self.post("notices/preview", {"audience": "parents", "filters": {"role": "student"}}))
        self.assertEqual(data["count"], 1)                    # نقش را فیلتر عوض نمی‌کند
        self.assertEqual(self.post("notices/preview", {"audience": "everyone"}).status_code, 400)

    def test_send_and_history(self):
        res = self.post("notices/send", {"audience": "students", "filters": {"grade": "1,2"},
                                         "title": "قسمتِ تازه", "body": "گوش بده!", "link": "/luko-podcast"})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.data(res)["recipients"], 2)
        self.assertEqual(KidNotice.objects.count(), 2)
        KidNotice.objects.filter(user=self.k1).update(is_read=True)
        history = self.data(self.get("notices"))["results"][0]
        self.assertEqual((history["recipients"], history["read"], history["audienceLabel"]), (2, 1, "دانش‌آموزان"))
        self.assertTrue(AuditLog.objects.filter(action="notice_send").exists())

    def test_send_validation(self):
        base = {"audience": "parents", "title": "سلام"}
        self.assertEqual(self.post("notices/send", {**base, "title": ""}).status_code, 400)
        self.assertEqual(self.post("notices/send", {**base, "link": "https://evil.example"}).status_code, 400)
        self.assertEqual(self.post("notices/send", {**base, "link": "//evil.example"}).status_code, 400)
        self.assertEqual(self.post("notices/send", {**base, "filters": {"ids": "999999"}}).status_code, 400)
        self.assertEqual(self.post("notices/send", {**base, "body": "x" * 241}).status_code, 400)
        self.assertEqual(Broadcast.objects.count(), 0)


class StaffTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.sign_in(self.admin)

    def test_define_staff_with_ticked_capabilities(self):
        res = self.post("staff", {"phone": "۰۹۱۲۳۳۳۰۰۰۱", "firstName": "سمیرا", "title": "نویسنده‌ی وبلاگ",
                                  "password": "Writer-Pass-2026", "capabilities": ["blog", "podcasts", "nope"]})
        self.assertEqual(res.status_code, 201, res.content)
        row = self.data(res)
        self.assertEqual((row["title"], row["capabilities"]), ("نویسنده‌ی وبلاگ", ["podcasts", "blog"]))
        user = User.objects.get(phone="09123330001", role="team_admin")
        self.assertTrue(user.is_staff and not user.is_superuser and user.check_password("Writer-Pass-2026"))
        self.assertFalse(hasattr(user, "password_vault") and user.password_vault.sealed)   # رمزِ کارمند خوانا ذخیره نمی‌شود

    def test_rules(self):
        base = {"phone": "09123330002", "password": "Good-Pass-2026", "capabilities": ["stats"]}
        self.assertEqual(self.post("staff", {**base, "password": "short"}).status_code, 400)
        self.assertEqual(self.post("staff", {**base, "password": "12345678901"}).status_code, 400)
        self.assertEqual(self.post("staff", {**base, "capabilities": []}).status_code, 400)
        self.assertEqual(self.post("staff", {**base, "phone": "123"}).status_code, 400)
        self.assertEqual(self.post("staff", base).status_code, 201)
        self.assertEqual(self.post("staff", base).status_code, 400)                    # تکراری

    def test_update_remove_and_password(self):
        staff = self.make_staff("09123330003", ["stats"])
        res = self.patch(f"staff/{staff.pk}", {"capabilities": ["tickets", "stats"], "title": "پشتیبان"})
        self.assertEqual(self.data(res)["capabilities"], ["stats", "tickets"])
        self.assertEqual(self.patch(f"staff/{staff.pk}", {"capabilities": []}).status_code, 400)
        self.assertEqual(self.post(f"staff/{staff.pk}/password", {"password": "New-Strong-Pass-1"}).status_code, 200)
        staff.refresh_from_db()
        self.assertTrue(staff.check_password("New-Strong-Pass-1"))
        self.assertEqual(self.delete(f"staff/{staff.pk}").status_code, 200)
        staff.refresh_from_db()
        self.assertFalse(staff.is_staff)
        self.assertFalse(StaffAccess.objects.filter(user=staff).exists())
        self.assertEqual(self.patch(f"staff/{self.admin.pk}", {"title": "x"}).status_code, 404 if not self.admin.is_staff
                         else 403)
        self.assertEqual(self.delete(f"staff/{self.admin.pk}").status_code, 403)

    def test_staff_list(self):
        self.make_staff("09123330004", ["blog"], title="نویسنده")
        rows = self.data(self.get("staff"))["results"]
        self.assertEqual(rows[0]["title"], "مدیرِ کل")
        self.assertIn("نویسنده", [r["title"] for r in rows])


class OverviewTests(DashboardTestBase):
    def test_overview_and_analytics(self):
        kid = User.objects.create_user("09122250001", role="student")
        parent = User.objects.create_user("09122250002", role="parent")
        record_beat(user=kid, device="", platform="android")
        record_beat(user=parent, device="", platform="web")
        record_beat(user=None, device="guest-device-1", platform="web")
        Ticket.objects.create(user=parent, subject="سلام")
        self.sign_in(self.admin)
        data = self.data(self.get("overview"))
        self.assertEqual((data["users"]["students"], data["users"]["parents"]), (1, 1))
        self.assertEqual(data["online"]["total"], 3)
        self.assertEqual(data["active"]["today"], 3)
        self.assertEqual(data["tickets"]["open"], 1)
        self.assertEqual(len(data["series"]["active"]), 30)
        self.assertEqual(data["series"]["active"][-1]["android"], 1)
        self.assertIn("signups", data["latest"])
        for span in ("24h", "7d", "30d", "90d"):
            res = self.data(self.get("analytics", range=span))
            self.assertEqual(len(res["series"]), {"24h": 24, "7d": 7, "30d": 30, "90d": 90}[span])
            self.assertEqual(len(res["hoursOfDay"]), 24)
        res = self.data(self.get("analytics", range="7d", platform="android"))
        self.assertEqual(res["totals"]["visitors"], 1)
        self.assertEqual(res["byAudience"]["guest"]["visitors"], 0)
        res = self.data(self.get("analytics", range="7d", audience="guest"))
        self.assertEqual(res["totals"]["visitors"], 1)
