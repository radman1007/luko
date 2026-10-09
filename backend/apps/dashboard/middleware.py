"""
کار در پنلِ جنگو هم «فعالیت» است. داشبورد و پنلِ جنگو یک نشست دارند، پس کسی که
ساعتی در پنلِ جنگو کار کرده نباید با برگشتن به داشبورد «بی‌کار» حساب شود و بیرون برود.
نشستی که خودش از حدِ بی‌کاری گذشته زنده نمی‌شود؛ داشبورد آن را می‌بندد.
"""
import time

from django.conf import settings

from .security import SESSION_SEEN, idle_seconds


class AdminActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.prefix = f"/{settings.ADMIN_URL}/"

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith(self.prefix):
            session = getattr(request, "session", None)
            user = getattr(request, "user", None)
            seen = session.get(SESSION_SEEN) if session is not None else None
            now = int(time.time())
            if seen and user is not None and user.is_authenticated and 30 <= now - seen <= idle_seconds():
                session[SESSION_SEEN] = now
        return response
