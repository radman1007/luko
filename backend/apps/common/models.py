from django.db import models


class TimeStampedModel(models.Model):
    """مدل پایه با زمانِ ساخت/به‌روزرسانی — همه‌ی مدل‌ها از این ارث می‌برند."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True,
                                      verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین تغییر")

    class Meta:
        abstract = True
