"""
قواعدِ ثبت‌نام و ورودِ خانواده.

سه چیز این‌جا قفل می‌شود:
  ۱. یک شماره، چند بچه — رمز آن‌ها را از هم جدا می‌کند.
  ۲. والد و بچه‌ی هم‌شماره خودکار به هم وصل می‌شوند.
  ۳. ورودِ تازه نشستِ دستگاهِ قبلی را می‌بندد.
"""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.otp import _as_str, _conn
from apps.accounts.passwords import (get_or_create_account, link_family, set_password,
                                     student_by_password)
from apps.parent.models import ParentChild

PHONE = "09121300001"


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class FamilyLinkTests(TestCase):
    def test_child_registering_joins_the_parent_of_the_same_phone(self):
        parent = User.objects.create(phone=PHONE, role=User.Role.PARENT)
        child, _ = get_or_create_account(PHONE, User.Role.STUDENT, "سارا", grade=1)
        self.assertTrue(ParentChild.objects.filter(parent=parent, child=child).exists())

    def test_parent_registering_picks_up_existing_children(self):
        a = User.objects.create(phone=PHONE, role=User.Role.STUDENT, first_name="سارا")
        b = User.objects.create(phone=PHONE, role=User.Role.STUDENT, first_name="نیما")
        parent, _ = get_or_create_account(PHONE, User.Role.PARENT, "مادر")
        linked = set(ParentChild.objects.filter(parent=parent).values_list("child_id", flat=True))
        self.assertEqual(linked, {a.id, b.id})

    def test_linking_twice_does_not_duplicate(self):
        parent = User.objects.create(phone=PHONE, role=User.Role.PARENT)
        child = User.objects.create(phone=PHONE, role=User.Role.STUDENT)
        link_family(child)
        link_family(child)
        self.assertEqual(ParentChild.objects.filter(parent=parent, child=child).count(), 1)

    def test_a_child_on_another_phone_is_not_linked(self):
        User.objects.create(phone=PHONE, role=User.Role.PARENT)
        other, _ = get_or_create_account("09121300099", User.Role.STUDENT, "غریبه")
        self.assertFalse(ParentChild.objects.filter(child=other).exists())


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class SiblingLoginTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.sara = User.objects.create(phone=PHONE, role=User.Role.STUDENT, first_name="سارا")
        self.nima = User.objects.create(phone=PHONE, role=User.Role.STUDENT, first_name="نیما")
        set_password(self.sara, "raz-sara")
        set_password(self.nima, "raz-nima")

    def _login(self, password, role="student"):
        return self.api.post("/api/v1/auth/login",
                             {"phone": PHONE, "password": password, "role": role},
                             format="json")

    def test_each_sibling_reaches_their_own_account(self):
        self.assertEqual(self._login("raz-sara").json()["data"]["user"]["firstName"], "سارا")
        self.assertEqual(self._login("raz-nima").json()["data"]["user"]["firstName"], "نیما")

    def test_a_wrong_password_matches_nobody(self):
        self.assertEqual(self._login("raz-hich").status_code, 400)

    def test_lookup_helper_ignores_accounts_without_a_password(self):
        User.objects.create(phone=PHONE, role=User.Role.STUDENT, first_name="بی‌رمز")
        self.assertEqual(student_by_password(PHONE, "raz-sara"), self.sara)

    def test_parent_password_does_not_open_a_child_account(self):
        parent = User.objects.create(phone=PHONE, role=User.Role.PARENT)
        set_password(parent, "raz-madar")
        self.assertEqual(self._login("raz-madar", role="student").status_code, 400)
        self.assertEqual(self._login("raz-madar", role="parent").status_code, 200)

    def test_child_password_does_not_open_the_parent_account(self):
        parent = User.objects.create(phone=PHONE, role=User.Role.PARENT)
        set_password(parent, "raz-madar")
        self.assertEqual(self._login("raz-sara", role="parent").status_code, 400)


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class SingleDeviceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(phone="09121300007", role=User.Role.STUDENT)
        set_password(self.user, "raz12345")

    def _login(self):
        return APIClient().post("/api/v1/auth/login",
                                {"phone": "09121300007", "password": "raz12345",
                                 "role": "student"}, format="json").json()["data"]

    def _me(self, token):
        api = APIClient()
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return api.get("/api/v1/auth/me")

    def test_a_fresh_login_keeps_working(self):
        self.assertEqual(self._me(self._login()["accessToken"]).status_code, 200)

    def test_logging_in_elsewhere_closes_the_first_session(self):
        first = self._login()["accessToken"]
        self._login()                       # همان بچه روی گوشیِ دیگر
        self.assertEqual(self._me(first).status_code, 401)

    def test_the_newest_session_survives(self):
        self._login()
        second = self._login()["accessToken"]
        self.assertEqual(self._me(second).status_code, 200)

    def test_a_stale_refresh_token_cannot_mint_access(self):
        old = self._login()["refreshToken"]
        self._login()
        res = APIClient().post("/api/v1/auth/refresh", {"refreshToken": old}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_refresh_on_the_live_session_works(self):
        tokens = self._login()
        res = APIClient().post("/api/v1/auth/refresh",
                               {"refreshToken": tokens["refreshToken"]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._me(res.json()["data"]["accessToken"]).status_code, 200)

    def test_refreshing_does_not_evict_the_current_device(self):
        """تمدید نباید خودش نشست را ببندد، وگرنه هر تمدید کاربر را بیرون می‌انداخت."""
        tokens = self._login()
        APIClient().post("/api/v1/auth/refresh",
                         {"refreshToken": tokens["refreshToken"]}, format="json")
        self.assertEqual(self._me(tokens["accessToken"]).status_code, 200)


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class GradeTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_grade_is_stored_at_signup(self):
        res = self.api.post("/api/v1/auth/register",
                            {"phone": "09121300011", "firstName": "سارا",
                             "role": "student", "grade": 3}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(phone="09121300011").grade, 3)

    def test_grade_comes_back_in_the_user_payload(self):
        res = self.api.post("/api/v1/auth/register",
                            {"phone": "09121300012", "role": "student", "grade": 2},
                            format="json")
        self.assertEqual(res.json()["data"]["user"]["grade"], 2)

    def test_missing_grade_defaults_to_one(self):
        self.api.post("/api/v1/auth/register",
                      {"phone": "09121300013", "role": "student"}, format="json")
        self.assertEqual(User.objects.get(phone="09121300013").grade, 1)

    def test_an_impossible_grade_is_refused(self):
        res = self.api.post("/api/v1/auth/register",
                            {"phone": "09121300014", "role": "student", "grade": 9},
                            format="json")
        self.assertEqual(res.status_code, 400)


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class RefreshGuardTests(TestCase):
    """
    `/auth/refresh` بی‌توکن نباید چیزی بدهد.

    پارسر کلیدها را snake_case می‌کند، پس `refreshToken` خوانده نمی‌شد و
    `RefreshToken(None)` به‌جای خطا یک توکنِ خالیِ تازه می‌ساخت — یعنی این
    مسیر هیچ چیزی را تأیید نمی‌کرد.
    """

    def _post(self, body):
        return APIClient().post("/api/v1/auth/refresh", body, format="json")

    def test_an_empty_body_is_refused(self):
        self.assertEqual(self._post({}).status_code, 401)

    def test_a_blank_token_is_refused(self):
        self.assertEqual(self._post({"refreshToken": ""}).status_code, 401)

    def test_garbage_is_refused(self):
        self.assertEqual(self._post({"refreshToken": "not-a-token"}).status_code, 401)

    def test_a_real_token_still_works(self):
        user = User.objects.create(phone="09121300021", role=User.Role.STUDENT)
        set_password(user, "raz12345")
        tokens = APIClient().post("/api/v1/auth/login",
                                  {"phone": "09121300021", "password": "raz12345",
                                   "role": "student"}, format="json").json()["data"]
        self.assertEqual(self._post({"refreshToken": tokens["refreshToken"]}).status_code, 200)


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class OtpSiblingPickerTests(TestCase):
    """
    ورود با کدِ یک‌بارمصرف وقتی چند بچه یک شماره دارند.

    کدِ درست به‌تنهایی نمی‌گوید «کدام بچه»، پس فهرست برمی‌گردد و انتخاب
    با یک بلیتِ کوتاه‌عمر انجام می‌شود.
    """

    seq = 0

    def setUp(self):
        OtpSiblingPickerTests.seq += 1
        self.phone = f"091215000{OtpSiblingPickerTests.seq:02d}"
        conn = _conn()
        # سقفِ هر IP هم پاک می‌شود، وگرنه بعد از چند بار اجرای تست، شمارنده‌ی
        # 127.0.0.1 پر می‌ماند و درخواستِ کد ۴۲۹ می‌گیرد — پنجره‌اش یک ساعت
        # است، پس خودش هم زود باز نمی‌شود.
        conn.delete(f"otp:code:{self.phone}", f"otp:resend:{self.phone}",
                    f"otp:att:{self.phone}", "otp:ip:127.0.0.1")
        self.api = APIClient()

    def _code(self):
        self.api.post("/api/v1/auth/request-otp", {"phone": self.phone}, format="json")
        return _as_str(_conn().get(f"otp:code:{self.phone}"))

    def _verify(self):
        return self.api.post("/api/v1/auth/verify-otp",
                             {"phone": self.phone, "code": self._code(), "role": "student"},
                             format="json")

    def test_one_child_logs_straight_in(self):
        child = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="سارا")
        data = self._verify().json()["data"]
        self.assertEqual(data["user"]["id"], str(child.id))

    def test_no_account_creates_one(self):
        res = self._verify()
        self.assertEqual(res.status_code, 201)
        self.assertTrue(User.objects.filter(phone=self.phone, role=User.Role.STUDENT).exists())

    def test_two_children_return_a_picker(self):
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="سارا")
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="نیما")
        data = self._verify().json()["data"]
        self.assertEqual({c["firstName"] for c in data["chooseFrom"]}, {"سارا", "نیما"})
        self.assertTrue(data["ticket"])
        # هنوز واردِ هیچ حسابی نشده
        self.assertNotIn("accessToken", data)

    def test_choosing_with_the_ticket_logs_in(self):
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="سارا")
        nima = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="نیما")
        data = self._verify().json()["data"]
        res = self.api.post("/api/v1/auth/otp-choose",
                            {"ticket": data["ticket"], "userId": nima.id}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["user"]["firstName"], "نیما")

    def test_a_ticket_works_only_once(self):
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="سارا")
        nima = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="نیما")
        ticket = self._verify().json()["data"]["ticket"]
        body = {"ticket": ticket, "userId": nima.id}
        self.assertEqual(self.api.post("/api/v1/auth/otp-choose", body, format="json").status_code, 200)
        self.assertEqual(self.api.post("/api/v1/auth/otp-choose", body, format="json").status_code, 400)

    def test_a_made_up_ticket_is_refused(self):
        nima = User.objects.create(phone=self.phone, role=User.Role.STUDENT)
        res = self.api.post("/api/v1/auth/otp-choose",
                            {"ticket": "jaali", "userId": nima.id}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_the_ticket_cannot_reach_another_phone(self):
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="سارا")
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="نیما")
        stranger = User.objects.create(phone="09121509999", role=User.Role.STUDENT)
        ticket = self._verify().json()["data"]["ticket"]
        res = self.api.post("/api/v1/auth/otp-choose",
                            {"ticket": ticket, "userId": stranger.id}, format="json")
        self.assertEqual(res.status_code, 404)


