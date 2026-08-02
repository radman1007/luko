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
