"""
Renderer پاکت‌دار + camelCase.

فرانت انتظار دارد بدنه‌ی موفق `{ "data": ... }` و خطا `{ "error": ... }` باشد،
و همه‌ی کلیدها camelCase (firstName، accessToken، ...). این renderer هر دو را
یک‌جا انجام می‌دهد تا سریالایزرها Pythonic (snake_case) بمانند.
"""
from djangorestframework_camel_case.render import CamelCaseJSONRenderer


class EnvelopeJSONRenderer(CamelCaseJSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        renderer_context = renderer_context or {}
        response = renderer_context.get("response")
        status_code = getattr(response, "status_code", 200)

        # پاسخِ بدونِ محتوا باید واقعاً خالی باشد. پیچیدنِ آن در پاکت یک
        # بدنه‌ی ۱۳ بایتی روی ۲۰۴ می‌گذارد که خلافِ HTTP است و کلاینت را
        # می‌شکند (حذف در فرانت با خطا برمی‌گشت).
        if status_code == 204 or data is None:
            return b""

        # اگر view خودش پاکت‌بندی کرده باشد (کلید data/error دارد) دوباره نپیچ.
        if isinstance(data, dict) and ("data" in data or "error" in data):
            payload = data
        elif 200 <= status_code < 400:
            payload = {"data": data}
        else:
            payload = {"error": data}

        return super().render(payload, accepted_media_type, renderer_context)
