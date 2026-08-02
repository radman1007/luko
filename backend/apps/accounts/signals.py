"""با ساختِ هر User، رکوردهای وابسته (پروفایل/تنظیمات/لوکوریان) هم ساخته می‌شوند."""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import KidSettings, Lukorian, Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_related(sender, instance, created, **kwargs):
    if not created:
        return
    Profile.objects.get_or_create(user=instance)
    KidSettings.objects.get_or_create(user=instance)
    Lukorian.objects.get_or_create(user=instance)
