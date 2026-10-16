"""
پرداخت با زیبال در برابرِ یک زیبالِ ساختگی که رفتارِ مستند را دارد (help.zibal.ir/ipg):
request → trackId، verify یک‌بار ۱۰۰ و بعد ۲۰۱ (قبلاً تأیید شده)، پرداخت‌نشده ۲۰۲، inquiry با status
(‎-1 در انتظار، ۱ تأییدشده، ۲ تأییدنشده، ۳ لغو). هیچ درخواستی به اینترنت نمی‌رود.
"""
from datetime import timedelta
from unittest import mock
from urllib.parse import parse_qs, urlparse

import requests
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.parent.models import ParentChild

from . import services, tasks
from .models import Payment, Plan

MERCHANT = "test-merchant-id"


class FakeResponse:
    def __init__(self, status_code, data):
        self.status_code = status_code
        self._data = data
        self.text = str(data)

    def json(self):
        return self._data


class FakeZibal:
    def __init__(self):
        self.tx = {}
        self.calls = []
        self.down = False
        self.lose_next_verify = False
        self.amount_override = None
        self.request_result = 100
        #: verify با این‌که پول آمده «پرداخت نشده» می‌گوید (خطای درگاه)
        self.verify_broken = False
        self.next_track = 3_000_000_000

    # --- کارهای «خریدار» در صفحه‌ی بانک
    def pay(self, track):
        self.tx[int(track)]["status"] = 2

    def cancel(self, track):
        self.tx[int(track)]["status"] = 3

    def post(self, url, json=None, timeout=None, headers=None):
        path = url.split("gateway.zibal.ir")[-1]
        self.calls.append((path, json))
        if self.down:
            raise requests.ConnectionError("down")
        if json.get("merchant") != MERCHANT:
            return FakeResponse(200, {"result": 102, "message": "merchant یافت نشد"})
        if path == "/v1/request":
            if self.request_result != 100:
                return FakeResponse(200, {"result": self.request_result, "message": "ip"})
            if json["amount"] < 1000:
                return FakeResponse(200, {"result": 105, "message": "amount"})
            self.next_track += 1
            self.tx[self.next_track] = {"amount": json["amount"], "status": -1, "order": json.get("orderId")}
            return FakeResponse(200, {"result": 100, "trackId": self.next_track, "message": "success"})
        t = self.tx.get(json.get("trackId"))
        if t is None:
            return FakeResponse(200, {"result": 203, "message": "trackId نامعتبر"})
        amount = self.amount_override or t["amount"]
        paid = {"amount": amount, "refNumber": 8790123, "cardNumber": "621986****1234", "orderId": t["order"],
                "paidAt": "2026-10-16T10:00:00.000000"}
        if path == "/v1/verify":
            if t["status"] == 1:
                return FakeResponse(200, {"result": 201, "message": "قبلا تایید شده"})
            if t["status"] != 2 or self.verify_broken:
                return FakeResponse(200, {"result": 202, "status": t["status"], "message": "پرداخت نشده"})
            t["status"] = 1
            if self.lose_next_verify:
                self.lose_next_verify = False
                raise requests.ReadTimeout("lost")
            return FakeResponse(200, {"result": 100, "status": 1, "message": "success", **paid})
        if path == "/v1/inquiry":
            body = {"result": 100, "status": t["status"], "message": "success", "amount": amount,
                    "orderId": t["order"], "createdAt": "2026-10-16T09:59:00"}
            if t["status"] in (1, 2):
                body.update(paid)
            return FakeResponse(200, body)
        return FakeResponse(404, {})


@override_settings(ZIBAL_MERCHANT=MERCHANT, ZIBAL_BASE_URL="https://gateway.zibal.ir",
                   SITE_URL="https://my.luko.ir", ZIBAL_SITE_URL="https://panel.luko.ir", PAYMENT_GATEWAY="zibal",
                   ALLOWED_HOSTS=["testserver", "my.luko.ir", "panel.luko.ir"])
