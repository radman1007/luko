"""پنلِ ادمین: رمزِ خوانا برای پشتیبانی، و بسته بودنش برای بقیه."""

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory, TestCase

from apps.accounts.admin import SUPPORT_SECTION, PasswordVaultAdmin, UserAdmin
from apps.accounts.models import PasswordVault, User
from apps.accounts.passwords import set_password


class AdminPasswordTests(TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.rf = RequestFactory()
        self.user_admin = UserAdmin(User, self.site)
        self.parent = User.objects.create(phone="09121110000", role=User.Role.PARENT)
        set_password(self.parent, "raz12345")
        self.superadmin = User.objects.create(
            phone="09120000001", role=User.Role.TEAM_ADMIN,
            is_staff=True, is_superuser=True,
        )
        self.staff = User.objects.create(
            phone="09120000002", role=User.Role.TEAM_ADMIN, is_staff=True,
        )

    def _request(self, who):
        request = self.rf.get("/admin/accounts/user/1/change/")
        request.user = who
        return request

    def test_shows_readable_password(self):
        self.assertIn("raz12345", self.user_admin.support_password(self.parent))

    def test_hash_still_works_for_login(self):
        self.parent.refresh_from_db()
        self.assertTrue(self.parent.check_password("raz12345"))
        self.assertNotIn("raz12345", self.parent.password)

    def test_section_visible_for_superuser(self):
        names = [fs[0] for fs in self.user_admin.get_fieldsets(
            self._request(self.superadmin), self.parent)]
        self.assertIn(SUPPORT_SECTION, names)

    def test_section_hidden_for_plain_staff(self):
        names = [fs[0] for fs in self.user_admin.get_fieldsets(
            self._request(self.staff), self.parent)]
        self.assertNotIn(SUPPORT_SECTION, names)

    def test_no_password_without_vault(self):
        bare = User.objects.create(phone="09121110009", role=User.Role.PARENT)
        self.assertIn("ثبت نشده", self.user_admin.support_password(bare))

    def test_tampered_vault_reports_instead_of_crashing(self):
        vault = PasswordVault.objects.get(user=self.parent)
        vault.sealed = vault.sealed[:-4] + "0000"
        vault.save(update_fields=["sealed"])
        self.assertIn("کلیدِ گاوصندوق", self.user_admin.support_password(self.parent))

    def test_vault_list_is_superuser_only(self):
        vault_admin = PasswordVaultAdmin(PasswordVault, self.site)
        for allowed, who in ((True, self.superadmin), (False, self.staff)):
            with self.subTest(who=who.phone):
                request = self._request(who)
                self.assertIs(vault_admin.has_view_permission(request), allowed)
                self.assertIs(vault_admin.has_module_permission(request), allowed)
                self.assertIs(vault_admin.has_change_permission(request), allowed)
                self.assertIs(vault_admin.has_delete_permission(request), allowed)
        self.assertFalse(vault_admin.has_add_permission(self._request(self.superadmin)))

    def test_password_change_updates_vault(self):
        set_password(self.parent, "razeh-no")
        self.assertIn("razeh-no", self.user_admin.support_password(self.parent))
        self.assertEqual(PasswordVault.objects.filter(user=self.parent).count(), 1)
