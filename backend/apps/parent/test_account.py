"""تنظیماتِ پنلِ والدین: مشخصاتِ کاملِ فرزند، ویرایشِ نام و مدرسه، رمزِ والد."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.passwords import set_password
from apps.billing.services import gift_subscription

from .models import ParentChild


class AccountTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.parent = User.objects.create(phone="09121119201", role=User.Role.PARENT, first_name="مریم")
        cls.kid = User.objects.create(phone="09121119202", role=User.Role.STUDENT, first_name="سارا", grade=2)
        cls.stranger = User.objects.create(phone="09121119203", role=User.Role.STUDENT, first_name="نیما")
        cls.admin = User.objects.create(phone="09121119204", role=User.Role.TEAM_ADMIN, is_staff=True)
        ParentChild.objects.create(parent=cls.parent, child=cls.kid, grade=2, school="مدرسه‌ی امید")

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.parent)

    def test_full_child_profile(self):
        data = self.api.get(f"/api/v1/parent/children/{self.kid.id}/profile").json()["data"]
        self.assertEqual((data["firstName"], data["gradeLabel"], data["school"]), ("سارا", "پایه‌ی دوم", "مدرسه‌ی امید"))
        self.assertEqual(data["phone"], "09121119202")
        self.assertTrue(data["joinedFa"])
        self.assertEqual(set(data["stats"]), {"coins", "points", "treasures", "gamesCompleted", "medals", "tasks",
                                              "streak", "paintings", "checkins"})
        self.assertEqual((data["subscription"]["active"], data["subscription"]["planTitle"]), (False, "رایگان"))

        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        sub = self.api.get(f"/api/v1/parent/children/{self.kid.id}/profile").json()["data"]["subscription"]
        self.assertTrue(sub["active"])
        self.assertGreater(sub["daysLeft"], 25)

    def test_only_own_children(self):
        self.assertEqual(self.api.get(f"/api/v1/parent/children/{self.stranger.id}/profile").status_code, 404)
        self.assertEqual(self.api.patch(f"/api/v1/parent/children/{self.stranger.id}", {"firstName": "x"},
                                        format="json").status_code, 404)

    def test_edit_name_and_school_but_not_grade(self):
        res = self.api.patch(f"/api/v1/parent/children/{self.kid.id}",
                             {"firstName": " سارینا ", "lastName": "احمدی", "school": "مدرسه‌ی نور", "grade": 5},
                             format="json")
        self.assertEqual(res.status_code, 200)
        self.kid.refresh_from_db()
        link = ParentChild.objects.get(child=self.kid)
        self.assertEqual((self.kid.first_name, self.kid.last_name, link.school), ("سارینا", "احمدی", "مدرسه‌ی نور"))
        self.assertEqual((self.kid.grade, link.grade), (2, 2))
        self.assertEqual(self.api.patch(f"/api/v1/parent/children/{self.kid.id}", {"firstName": "  "},
                                        format="json").status_code, 400)

    def test_password_change_needs_the_current_one(self):
        set_password(self.parent, "old-pass-1")
        url = "/api/v1/parent/password"
        self.assertTrue(self.api.get(url).json()["data"]["hasPassword"])
        self.assertEqual(self.api.post(url, {"current": "wrong", "password": "new-pass-2"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"current": "old-pass-1", "password": "111111"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"current": "old-pass-1", "password": "old-pass-1"}, format="json").status_code, 400)
        self.assertEqual(self.api.post(url, {"current": "old-pass-1", "password": "new-pass-2"}, format="json").status_code, 200)
        self.parent.refresh_from_db()
        self.assertTrue(self.parent.check_password("new-pass-2"))

    def test_first_password_without_current(self):
        url = "/api/v1/parent/password"
        self.assertFalse(self.api.get(url).json()["data"]["hasPassword"])
        self.assertEqual(self.api.post(url, {"password": "brand-new-9"}, format="json").status_code, 200)
        self.parent.refresh_from_db()
        self.assertTrue(self.parent.check_password("brand-new-9"))

    def test_kids_cannot_use_parent_settings(self):
        kid_api = APIClient()
        kid_api.force_authenticate(self.kid)
        self.assertEqual(kid_api.post("/api/v1/parent/password", {"password": "abc-def-1"}, format="json").status_code, 403)
