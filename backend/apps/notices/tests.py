from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.parent.models import Notification

from .models import Broadcast, KidNotice
from .services import reach, send_broadcast


class BroadcastTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.kids = [User.objects.create_user(f"0912000910{i}", role="student", first_name=f"بچه{i}")
                     for i in range(3)]
        self.off_kid = User.objects.create_user("09120009109", role="student", is_active=False)
        self.parent = User.objects.create_user("09120009110", role="parent")
        self.admin = User.objects.create_superuser("09120009199", "Strong-Pass-1")

    def test_students_get_inbox_rows_and_only_students(self):
        everyone = User.objects.all()
        b = send_broadcast(audience="students", recipients=everyone, title="قسمتِ تازه",
                           body="پادکستِ امروز آمد", link="/luko-podcast", sent_by=self.admin)
        self.assertEqual(b.recipients, 3)                       # نه والد، نه بچه‌ی غیرفعال
        self.assertEqual(KidNotice.objects.count(), 3)
        self.assertFalse(KidNotice.objects.filter(user=self.off_kid).exists())
        self.assertFalse(Notification.objects.exists())
        self.assertEqual(reach(b), {"delivered": 3, "read": 0})

    def test_parents_get_panel_notifications(self):
        b = send_broadcast(audience="parents", recipients=User.objects.all(), title="به‌روزرسانی",
                           body="بخشِ تازه", link="/parent-panel")
        self.assertEqual(b.recipients, 1)
        n = Notification.objects.get()
        self.assertEqual((n.user_id, n.kind, n.link), (self.parent.id, "announcement", "/parent-panel"))
        self.assertFalse(KidNotice.objects.exists())
        # والد در پنلش می‌بیند
        self.api.force_authenticate(self.parent)
        items = self.api.get("/api/v1/parent/notifications").json()["data"]["items"]
        self.assertIn("به‌روزرسانی", [i["title"] for i in items])

    def test_kid_inbox_lists_and_marks_read(self):
        send_broadcast(audience="students", recipients=User.objects.filter(pk=self.kids[0].pk), title="سلام")
        self.api.force_authenticate(self.kids[0])
        data = self.api.get("/api/v1/notices").json()["data"]
        self.assertEqual((data["unread"], data["items"][0]["title"]), (1, "سلام"))
        self.assertIn("امروز", data["items"][0]["at"])
        self.assertEqual(self.api.post("/api/v1/notices/read").status_code, 200)
        self.assertEqual(self.api.get("/api/v1/notices").json()["data"]["unread"], 0)

    def test_inbox_is_private_and_student_only(self):
        send_broadcast(audience="students", recipients=User.objects.filter(pk=self.kids[0].pk), title="فقط برای اولی")
        self.api.force_authenticate(self.kids[1])
        self.assertEqual(self.api.get("/api/v1/notices").json()["data"]["items"], [])
        self.api.force_authenticate(self.parent)
        self.assertEqual(self.api.get("/api/v1/notices").status_code, 403)
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get("/api/v1/notices").status_code, 401)
