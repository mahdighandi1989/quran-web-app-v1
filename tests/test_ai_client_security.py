"""Security tests for the AI key/proxy hardening task (consolidated task_885da0f585ed).

Covers the edge case behind the "stale assumption / security risk" anti-pattern flagged at
``src/lib/aiClient.js`` (the ``anthropic-dangerous-direct-browser-access`` header) plus the
companion changes: the backend AI proxy (key off the client), custom-provider Base URL
validation, and removal of the misleading "direct browser exposes the key" warning.

These tests are intentionally self-contained (stdlib + pytest only) so they run in a
verification environment without the JS toolchain. They assert on the committed source so a
future edit cannot silently regress the security posture.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AI_CLIENT = REPO_ROOT / "src" / "lib" / "aiClient.js"
AI_PROVIDERS = REPO_ROOT / "src" / "lib" / "aiProviders.js"
AI_SETTINGS = REPO_ROOT / "src" / "components" / "AISettings.jsx"
SERVER_AI = REPO_ROOT / "server" / "ai.mjs"
SERVER_PROXY = REPO_ROOT / "server" / "ai-proxy.mjs"
SERVER_BOT = REPO_ROOT / "server" / "telegram-bot.mjs"

DANGER_HEADER = "anthropic-dangerous-direct-browser-access"


def _read(p):
    assert p.is_file(), f"expected file missing: {p}"
    return p.read_text(encoding="utf-8")


def test_anthropic_header_handling_edge_case():
    """The dangerous direct-browser header must be a SCOPED opt-in, not an unconditional default.

    Root cause of the anti-pattern: the client assumed it always runs in a browser and so
    always attached ``anthropic-dangerous-direct-browser-access: 'true'`` — which advertises
    that the API key is exposed client-side, even for a server/proxy call where it is neither
    needed nor safe.

    Edge cases guarded here:
      1. The header is built by a single ``anthropicHeaders(key, {directBrowser})`` helper.
      2. That helper only attaches the dangerous header when ``directBrowser`` is truthy
         (i.e. behind an ``if (directBrowser)`` guard) — so the server/proxy path
         (``directBrowser:false``) omits it.
      3. The client no longer attaches the dangerous header unconditionally inline.
      4. The server-side AI module never sends the dangerous header at all.
    """
    client = _read(AI_CLIENT)

    # 1) the helper exists
    assert "function anthropicHeaders" in client, "anthropicHeaders helper must exist"

    # 2) the dangerous header is gated behind the directBrowser flag
    assert "if (directBrowser)" in client, "dangerous header must be conditional on directBrowser"
    # the dangerous header literal must appear only inside the conditional block, never on a
    # line that is not guarded. We check the only occurrences are within the helper guard.
    danger_lines = [ln.strip() for ln in client.splitlines() if DANGER_HEADER in ln]
    assert danger_lines, "expected the dangerous header to still be supported for the BYOK path"
    for ln in danger_lines:
        # every remaining live (assignment) occurrence must be the guarded headers[...] write,
        # not an unconditional object-literal property like `'...': 'true'` on a request.
        if ln.startswith("//") or ln.startswith("*"):
            continue  # documentation/comment lines are fine
        assert "headers[" in ln, f"dangerous header attached outside the guard: {ln}"

    # 3) no unconditional inline attachment remains in fetch calls
    assert "'anthropic-dangerous-direct-browser-access': 'true'" not in client, (
        "the dangerous header must not be hard-coded in a request header object literal"
    )

    # 4) the server-side AI client must never advertise direct browser access
    server_ai = _read(SERVER_AI)
    assert DANGER_HEADER not in server_ai, (
        "server/ai.mjs runs on the server; it must not send the direct-browser header"
    )


def test_backend_proxy_keeps_key_off_the_client():
    """A backend proxy must exist and the client must route chat through it."""
    proxy = _read(SERVER_PROXY)
    assert "handleAiProxy" in proxy, "server/ai-proxy.mjs must export handleAiProxy"
    # signed-in path reads the key server-side from the stored config (via id token -> uid)
    assert "verifyIdToken" in proxy and "getAiConfig" in proxy

    bot = _read(SERVER_BOT)
    assert "/api/ai/proxy" in bot, "the proxy route must be wired into the server"
    assert "handleAiProxy" in bot

    client = _read(AI_CLIENT)
    assert "getAiProxyUrl" in client and "chatViaProxy" in client, (
        "the client must know how to route requests through the proxy"
    )
    # when an id token is present the key must NOT be put on the wire
    assert "if (idToken) payload.idToken = idToken" in client


def test_custom_provider_base_url_is_validated():
    """addCustomProvider must validate the Base URL (no javascript:/file:/data:, etc.)."""
    providers = _read(AI_PROVIDERS)
    assert "export function isValidProviderBaseUrl" in providers
    # uses the URL constructor (robust scheme check), not a naive string prefix test
    assert "new URL(" in providers
    assert "u.protocol !== 'https:'" in providers and "u.protocol !== 'http:'" in providers

    settings = _read(AI_SETTINGS)
    assert "isValidProviderBaseUrl" in settings, (
        "AISettings.addCustomProvider must call the Base URL validator before storing it"
    )


def test_misleading_key_exposure_warning_removed():
    """The old warning claiming direct browser calls expose the key must be gone (AC4)."""
    settings = _read(AI_SETTINGS)
    assert "فراخوانی مستقیم از مرورگر، کلید را در همان درخواست افشا می‌کند" not in settings, (
        "the stale direct-exposure warning must be removed/replaced now that a proxy is used"
    )
