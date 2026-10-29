"""Allow-list sanitizer for trusted formatting saved from admin rich-text editors."""
from html import escape
from html.parser import HTMLParser
import re

_ALLOWED_TAGS = {"p", "br", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "hr", "table", "thead", "tbody", "tr", "th", "td", "img", "font"}
_VOID_TAGS = {"br", "hr", "img"}
_DROP_CONTENT = {"script", "style", "iframe", "object", "embed", "form", "input", "button", "svg", "math", "template"}
_STYLE_ALLOW = {"color", "background-color", "font-size", "font-weight", "font-style", "text-decoration", "text-align"}


def _safe_url(value, image=False):
    value = (value or "").strip()
    if not value:
        return None
    if value.startswith(("/", "#")) or value.startswith("./") or value.startswith("../"):
        return value
    if re.match(r"^(https?://|mailto:)", value, re.I) and (not image or not value.lower().startswith("mailto:")):
        return value
    return None


def _safe_style(value):
    parts = []
    for segment in (value or "").split(";"):
        if ":" not in segment:
            continue
        key, val = segment.split(":", 1)
        key, val = key.strip().lower(), val.strip()
        if key not in _STYLE_ALLOW or not val or re.search(r"url\s*\(|expression\s*\(|javascript:|@import|\\", val, re.I):
            continue
        if key == "font-size" and not re.match(r"^(\d{1,2}(\.\d+)?)(px|pt|rem|em|%)$", val, re.I):
            continue
        if key == "text-align" and val.lower() not in {"left", "right", "center", "justify", "start", "end"}:
            continue
        if key == "font-weight" and val.lower() not in {"normal", "bold", "bolder", "lighter", "400", "500", "600", "700", "800", "900"}:
            continue
        if key == "font-style" and val.lower() not in {"normal", "italic", "oblique"}:
            continue
        if key in {"color", "background-color"} and not re.match(r"^(#[0-9a-f]{3,8}|[a-z]{1,20}|rgb\([\d\s,%.]+\)|rgba\([\d\s,.%]+\))$", val, re.I):
            continue
        if key == "text-decoration" and val.lower() not in {"none", "underline", "line-through", "overline", "underline line-through"}:
            continue
        parts.append(f"{key}:{val}")
    return ";".join(parts)


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.drop_depth = 0
        self.stack = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if self.drop_depth:
            if tag in _DROP_CONTENT:
                self.drop_depth += 1
            return
        if tag in _DROP_CONTENT:
            self.drop_depth = 1
            return
        if tag not in _ALLOWED_TAGS:
            return
        safe_attrs = []
        attrs = dict(attrs)
        for name in ("href", "src", "alt", "title", "target", "rel", "width", "height", "style", "color", "size"):
            value = attrs.get(name)
            if value is None:
                continue
            if name == "href":
                value = _safe_url(value)
                if value is None:
                    continue
            elif name == "src":
                value = _safe_url(value, image=True)
                if value is None:
                    continue
            elif name == "style":
                value = _safe_style(value)
                if not value:
                    continue
            elif name in {"width", "height"}:
                if not re.match(r"^\d{1,4}(px|%)?$", str(value).strip()):
                    continue
            elif name == "size":
                if not re.match(r"^[1-7]$", str(value).strip()):
                    continue
            elif name == "color":
                if not re.match(r"^(#[0-9a-f]{3,8}|[a-z]{1,20})$", str(value).strip(), re.I):
                    continue
            else:
                value = str(value)
            safe_attrs.append((name, str(value)))
        if tag == "a":
            if not any(name == "href" for name, _ in safe_attrs):
                safe_attrs = [(name, value) for name, value in safe_attrs if name not in {"target", "rel"}]
            else:
                safe_attrs = [(name, value) for name, value in safe_attrs if name != "rel"] + [("rel", "noopener noreferrer")]
        rendered = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs)
        self.out.append(f"<{tag}{rendered}>")
        if tag not in _VOID_TAGS:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.drop_depth:
            if tag in _DROP_CONTENT:
                self.drop_depth -= 1
            return
        if tag in _VOID_TAGS or tag not in _ALLOWED_TAGS or tag not in self.stack:
            return
        while self.stack:
            current = self.stack.pop()
            self.out.append(f"</{current}>")
            if current == tag:
                break

    def handle_data(self, data):
        if not self.drop_depth:
            self.out.append(escape(data, quote=False))

    def handle_entityref(self, name):
        if not self.drop_depth:
            self.out.append(f"&{name};")

    def handle_charref(self, name):
        if not self.drop_depth:
            self.out.append(f"&#{name};")

    def finish(self):
        while self.stack:
            self.out.append(f"</{self.stack.pop()}>")
        return "".join(self.out)


def sanitize_html(value):
    if not isinstance(value, str) or not value:
        return ""
    parser = _Sanitizer()
    try:
        parser.feed(value[:500000])
        parser.close()
        return parser.finish()
    except Exception:
        return escape(value, quote=False)
