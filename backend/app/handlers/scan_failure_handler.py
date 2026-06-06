"""Failure handler for the ``scan_failed`` critical event.

``scan_failed`` (the Quran Excel scan/import pipeline failing) is a data-integrity failure: the
user's import did not apply and they must know immediately. Previously this critical event had NO
``notify_event`` call, so a failure could pass unnoticed for days. This handler is the single place
that turns a scan failure into a high-priority, non-silent notification.

The same event is wired on the frontend via ``notifyCriticalEvent("scan_failed", ...)`` in
``src/lib/storage.js`` + ``src/App.jsx`` (routed through the critical_error channel). Here it goes
through the shared pipeline's ``notify_event`` so the criticality-based silent flag logic applies:
``scan_failed`` → ``critical_error`` → always loud, regardless of user config.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from backend.app.notification_pipeline import notify_event

# Persian, meaningful message template. Mirrors the wording used by the frontend scan-failure path.
SCAN_FAILED_MESSAGE = (
    "🚨 پویش و پردازش فایل‌های اکسل قرآن ناموفق بود؛ فایل ممکن است خراب یا با قالبی نامعتبر باشد. "
    "هیچ داده‌ای وارد نشد و تغییری اعمال نشد. لطفاً فایل صحیح را دوباره بارگذاری کنید."
)


def build_scan_failed_message(detail: Optional[str] = None) -> str:
    """Build the user-facing Persian scan-failure message, optionally appending a short detail."""
    if detail:
        return f"{SCAN_FAILED_MESSAGE}\nجزئیات: {detail}"
    return SCAN_FAILED_MESSAGE


def handle_scan_failed(detail: Optional[str] = None, *, config: Optional[Dict[str, Any]] = None,
                       sink=None) -> Dict[str, Any]:
    """Emit the critical scan-failure notification. Always loud + high priority (never silent)."""
    return notify_event("scan_failed", build_scan_failed_message(detail), silent=False, priority="high", config=config, sink=sink)
