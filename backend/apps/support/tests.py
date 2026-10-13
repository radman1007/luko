"""سیستمِ تیکتِ پنلِ والدین: ساخت، گفت‌وگو، خوانده‌نشده، بستن، امتیاز و اولویتِ مشترک."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.services import gift_subscription
from apps.parent.models import ParentChild

from .models import Ticket, TicketMessage


class TicketTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.parent = User.objects.create(phone="09121119101", role=User.Role.PARENT, first_name="مریم")
        cls.kid = User.objects.create(phone="09121119102", role=User.Role.STUDENT, first_name="سارا")
        cls.stranger_kid = User.objects.create(phone="09121119103", role=User.Role.STUDENT, first_name="نیما")
        cls.other = User.objects.create(phone="09121119104", role=User.Role.PARENT)
        cls.admin = User.objects.create(phone="09121119105", role=User.Role.TEAM_ADMIN, is_staff=True)
        ParentChild.objects.create(parent=cls.parent, child=cls.kid)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.parent)

    def create(self, **extra):
        body = {"category": "billing", "subject": "پرداخت انجام نشد", "body": "پول کم شد ولی اشتراک فعال نشد.", **extra}
        return self.api.post("/api/v1/tickets", body, format="json")

    def staff_reply(self, ticket: Ticket, body="بررسی شد؛ فعال است.", ago=None):
        msg = TicketMessage.objects.create(ticket=ticket, sender=self.admin, body=body, is_staff_reply=True)
        if ago:
            TicketMessage.objects.filter(pk=msg.pk).update(created_at=timezone.now() - ago)
        Ticket.objects.filter(pk=ticket.pk).update(status=Ticket.Status.ANSWERED)

    # ---------------------------------------------------------------- ساخت
    def test_create_with_category_and_child(self):
        res = self.create(childId=self.kid.id)
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        self.assertEqual((data["category"], data["categoryLabel"]), ("billing", "اشتراک و پرداخت"))
        self.assertEqual((data["childName"], data["status"], data["priority"]), ("سارا", "open", "normal"))
        self.assertTrue(data["code"].startswith("LK-"))
        self.assertEqual([m["fromStaff"] for m in data["thread"]], [False])
        self.assertTrue(data["canReply"])
        self.assertFalse(data["canRate"])

    def test_child_must_belong_to_the_parent(self):
        self.assertEqual(self.create(childId=self.stranger_kid.id).status_code, 400)
        self.assertFalse(Ticket.objects.exists())

    def test_too_short_is_rejected(self):
        self.assertEqual(self.create(subject="سل").status_code, 400)
        self.assertEqual(self.create(body="کوتاه").status_code, 400)
        self.assertEqual(self.create(category="nope").status_code, 400)

    def test_subscriber_gets_high_priority(self):
        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        self.assertEqual(self.create().json()["data"]["priority"], "high")
        self.assertTrue(self.api.get("/api/v1/tickets").json()["data"]["priority"])

    def test_daily_limit(self):
        for _ in range(8):
            self.assertEqual(self.create().status_code, 201)
        self.assertEqual(self.create().status_code, 429)

    # ---------------------------------------------------------------- فهرست و خوانده‌نشده
    def test_list_counts_unread_and_filters(self):
        first = Ticket.objects.get(pk=self.create().json()["data"]["id"])
        self.create(subject="سؤال درباره‌ی گزارش", category="reports")
        self.staff_reply(first)
        data = self.api.get("/api/v1/tickets").json()["data"]
        self.assertEqual(data["counts"], {"all": 2, "open": 1, "answered": 1, "closed": 0})
        self.assertEqual(data["unread"], 1)
        row = next(i for i in data["items"] if i["id"] == first.id)
        self.assertEqual((row["unread"], row["lastFromStaff"], row["messages"]), (1, True, 2))
        self.assertEqual(row["preview"], "بررسی شد؛ فعال است.")
        self.assertEqual(len(self.api.get("/api/v1/tickets?status=answered").json()["data"]["items"]), 1)
        self.assertEqual(len(data["categories"]), len(Ticket.Category.choices))

        # باز کردن = خواندن
        self.api.get(f"/api/v1/tickets/{first.id}")
        self.assertEqual(self.api.get("/api/v1/tickets").json()["data"]["unread"], 0)

    def test_only_own_tickets(self):
        ticket = Ticket.objects.get(pk=self.create().json()["data"]["id"])
        other = APIClient()
        other.force_authenticate(self.other)
        self.assertEqual(other.get(f"/api/v1/tickets/{ticket.id}").status_code, 404)
        self.assertEqual(other.post(f"/api/v1/tickets/{ticket.id}/reply", {"body": "سلام"}, format="json").status_code, 404)
        self.assertEqual(other.get("/api/v1/tickets").json()["data"]["counts"]["all"], 0)

    # ---------------------------------------------------------------- گفت‌وگو، بستن، امتیاز
    def test_reply_reopens_and_closed_cannot_be_replied(self):
        ticket = Ticket.objects.get(pk=self.create().json()["data"]["id"])
        self.staff_reply(ticket)
        res = self.api.post(f"/api/v1/tickets/{ticket.id}/reply", {"body": "ممنون، ولی هنوز فعال نیست."}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["data"]["status"], "open")
        self.assertEqual(len(res.json()["data"]["thread"]), 3)

        closed = self.api.post(f"/api/v1/tickets/{ticket.id}/close").json()["data"]
        self.assertEqual((closed["status"], closed["canReply"]), ("closed", False))
        self.assertTrue(closed["closedFa"])
        self.assertEqual(self.api.post(f"/api/v1/tickets/{ticket.id}/reply", {"body": "سلام"}, format="json").status_code, 400)

    def test_rating_needs_a_staff_answer(self):
        ticket = Ticket.objects.get(pk=self.create().json()["data"]["id"])
        self.assertEqual(self.api.post(f"/api/v1/tickets/{ticket.id}/rate", {"rating": 5}, format="json").status_code, 400)
        self.staff_reply(ticket)
        self.assertEqual(self.api.post(f"/api/v1/tickets/{ticket.id}/rate", {"rating": 9}, format="json").status_code, 400)
        data = self.api.post(f"/api/v1/tickets/{ticket.id}/rate", {"rating": 5, "comment": "سریع بود"},
                             format="json").json()["data"]
        self.assertEqual((data["rating"], data["ratingComment"], data["canRate"]), (5, "سریع بود", False))

    def test_old_staff_reply_before_last_visit_is_not_unread(self):
        ticket = Ticket.objects.get(pk=self.create().json()["data"]["id"])
        Ticket.objects.filter(pk=ticket.pk).update(user_seen_at=timezone.now())
        self.staff_reply(ticket, ago=timedelta(hours=1))
        self.assertEqual(self.api.get("/api/v1/tickets").json()["data"]["unread"], 0)
