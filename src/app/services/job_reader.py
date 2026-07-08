"""Read a job/scholarship posting from a URL and return clean text.

Honest limitation: many sites (LinkedIn, Glassdoor, some job boards) block bots
or require JavaScript/login. When that happens we raise a clear error so the UI
can tell the user to paste the text manually instead of failing silently.
"""
from html.parser import HTMLParser

import httpx

from app.config import settings

# Tags whose text content we never want (scripts, styles, nav chrome).
_SKIP_TAGS = {"script", "style", "noscript", "svg", "head", "nav", "footer", "form"}
# Block-level tags after which we insert a newline for readability.
_BLOCK_TAGS = {"p", "br", "div", "li", "h1", "h2", "h3", "h4", "tr", "section"}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
        elif tag in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._parts.append(text + " ")

    def text(self) -> str:
        raw = "".join(self._parts)
        # Collapse excess whitespace/blank lines.
        lines = [ln.strip() for ln in raw.splitlines()]
        cleaned = [ln for ln in lines if ln]
        return "\n".join(cleaned)


class JobReaderService:
    async def fetch(self, url: str) -> str:
        if not url.lower().startswith(("http://", "https://")):
            url = "https://" + url
        headers = {
            # A real browser UA improves success rate on many sites.
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml",
        }
        try:
            async with httpx.AsyncClient(
                timeout=20, follow_redirects=True, headers=headers
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"The site returned {exc.response.status_code}. It may block "
                "automated reading — please paste the posting text manually."
            ) from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(
                f"Could not open the link ({exc}). Please paste the posting "
                "text manually."
            ) from exc

        ctype = resp.headers.get("content-type", "")
        if "html" not in ctype and "text" not in ctype:
            raise RuntimeError(
                "That link is not a readable web page. Please paste the text."
            )

        parser = _TextExtractor()
        parser.feed(resp.text)
        text = parser.text()

        if len(text) < 60:
            raise RuntimeError(
                "Couldn't extract meaningful text (the page may need login or "
                "JavaScript). Please paste the posting text manually."
            )
        return text[: settings.max_input_chars]
