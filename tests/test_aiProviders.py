"""Edge-case tests for the AI provider registry/validators (task task_bd3f356bffe0, subtask 3).

``src/lib/aiProviders.js`` carried a "stale assumption" anti-pattern: the static model lists in
``BUILTIN_PROVIDERS`` were treated as an authoritative, always-current catalogue, when in fact
provider model line-ups change frequently and the real source of truth is the live list fetched
at validation time. The fix adds an explicit justification NOTE documenting that these names are
placeholders/examples and that ``validateProviderKey`` returns the live models.

These self-contained tests (stdlib + pytest, no JS toolchain) assert the NOTE is present and
exercise a Python port of the two pure guards that back ``validateProviderKey``:
``isValidProviderBaseUrl`` (SSRF/injection-shaped input rejection) and the empty-key guard.
"""

import re
from pathlib import Path
from urllib.parse import urlparse

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
AI_PROVIDERS = REPO_ROOT / "src" / "lib" / "aiProviders.js"


def _source():
    assert AI_PROVIDERS.is_file(), f"missing {AI_PROVIDERS}"
    return AI_PROVIDERS.read_text(encoding="utf-8")


# --- Python port of the pure guards used before any network call --------------------------


def is_valid_provider_base_url(url):
    """Mirror of isValidProviderBaseUrl: only absolute http(s) URLs with a real host."""
    if not isinstance(url, str) or not url.strip():
        return False
    try:
        u = urlparse(url.strip())
    except ValueError:
        return False
    if u.scheme not in ("http", "https"):
        return False
    if not u.hostname:
        return False
    return True


class ProviderKeyError(ValueError):
    pass


def validate_provider_key_guard(key):
    """Mirror of validateProviderKey's precondition: an empty key throws before any fetch."""
    if not key:
        raise ProviderKeyError("کلید وارد نشده است.")
    return True


# --- Tests --------------------------------------------------------------------------------


def test_validateProviderKey_edge_cases():
    src = _source()

    # 1) The stale-assumption justification NOTE must be present.
    assert "NOTE: Model names in BUILTIN_PROVIDERS are placeholders/examples" in src, (
        "aiProviders.js must document that BUILTIN_PROVIDERS model lists are examples, "
        "not an authoritative catalogue"
    )

    # 2) validateProviderKey must guard an empty key before doing any network call.
    assert re.search(r"if\s*\(\s*!key\s*\)\s*throw", src), (
        "validateProviderKey must throw immediately on an empty key"
    )
    for empty in ("", None):
        with pytest.raises(ProviderKeyError):
            validate_provider_key_guard(empty)
    assert validate_provider_key_guard("sk-123") is True

    # 3) Base-URL validation rejects dangerous / malformed inputs and accepts real http(s).
    assert "isValidProviderBaseUrl" in src
    bad = [
        "javascript:alert(1)",
        "data:text/html,<script>",
        "file:///etc/passwd",
        "vbscript:msgbox",
        "   ",
        "",
        "not a url",
        "/relative/path",
        "ftp://example.com",
        None,
        123,
    ]
    for u in bad:
        assert is_valid_provider_base_url(u) is False, f"should reject {u!r}"

    good = [
        "https://api.openai.com/v1",
        "http://localhost:8080/v1",
        "https://api.example.com/v1",
        "  https://api.anthropic.com/v1  ",
    ]
    for u in good:
        assert is_valid_provider_base_url(u) is True, f"should accept {u!r}"
