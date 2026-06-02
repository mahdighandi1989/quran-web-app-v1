"""Edge-case test for the Inspector Bridge "ready" payload (task 61f7b3ba).

This guards the "broken feedback loop" anti-pattern in the Inspector Bridge script
embedded in ``index.html``. Every payload the bridge emits to the host/inspector
(``inspector-bridge-ready`` and ``inspector-bridge-event``) must report the FULL
current page address via ``window.location.href``. A truncated/typo'd source — the
reported ``window.locatio`` form, or any value that drops the path/query/hash —
sends an incorrect URL to the backend, so the page can no longer be identified and
the inspector ↔ page feedback loop silently breaks.

The test is intentionally self-contained (stdlib + pytest only) so it can run in a
verification environment without the JS toolchain. It mirrors the payload-building
logic of the bridge and also asserts the live ``index.html`` source can never
reintroduce the truncated form.
"""

import re
from pathlib import Path

import pytest

INDEX_HTML = Path(__file__).resolve().parent.parent / "index.html"


def build_bridge_payload(page_url, *, is_in_iframe=False, timestamp=0):
    """Mirror the bridge's ready/event payload builder.

    The bridge sets ``pageUrl`` from ``window.location.href`` — i.e. the full page
    address. This helper reproduces that contract so the feedback-loop invariant can
    be tested without a browser: ``pageUrl`` must equal the full URL it was given,
    never a truncated prefix.
    """
    if not isinstance(page_url, str) or not page_url:
        raise ValueError("pageUrl must be the full window.location.href string")
    return {
        "type": "inspector-bridge-ready",
        "pageUrl": page_url,
        "isInIframe": is_in_iframe,
        "timestamp": timestamp,
    }


def test_page_url_payload_correct():
    # 1) The payload reports the EXACT full URL, including path, query and hash —
    #    not a truncated origin-only value (the feedback-loop anti-pattern).
    full_url = "https://app.example.com/surah/2?ayah=255#bookmark"
    payload = build_bridge_payload(full_url, is_in_iframe=True, timestamp=123)
    assert payload["pageUrl"] == full_url
    assert payload["type"] == "inspector-bridge-ready"
    assert payload["isInIframe"] is True

    # 2) A variety of real-world URLs must round-trip unchanged (no path/hash loss).
    for url in (
        "https://app.example.com/",
        "http://localhost:5173/?debug=1",
        "https://example.org/a/b/c#frag",
        "https://example.org/page?x=1&y=2#z",
    ):
        assert build_bridge_payload(url)["pageUrl"] == url

    # 3) An empty / non-string page URL is rejected rather than silently shipping a
    #    bad value to the backend.
    for bad in (None, "", 42, {}, []):
        with pytest.raises(ValueError):
            build_bridge_payload(bad)

    # 4) Regression guard against the live source: every `pageUrl:` field in
    #    index.html must use `window.location.href`, and the truncated
    #    `window.locatio` (missing `n.href`) typo must never appear.
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert re.search(r"window\.locatio(?!n)", html) is None, (
        "truncated window.locatio typo would break the feedback loop"
    )
    assignments = re.findall(r"pageUrl:\s*[^,\n}]+", html)
    assert assignments, "expected at least one pageUrl field in index.html"
    for assignment in assignments:
        assert "window.location.href" in assignment, (
            f"pageUrl must use window.location.href, got: {assignment!r}"
        )
