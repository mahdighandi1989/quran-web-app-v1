"""Edge-case test for the Inspector Bridge WebSocket guard in ``src/App.jsx``
(consolidated task ``task_ce802af4072b`` / original ``a638846e``).

A "conditional inconsistency" anti-pattern lived in the inspector bridge embedded at the
top of ``src/App.jsx``: ``WS_URL`` was hardcoded to a dead external backend URL and then
the connect guard read ``if (!WS_URL || WS_URL === '<that same literal>') return;``. Because
the sentinel compared the constant to *itself*, the second clause was **always true**, so
the socket could never open — a dead branch masquerading as a real default.

The fix (mirroring the already-corrected ``index.html``) makes ``WS_URL`` optional and
host-configurable via ``window.__INSPECTOR_WS_URL__`` (defaulting to ``''``) and reduces the
guard to a single, honest ``if (!WS_URL) return;``.

This test is intentionally self-contained (stdlib + pytest only) so it runs in a
verification environment without the JS toolchain. It mirrors the guard's decision and
also asserts the live ``src/App.jsx`` source can never reintroduce the self-comparison.
"""

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
APP_JSX = REPO_ROOT / "src" / "App.jsx"

# The dead external URL the anti-pattern used to hardcode. It must never come back as a
# real default value (only, at most, inside an explanatory comment).
DEAD_URL = "wss://ai-creator-backend-q677.onrender.com"


def should_connect(ws_url):
    """Mirror the bridge's connect guard: ``if (!WS_URL) return;``.

    Returns ``True`` only when a truthy URL string is configured — i.e. a WebSocket is
    attempted. Empty/None/blank (the default) means postMessage-only mode: no connection,
    no self-referential sentinel.
    """
    return bool(ws_url) and isinstance(ws_url, str) and ws_url.strip() != ""


def test_default_ws_url_behavior():
    # 1) Default behaviour: with no configured URL, the bridge must NOT open a socket.
    #    (Under the old anti-pattern the dead literal was the "default" and the socket was
    #    permanently unreachable — both the no-URL and the configured-URL cases were wrong.)
    assert should_connect("") is False
    assert should_connect(None) is False
    assert should_connect("   ") is False

    # 2) When a real URL is configured (host sets window.__INSPECTOR_WS_URL__), the guard
    #    lets the connection through — the previously-dead branch now works.
    assert should_connect("wss://inspector.local/ws") is True
    assert should_connect("ws://localhost:5173/bridge") is True

    # 3) Regression guard against the live source: src/App.jsx must read the URL from the
    #    configurable source and must NOT reintroduce the self-comparison sentinel or use
    #    the dead URL as a live value.
    assert APP_JSX.is_file(), "src/App.jsx must exist"
    src = APP_JSX.read_text(encoding="utf-8")

    assert "window.__INSPECTOR_WS_URL__" in src, (
        "WS_URL must be read from the configurable window.__INSPECTOR_WS_URL__ source"
    )
    # The single honest guard must be present.
    assert re.search(r"if\s*\(\s*!WS_URL\s*\)", src), (
        "connect guard must be the single `if (!WS_URL) return;` form"
    )
    # The self-referential sentinel (WS_URL === 'wss:...') must be gone.
    assert re.search(r"WS_URL\s*===\s*['\"]wss:", src) is None, (
        "the `WS_URL === '<self>'` sentinel anti-pattern must not return"
    )

    # 4) The dead URL may only survive inside an explanatory comment, never as a JS string
    #    literal assigned to WS_URL.
    for line in src.splitlines():
        if DEAD_URL in line:
            stripped = line.lstrip()
            assert stripped.startswith("//") or stripped.startswith("*"), (
                f"dead backend URL must only appear in comments, got: {line!r}"
            )
            # and never as a `const WS_URL = '<dead url>'` assignment
            assert not re.search(r"WS_URL\s*=\s*['\"]" + re.escape(DEAD_URL), line), (
                "WS_URL must not be hardcoded to the dead backend URL"
            )
