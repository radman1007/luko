"""
مارک‌داونِ امن برای وبلاگ.

نویسنده‌ها متنِ ساده با چند علامتِ آشنا می‌نویسند (# تیتر، **پررنگ**، - فهرست، [پیوند](...)،
![عکس](...)). خروجی HTML است که سایتِ لندینگ مستقیم نشان می‌دهد، پس اول همه‌چیز escape
می‌شود و فقط همین چند الگو به تگ تبدیل می‌شوند؛ هیچ HTMLِ خامی از متن عبور نمی‌کند و
پیوندها فقط https/http/mailto یا مسیرِ داخلی‌اند (نه javascript: یا data:).
"""
from __future__ import annotations

import html
import re

_CODE = re.compile(r"`([^`\n]+)`")
_IMAGE = re.compile(r"!\[([^\]\n]*)\]\(([^)\s]+)\)")
_LINK = re.compile(r"\[([^\]\n]+)\]\(([^)\s]+)\)")
_BOLD = re.compile(r"\*\*(?=\S)(.+?)(?<=\S)\*\*")
_ITALIC = re.compile(r"(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?![\w*])")
_HEADING = re.compile(r"^(#{1,3})\s+(.+?)\s*#*\s*$")
_ULIST = re.compile(r"^\s*[-*•]\s+(.*)$")
_OLIST = re.compile(r"^\s*(?:\d+|[۰-۹]+)[.)]\s+(.*)$")
_RULE = re.compile(r"^\s*([-*_])(\s*\1){2,}\s*$")


def _safe_link(url: str) -> bool:
    lowered = html.unescape(url).strip().lower()
    if lowered.startswith("//"):
        return False
    return lowered.startswith(("https://", "http://", "mailto:", "/", "#"))


def _safe_image(url: str) -> bool:
    lowered = html.unescape(url).strip().lower()
    return lowered.startswith("https://") or (lowered.startswith("/media/") and ".." not in lowered)


def _absolute(url: str, media_base: str) -> str:
    return f"{media_base}{url}" if media_base and url.startswith("/media/") else url


def _inline(text: str, media_base: str) -> str:
    """یک خطِ متن (هنوز escape نشده) → HTMLِ امن."""
    out = html.escape(text, quote=True)
    codes: list[str] = []

    def keep_code(m):
        codes.append(f"<code>{m.group(1)}</code>")
        return f"\x00{len(codes) - 1}\x00"

    out = _CODE.sub(keep_code, out)

    def image(m):
        alt, url = m.group(1), m.group(2)
        if not _safe_image(url):
            return alt
        return f'<img src="{_absolute(url, media_base)}" alt="{alt}" loading="lazy">'

    def link(m):
        label, url = m.group(1), m.group(2)
        if not _safe_link(url):
            return label
        external = html.unescape(url).lower().startswith(("https://", "http://"))
        extra = ' target="_blank" rel="noopener nofollow"' if external else ""
        return f'<a href="{_absolute(url, media_base)}"{extra}>{label}</a>'

    out = _IMAGE.sub(image, out)
    out = _LINK.sub(link, out)
    out = _BOLD.sub(r"<strong>\1</strong>", out)
    out = _ITALIC.sub(r"<em>\1</em>", out)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], out)


def render(text: str, *, media_base: str = "") -> str:
    """کلِ متنِ پست → HTML. `media_base` نشانیِ /media/ را برای سایتِ دیگر کامل می‌کند."""
    lines = (text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[str] = []
    para: list[str] = []
    items: list[str] = []
    list_tag = ""
    quote: list[str] = []
    i = 0

    def flush_para():
        if para:
            blocks.append("<p>" + "<br>".join(_inline(line, media_base) for line in para) + "</p>")
            para.clear()

    def flush_list():
        nonlocal list_tag
        if items:
            blocks.append(f"<{list_tag}>" + "".join(f"<li>{it}</li>" for it in items) + f"</{list_tag}>")
            items.clear()
        list_tag = ""

    def flush_quote():
        if quote:
            blocks.append("<blockquote><p>" + "<br>".join(_inline(q, media_base) for q in quote)
                          + "</p></blockquote>")
            quote.clear()

    def flush_all():
        flush_para()
        flush_list()
        flush_quote()

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("```"):
            flush_all()
            code: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            blocks.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
            i += 1
            continue
        if not stripped:
            flush_all()
        elif (m := _HEADING.match(stripped)):
            flush_all()
            level = len(m.group(1)) + 1            # عنوانِ پست h1 است
            blocks.append(f"<h{level}>{_inline(m.group(2), media_base)}</h{level}>")
        elif _RULE.match(stripped):
            flush_all()
            blocks.append("<hr>")
        elif stripped.startswith(">"):
            flush_para()
            flush_list()
            quote.append(stripped.lstrip(">").strip())
        elif (m := _ULIST.match(line)) or (m := _OLIST.match(line)):
            flush_para()
            flush_quote()
            tag = "ul" if _ULIST.match(line) else "ol"
            if list_tag and list_tag != tag:
                flush_list()
            list_tag = tag
            items.append(_inline(m.group(1), media_base))
        else:
            flush_list()
            flush_quote()
            para.append(stripped)
        i += 1
    flush_all()
    return "\n".join(blocks)


def plain_text(text: str) -> str:
    """متنِ بی‌نشانه — برای خلاصه‌ی خودکار و زمانِ خواندن."""
    out = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text or "")
    out = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", out)
    out = re.sub(r"[#*`>_\-]+", " ", out)
    return re.sub(r"\s+", " ", out).strip()