class ZibalTests(TestCase):
    def setUp(self):
        cache.clear()
        self.zibal = FakeZibal()
        # هر دو کلاینت همان ماژولِ requests را دارند؛ یک وصله با مسیریابی (وندار نباید صدا زده شود)
        def post(url, **kwargs):
            if "gateway.zibal.ir" not in url:
                raise AssertionError(f"unexpected gateway call: {url}")
            return self.zibal.post(url, **kwargs)

        patcher = mock.patch("apps.billing.zibal.requests.post", side_effect=post)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.parent = User.objects.create(phone="09120000001", role=User.Role.PARENT, first_name="مادر")
        self.child = User.objects.create(phone="09120000003", role=User.Role.STUDENT, first_name="سارا")
        ParentChild.objects.create(parent=self.parent, child=self.child)
        self.monthly = Plan.objects.get(code="monthly")
        self.api = APIClient()
        self.api.force_authenticate(self.parent)

    def checkout(self):
        res = self.api.post("/api/v1/billing/checkout", {"childId": str(self.child.id), "plan": "monthly"},
                            format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return Payment.objects.get(pk=res.json()["data"]["paymentId"]), res.json()["data"]

    def callback(self, track, success="1", status="2"):
        return APIClient().get("/api/v1/billing/callback/zibal",
                               {"trackId": track, "success": success, "status": status, "orderId": "x"})

    def test_checkout_sends_rial_amount_callback_order_and_mobile(self):
        payment, data = self.checkout()
        path, body = self.zibal.calls[0]
        self.assertEqual(path, "/v1/request")
        self.assertEqual(body["amount"], self.monthly.price_toman * 10)
        # زیبال callbackUrl را فقط روی دامنه‌ی ثبت‌شده‌ی درگاه می‌پذیرد
        self.assertEqual(body["callbackUrl"], "https://panel.luko.ir/api/v1/billing/callback/zibal")
        self.assertEqual(body["orderId"], payment.factor_number)
        self.assertEqual(body["mobile"], "09120000001")
        self.assertEqual(payment.gateway, Payment.Gateway.ZIBAL)
        self.assertEqual(data["gateway"], "zibal")
        self.assertEqual(data["payUrl"], f"https://panel.luko.ir/api/v1/billing/zibal/go/{payment.token}")

    def test_go_page_sends_the_registered_domain_as_referer(self):
        payment, _ = self.checkout()
        res = APIClient().get(f"/api/v1/billing/zibal/go/{payment.token}")
        self.assertEqual(res.status_code, 200)
        html = res.content.decode()
        self.assertIn(f'href="https://gateway.zibal.ir/start/{payment.token}"', html)
        self.assertIn('referrerpolicy="origin"', html)
        self.assertEqual(res["Cache-Control"], "no-store")
        # پرداختِ تمام‌شده، ناشناخته یا نامعتبر: بازکنِ آزادِ نشانی نیست
        self.zibal.pay(payment.token)
        self.callback(payment.token)
        for track in (payment.token, "123", "x<script>"):
            res = APIClient().get(f"/api/v1/billing/zibal/go/{track}")
            self.assertEqual(res.status_code, 302)
            self.assertTrue(res["Location"].startswith("https://my.luko.ir/parent-panel/subscription/result"))

    def test_parent_returns_to_the_domain_they_paid_from(self):
        api = APIClient(HTTP_HOST="panel.luko.ir")
        api.force_authenticate(self.parent)
        res = api.post("/api/v1/billing/checkout", {"childId": str(self.child.id), "plan": "monthly"}, format="json")
        payment = Payment.objects.get(pk=res.json()["data"]["paymentId"])
        self.assertEqual(payment.return_host, "panel.luko.ir")
        self.zibal.pay(payment.token)
        location = self.callback(payment.token)["Location"]
        self.assertTrue(location.startswith("https://panel.luko.ir/parent-panel/subscription/result?payment="))
        # پرداختِ شروع‌شده از my.luko.ir (یا اپ) به همان برمی‌گردد
        mine, _ = self.checkout()
        self.zibal.pay(mine.token)
        self.assertTrue(self.callback(mine.token)["Location"].startswith("https://my.luko.ir/"))

    def test_successful_payment_activates_subscription(self):
        payment, _ = self.checkout()
        self.zibal.pay(payment.token)
        res = self.callback(payment.token)
        self.assertEqual(res.status_code, 302)
        self.assertEqual(parse_qs(urlparse(res["Location"]).query)["payment"], [str(payment.id)])
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)
        self.assertEqual(payment.trans_id, "8790123")
        self.assertEqual(payment.card_number, "621986****1234")
        self.assertTrue(services.subscription(self.child).active)

    def test_repeated_callback_verifies_once(self):
        payment, _ = self.checkout()
        self.zibal.pay(payment.token)
        for _ in range(3):
            self.callback(payment.token)
        self.assertEqual(len([c for c in self.zibal.calls if c[0] == "/v1/verify"]), 1)
        self.assertEqual(Payment.objects.filter(status=Payment.Status.PAID).count(), 1)

    def test_cancelled_payment_fails_immediately(self):
        payment, _ = self.checkout()
        self.zibal.cancel(payment.token)
        self.callback(payment.token, success="0", status="3")
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertEqual(payment.message, "پرداخت را لغو کردید")
        self.assertFalse(services.subscription(self.child).active)

    def test_forged_success_without_payment_does_not_activate(self):
        payment, _ = self.checkout()
        self.callback(payment.token, success="1", status="1")      # مرورگر دروغ می‌گوید
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)    # هنوز در مهلتِ درگاه
        self.assertFalse(services.subscription(self.child).active)
        Payment.objects.filter(pk=payment.pk).update(created_at=timezone.now() - timedelta(minutes=40))
        tasks.reconcile_pending()
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.EXPIRED)

    def test_lost_verify_response_is_recovered_by_inquiry(self):
        payment, _ = self.checkout()
        self.zibal.pay(payment.token)
        self.zibal.lose_next_verify = True
        self.callback(payment.token)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)    # پاسخِ verify گم شد
        Payment.objects.filter(pk=payment.pk).update(created_at=timezone.now() - timedelta(minutes=5))
        tasks.reconcile_pending()
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)       # inquiry: status=1
        self.assertEqual(payment.trans_id, "8790123")

    def test_already_verified_answer_reads_amount_from_inquiry(self):
        payment, _ = self.checkout()
        self.zibal.tx[int(payment.token)]["status"] = 1               # کسِ دیگری قبلاً verify کرده
        self.callback(payment.token)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)

    def test_browser_never_returned_is_completed_by_reconcile(self):
        payment, _ = self.checkout()
        self.zibal.pay(payment.token)
        Payment.objects.filter(pk=payment.pk).update(created_at=timezone.now() - timedelta(minutes=3))
        tasks.reconcile_pending()
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)

    def test_network_down_during_verify_is_recovered_later(self):
        payment, _ = self.checkout()
        self.zibal.pay(payment.token)
        self.zibal.down = True
        self.callback(payment.token)
        self.zibal.down = False
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)    # قطعیِ شبکه «ناموفق» نمی‌کند
        Payment.objects.filter(pk=payment.pk).update(created_at=timezone.now() - timedelta(minutes=5))
        tasks.reconcile_pending()
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PAID)

    def test_unverified_after_the_window_fails_with_refund_note(self):
        payment, _ = self.checkout()
        self.zibal.pay(payment.token)
        self.zibal.verify_broken = True
        self.callback(payment.token)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)    # در مهلتِ ۲۰ دقیقه
        Payment.objects.filter(pk=payment.pk).update(created_at=timezone.now() - timedelta(minutes=40))
        tasks.reconcile_pending()
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertIn("برمی‌گردد", payment.message)
        self.assertFalse(services.subscription(self.child).active)

    def test_amount_mismatch_never_activates(self):
        payment, _ = self.checkout()
        self.zibal.pay(payment.token)
        self.zibal.amount_override = 1000
        self.callback(payment.token)
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertFalse(services.subscription(self.child).active)

    def test_request_rejected_by_gateway_is_a_clear_error(self):
        self.zibal.request_result = 115
        res = self.api.post("/api/v1/billing/checkout", {"childId": str(self.child.id), "plan": "monthly"},
                            format="json")
        self.assertEqual(res.status_code, 502)
        payment = Payment.objects.get()
        self.assertEqual(payment.status, Payment.Status.FAILED)
        self.assertIn("IP", payment.message)

    def test_gateway_down_on_checkout(self):
        self.zibal.down = True
        res = self.api.post("/api/v1/billing/checkout", {"childId": str(self.child.id), "plan": "monthly"},
                            format="json")
        self.assertEqual(res.status_code, 503)

    @override_settings(ZIBAL_MERCHANT="")
    def test_missing_merchant_is_a_clear_error(self):
        res = self.api.post("/api/v1/billing/checkout", {"childId": str(self.child.id), "plan": "monthly"},
                            format="json")
        self.assertEqual(res.status_code, 502)

    def test_unknown_or_malformed_track_redirects_with_error(self):
        for track in ("999", "abc", ""):
            res = self.callback(track)
            self.assertEqual(res.status_code, 302)
            self.assertIn("error=unknown", res["Location"])

    def test_vandar_payment_is_not_found_by_the_zibal_callback(self):
        payment = Payment.objects.create(
            payer=self.parent, child=self.child, plan=self.monthly, plan_title="ماهانه", duration_days=30,
            amount_toman=199_000, amount_rial=1_990_000, factor_number="LKV1", token="3000000001",
            gateway=Payment.Gateway.VANDAR)
        res = self.callback(payment.token)
        self.assertIn("error=unknown", res["Location"])
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.Status.PENDING)


class GatewaySettingTests(TestCase):
    @override_settings(PAYMENT_GATEWAY="vandar")
    def test_vandar_can_still_be_chosen(self):
        self.assertEqual(services.active_gateway(), "vandar")

    @override_settings(PAYMENT_GATEWAY="something-else")
    def test_unknown_value_falls_back_to_zibal(self):
        self.assertEqual(services.active_gateway(), "zibal")
