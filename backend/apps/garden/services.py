"""منطقِ باغچه — تنها منبعِ حقیقتِ شبنم/آب/کود/دانه/رشد و ریستِ فصلی."""
from __future__ import annotations

import random
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.common import cache

from . import constants as C
from .models import DewLogEntry, GardenShopItem, GardenState, Plant


# ---------- کمک‌کننده‌های خالص ----------
def max_water(plot_level: int) -> int:
    return C.WATER["base_max"] + (plot_level - 1) * C.WATER["per_plot_level"]


def slots(plot_level: int) -> int:
    return C.SLOTS_BASE + (plot_level - 1) * C.SLOTS_PER_LEVEL


def stage_of(care: int) -> int:
    return min(C.MAX_STAGE, care // C.CARE_PER_STAGE)


def settle_water(state: GardenState, now=None):
    """شارژِ آبِ فعلی را با پر شدنِ زمانی حساب می‌کند (بدون ذخیره)."""
    now = now or timezone.now()
    cap = max_water(state.plot_level)
    if state.water_charges >= cap:
        return cap, now
    elapsed = (now - state.last_refill_at).total_seconds()
    gained = int(elapsed // C.WATER["refill_seconds"])
    if gained <= 0:
        return state.water_charges, state.last_refill_at
    charges = min(cap, state.water_charges + gained)
    last = now if charges >= cap else state.last_refill_at + timedelta(
        seconds=gained * C.WATER["refill_seconds"]
    )
    return charges, last


# ---------- ساخت/دریافتِ باغچه ----------
def ensure_state(user) -> GardenState:
    state, created = GardenState.objects.get_or_create(
        user=user,
        defaults={"season": C.season_of(timezone.now())},
    )
    if created:
        Plant.objects.create(garden=state, kind="sunflower", care=2)
    return state


def _locked_state(user) -> GardenState:
    ensure_state(user)
    return GardenState.objects.select_for_update().get(user=user)


# ---------- ریستِ فصلی ----------
def apply_seasonal_reset(state: GardenState, now=None) -> bool:
    """
    اگر فصلِ تقویمی عوض شده باشد: باغچه ریست می‌شود (گیاهان پاک، فصل و تمِ جدید)
    ولی داراییِ کودک (شبنم/کود/دانه/سطح/تزئین) حفظ می‌ماند.
    """
    now = now or timezone.now()
    current = C.season_of(now)
    if current == state.season:
        return False
    state.plants.all().delete()
    state.season = current
    state.season_start_at = now
    state.water_charges = max_water(state.plot_level)
    state.last_refill_at = now
    state.last_watered_at = None
    state.save(update_fields=["season", "season_start_at", "water_charges",
                              "last_refill_at", "last_watered_at", "updated_at"])
    return True


# ---------- نمای کامل (cache‌شده) ----------
def build_state_view(user) -> dict:
    state = ensure_state(user)
    apply_seasonal_reset(state)
    now = timezone.now()
    water, _ = settle_water(state, now)
    cap = max_water(state.plot_level)
    next_refill = 0 if water >= cap else max(
        0, C.WATER["refill_seconds"] - int((now - state.last_refill_at).total_seconds())
    )
    plants = [
        {"id": str(p.id), "kind": p.kind, "care": p.care, "stage": stage_of(p.care)}
        for p in state.plants.all()
    ]
    dew_log = [
        {"amount": e.amount, "source": e.source, "at": int(e.created_at.timestamp() * 1000)}
        for e in state.user.dew_log.all()[: C.DEW_LOG_MAX]
    ]
    return {
        "dew": state.dew,
        "fertilizer": state.fertilizer,
        "seeds": state.seeds,
        "plants": plants,
        "plotLevel": state.plot_level,
        "decor": state.decor,
        "slots": slots(state.plot_level),
        "currentWater": water,
        "maxWater": cap,
        "nextRefillSeconds": next_refill,
        "season": {
            "season": state.season,
            "label": C.SEASON_LABELS[state.season],
            "progress": round(C.season_progress(now), 3),
        },
        "dewLog": dew_log,
    }


def get_state_view(user) -> dict:
    return cache.get_or_set(cache.garden_key(user.id), lambda: build_state_view(user),
                            cache.TTL_SHORT)


def _invalidate(user_id: int):
    cache.invalidate(cache.garden_key(user_id))


# ---------- grantها (از بازی‌ها/مأموریت‌ها/زمان/معلم/والدین) ----------
def _trim_dew_log(user):
    keep_ids = list(user.dew_log.values_list("id", flat=True)[: C.DEW_LOG_MAX])
    DewLogEntry.objects.filter(user=user).exclude(id__in=keep_ids).delete()


@transaction.atomic
def grant_dew(user, amount: int, source: str = "game") -> None:
    if amount <= 0:
        return
    state = _locked_state(user)
    state.dew += amount
    state.save(update_fields=["dew", "updated_at"])
    DewLogEntry.objects.create(user=user, amount=amount, source=source)
    _trim_dew_log(user)
    _invalidate(user.id)


@transaction.atomic
def grant_fertilizer(user, amount: int) -> None:
    if amount <= 0:
        return
    state = _locked_state(user)
    state.fertilizer += amount
    state.save(update_fields=["fertilizer", "updated_at"])
    _invalidate(user.id)


@transaction.atomic
def grant_seeds(user, amount: int) -> None:
    if amount <= 0:
        return
    state = _locked_state(user)
    state.seeds += amount
    state.save(update_fields=["seeds", "updated_at"])
    _invalidate(user.id)


# ---------- اکشن‌های کودک ----------
class GardenError(Exception):
    """خطای منطقیِ باغچه با پیامِ فارسی برای فرانت."""


@transaction.atomic
def water_all(user) -> dict:
    state = _locked_state(user)
    if not state.plants.exists():
        raise GardenError("اول یه دانه بکار!")
    charges, last = settle_water(state)
    if charges < 1:
        raise GardenError("آب‌پاش خالیه؛ کمی صبر کن تا پر بشه.")
    state.water_charges = charges - 1
    state.last_refill_at = last
    state.last_watered_at = timezone.now()
    state.save(update_fields=["water_charges", "last_refill_at", "last_watered_at",
                              "updated_at"])
    Plant.objects.filter(garden=state).update(care=models_care_add(C.WATER_CARE))
    _invalidate(user.id)
    return build_state_view(user)


@transaction.atomic
def fertilize_all(user) -> dict:
    state = _locked_state(user)
    if not state.plants.exists():
        raise GardenError("اول یه دانه بکار!")
    if state.fertilizer < 1:
        raise GardenError("کود نداری؛ از بازی‌ها کود بگیر یا بخر.")
    state.fertilizer -= 1
    state.save(update_fields=["fertilizer", "updated_at"])
    Plant.objects.filter(garden=state).update(care=models_care_add(C.FERT_CARE))
    _invalidate(user.id)
    return build_state_view(user)


@transaction.atomic
def plant_seed(user) -> dict:
    state = _locked_state(user)
    if state.plants.count() >= slots(state.plot_level):
        raise GardenError("همه‌ی جای کاشت‌ها پره! با شبنم باغچه رو بزرگ‌تر کن.")
    if state.seeds < 1:
        raise GardenError("دانه نداری؛ از فروشگاه دانه بخر.")
    state.seeds -= 1
    state.save(update_fields=["seeds", "updated_at"])
    Plant.objects.create(garden=state, kind=random.choice(C.PLANT_KINDS), care=0)
    _invalidate(user.id)
    return build_state_view(user)


@transaction.atomic
def buy(user, item_key: str) -> dict:
    item = GardenShopItem.objects.filter(item_key=item_key, is_active=True).first()
    if item is None:
        raise GardenError("این آیتم موجود نیست.")
    state = _locked_state(user)
    if state.dew < item.cost:
        raise GardenError("شبنم کافی نداری.")

    if item.kind == GardenShopItem.Kind.SEED:
        state.seeds += item.amount
    elif item.kind == GardenShopItem.Kind.FERTILIZER:
        state.fertilizer += item.amount
    elif item.kind == GardenShopItem.Kind.PLOT:
        if state.plot_level >= C.MAX_PLOT_LEVEL:
            raise GardenError("باغچه به بزرگ‌ترین اندازه رسیده!")
        state.plot_level += 1
        state.water_charges = max_water(state.plot_level)  # پاداش: آب‌پاش پر می‌شود
        state.last_refill_at = timezone.now()
    elif item.kind == GardenShopItem.Kind.DECOR:
        key = item.payload or item.item_key
        if key in state.decor:
            raise GardenError("این تزئین رو قبلاً گرفتی.")
        state.decor = [*state.decor, key]

    state.dew -= item.cost
    state.save()
    _invalidate(user.id)
    return build_state_view(user)


def models_care_add(delta: int):
    """F-expressionِ افزایشِ care (بدون race)."""
    from django.db.models import F
    return F("care") + delta
