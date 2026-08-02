"""هندلر خطای یکدست: خطاها را به شکل { error: { code, message, details } } درمی‌آورد."""
from rest_framework.views import exception_handler


def envelope_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    message = None
    if isinstance(detail, dict) and "detail" in detail:
        message = str(detail["detail"])
    elif isinstance(detail, list) and detail:
        message = str(detail[0])

    response.data = {
        "error": {
            "code": response.status_code,
            "message": message or "خطایی رخ داد.",
            "details": detail,
        }
    }
    return response
