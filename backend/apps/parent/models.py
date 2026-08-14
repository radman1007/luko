"""پیوندِ والد و فرزند — پایه‌ی همه‌ی گزارش‌های پنل والدین."""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class ParentChild(TimeStampedModel):
    """
    یک والد می‌تواند چند فرزند داشته باشد و یک فرزند چند سرپرست
    (مثلاً پدر و مادر). دسترسیِ گزارش‌ها فقط از روی همین جدول داده می‌شود.
    """

    class Relation(models.TextChoices):
        PARENT = "parent", "والد"
        GUARDIAN = "guardian", "سرپرست"

    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="children_links")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="parent_links")
    relation = models.CharField(max_length=12, choices=Relation.choices,
                                default=Relation.PARENT)
    grade = models.PositiveSmallIntegerField(default=1)      # پایه‌ی تحصیلی
    school = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("parent", "child")
        indexes = [models.Index(fields=["parent", "is_active"])]

    def __str__(self):
        return f"{self.parent} → {self.child}"
