"""عکسِ وبلاگ: پسوند، حجم و امضای واقعیِ فایل (نه فقط پسوند)."""
from django.core.exceptions import ValidationError

IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]
IMAGE_MAX_MB = 5


def _looks_like_image(head: bytes) -> bool:
    return (head.startswith(b"\xff\xd8\xff")                       # JPEG
            or head.startswith(b"\x89PNG\r\n\x1a\n")                 # PNG
            or head[:6] in (b"GIF87a", b"GIF89a")                    # GIF
            or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"))      # WebP


def validate_image(file):
    if not file:
        return
    name = (getattr(file, "name", "") or "").lower()
    if "." not in name or name.rsplit(".", 1)[1] not in IMAGE_EXTENSIONS:
        raise ValidationError("فقط عکسِ JPG، PNG، WebP یا GIF.")
    if file.size > IMAGE_MAX_MB * 1024 * 1024:
        raise ValidationError(f"حجمِ عکس بیشتر از {IMAGE_MAX_MB} مگابایت است.")
    position = file.tell() if hasattr(file, "tell") else 0
    try:
        file.seek(0)
        head = file.read(12)
    finally:
        try:
            file.seek(position)
        except Exception:                                             # noqa: BLE001
            pass
    if not _looks_like_image(head):
        raise ValidationError("این فایل عکس نیست.")