class LogoutTests(TestCase):
    """
    خروجِ دستی باید واقعاً نشست را ببندد.

    قرارِ محصول: بچه دو هفته وارد می‌ماند «مگر با گوشیِ دیگری وارد شود یا
    خودش خروج بزند». اگر خروج فقط توکن را از گوشی پاک کند، نسخه‌ی
    باقی‌مانده‌ی refresh تا دو هفته حساب را باز می‌کند.
    """

    def setUp(self):
        self.api = APIClient()
        self.phone = "09121504422"
        self.child = User.objects.create(phone=self.phone, role=User.Role.STUDENT,
                                         first_name="سارا")
        set_password(self.child, "raz-sara")

    def _login(self, password="raz-sara"):
        res = self.api.post("/api/v1/auth/login",
                            {"phone": self.phone, "password": password, "role": "student"},
                            format="json")
        return res.json()["data"]

    def _logout(self, access, refresh):
        # کلاینت عمداً هدرِ Authorization نمی‌فرستد؛ شناسه از خودِ refresh است
        return self.api.post("/api/v1/auth/logout", {"refreshToken": refresh}, format="json")

    def _me(self, access):
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        res = self.api.get("/api/v1/auth/me")
        self.api.credentials()
        return res

    def _refresh(self, refresh):
        return self.api.post("/api/v1/auth/refresh", {"refreshToken": refresh}, format="json")

    def test_logging_out_answers_success(self):
        tokens = self._login()
        self.assertEqual(self._logout(tokens["accessToken"], tokens["refreshToken"]).status_code,
                         200)

    def test_the_refresh_token_dies_with_the_session(self):
        tokens = self._login()
        self.assertEqual(self._refresh(tokens["refreshToken"]).status_code, 200)
        self._logout(tokens["accessToken"], tokens["refreshToken"])
        self.assertEqual(self._refresh(tokens["refreshToken"]).status_code, 401)

    def test_the_access_token_dies_with_the_session(self):
        tokens = self._login()
        self.assertEqual(self._me(tokens["accessToken"]).status_code, 200)
        self._logout(tokens["accessToken"], tokens["refreshToken"])
        self.assertEqual(self._me(tokens["accessToken"]).status_code, 401)

    def test_logging_in_again_works_after_a_logout(self):
        tokens = self._login()
        self._logout(tokens["accessToken"], tokens["refreshToken"])
        again = self._login()
        self.assertEqual(self._me(again["accessToken"]).status_code, 200)

    def test_a_sibling_is_not_logged_out_too(self):
        nima = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="نیما")
        set_password(nima, "raz-nima")
        sara = self._login()
        brother = self._login("raz-nima")
        self._logout(sara["accessToken"], sara["refreshToken"])
        self.assertEqual(self._me(brother["accessToken"]).status_code, 200)

    def test_the_parent_on_the_same_phone_stays_in(self):
        parent = User.objects.create(phone=self.phone, role=User.Role.PARENT, first_name="پدر")
        set_password(parent, "raz-pedar")
        res = self.api.post("/api/v1/auth/login",
                            {"phone": self.phone, "password": "raz-pedar", "role": "parent"},
                            format="json")
        parent_tokens = res.json()["data"]
        child = self._login()
        self._logout(child["accessToken"], child["refreshToken"])
        self.assertEqual(self._me(parent_tokens["accessToken"]).status_code, 200)

    def test_logging_out_twice_is_harmless(self):
        tokens = self._login()
        self._logout(tokens["accessToken"], tokens["refreshToken"])
        # خروج بی‌اثر هم موفق جواب می‌دهد؛ کسی که خارج شده نباید خطا ببیند
        self.assertEqual(self._logout(tokens["accessToken"], tokens["refreshToken"]).status_code,
                         200)

    def test_logging_out_works_with_a_dead_access_token(self):
        """عمرِ access نیم ساعت است؛ خروج نباید به تازگی‌اش بند باشد."""
        tokens = self._login()
        res = self.api.post("/api/v1/auth/logout",
                            {"refreshToken": tokens["refreshToken"]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._refresh(tokens["refreshToken"]).status_code, 401)
        self.assertEqual(self._me(tokens["accessToken"]).status_code, 401)

    def test_a_stale_refresh_token_cannot_log_out_the_live_device(self):
        old = self._login()
        live = self._login()
        self.api.post("/api/v1/auth/logout", {"refreshToken": old["refreshToken"]}, format="json")
        self.assertEqual(self._me(live["accessToken"]).status_code, 200)

    def test_rubbish_does_not_break_logout(self):
        for body in ({}, {"refreshToken": ""}, {"refreshToken": "ashghal"}):
            self.assertEqual(
                self.api.post("/api/v1/auth/logout", body, format="json").status_code, 200)


class StartOnAMixedPhoneTests(TestCase):
    """
    `/auth/start` روی شماره‌ای که هم بچه‌ی رمزدار دارد هم بی‌رمز.

    این حالت واقعی است: بچه‌ای ثبت‌نام را نیمه‌کاره رها می‌کند و رمز
    نمی‌گذارد، بعد والد از پنل بچه‌ی دیگری روی همان شماره می‌سازد. اگر
    `start` فقط به «اولین حساب» نگاه کند، جوابش به ترتیبِ ردیف‌های
    دیتابیس بند است و می‌تواند بگوید «حساب ندارد» — آن‌وقت فرانت بچه‌ی
    رمزدار را به ثبت‌نام می‌فرستد و صفحه‌ی رمز را اصلاً نمی‌بیند.
    """

    def setUp(self):
        self.api = APIClient()
        self.phone = "09121507788"

    def _start(self, role="student"):
        res = self.api.post("/api/v1/auth/start", {"phone": self.phone, "role": role},
                            format="json")
        return res.json()["data"]["exists"]

    def test_a_password_less_account_alone_looks_new(self):
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="بی‌رمز")
        self.assertFalse(self._start())

    def test_the_password_less_one_does_not_hide_a_finished_account(self):
        # ترتیبِ ساخت عمداً همان ترتیبِ باگ است: بی‌رمز اول
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="بی‌رمز")
        ramzdar = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="رمزدار")
        set_password(ramzdar, "raz-bache")
        self.assertTrue(self._start())

    def test_the_same_holds_when_the_finished_account_came_first(self):
        ramzdar = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="رمزدار")
        set_password(ramzdar, "raz-bache")
        User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="بی‌رمز")
        self.assertTrue(self._start())

    def test_a_parent_on_the_phone_does_not_answer_for_the_child(self):
        parent = User.objects.create(phone=self.phone, role=User.Role.PARENT, first_name="پدر")
        set_password(parent, "raz-pedar")
        self.assertFalse(self._start("student"))
        self.assertTrue(self._start("parent"))

    def test_signup_still_resumes_the_half_finished_child(self):
        # `start` می‌گوید حساب هست، ولی راهِ ادامه‌ی حسابِ نیمه‌کاره باز می‌ماند
        bi_ramz = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name="بی‌رمز")
        ramzdar = User.objects.create(phone=self.phone, role=User.Role.STUDENT)
        set_password(ramzdar, "raz-bache")
        res = self.api.post("/api/v1/auth/register",
                            {"phone": self.phone, "role": "student", "firstName": "بی‌رمز",
                             "grade": 2}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(int(res.json()["data"]["user"]["id"]), bi_ramz.id)

    def test_signup_is_refused_once_every_child_has_a_password(self):
        for name in ("سارا", "نیما"):
            child = User.objects.create(phone=self.phone, role=User.Role.STUDENT, first_name=name)
            set_password(child, f"raz-{name}")
        res = self.api.post("/api/v1/auth/register",
                            {"phone": self.phone, "role": "student", "firstName": "نفوذی",
                             "grade": 1}, format="json")
        self.assertEqual(res.status_code, 409)
