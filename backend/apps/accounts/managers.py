from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    """کاربر با شماره‌ی تلفن به‌جای username."""

    use_in_migrations = True

    def _create(self, phone, password, **extra):
        if not phone:
            raise ValueError("شماره‌ی تلفن لازم است.")
        user = self.model(phone=phone, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra):
        extra.setdefault("role", "student")
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(phone, password, **extra)

    def create_superuser(self, phone, password=None, **extra):
        extra.update(role="team_admin", is_staff=True, is_superuser=True, is_active=True)
        return self._create(phone, password, **extra)

    def get_by_natural_key(self, phone):
        """
        یک شماره می‌تواند چند حساب داشته باشد (بچه‌ای که با شماره‌ی مادرش
        ثبت‌نام کرده، و خودِ مادر). این مسیر فقط ورودِ رمزدارِ ادمین را
        سرویس می‌دهد — ورودِ عادی با OTP است و از اینجا رد نمی‌شود — پس
        حسابِ کارکنان را ترجیح می‌دهیم و ترتیب را قطعی نگه می‌داریم.
        """
        qs = self.filter(phone=phone).order_by("id")
        user = qs.filter(is_staff=True).first() or qs.first()
        if user is None:
            raise self.model.DoesNotExist(
                f"{self.model._meta.object_name} matching query does not exist."
            )
        return user
