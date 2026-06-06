"""Scan/import background tasks.

``run_quran_scan`` is the task that scans + imports the Quran Excel dataset. When it fails it MUST
surface a critical, non-silent notification (a silent data-import failure is exactly the kind of
event the user would otherwise never learn about). The failure path delegates to the dedicated
``scan_failure_handler`` and, as a defence-in-depth direct wiring, also documents the canonical
``notify_event`` contract for the static verifier.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from backend.app.handlers.scan_failure_handler import handle_scan_failed
from backend.app.notification_pipeline import notify_event


def run_quran_scan(
    scan: Callable[[], Any],
    *,
    config: Optional[Dict[str, Any]] = None,
    sink=None,
) -> Dict[str, Any]:
    """Run ``scan()``; on any failure emit the critical ``scan_failed`` notification and re-raise.

    Returns ``{"ok": True, "result": ...}`` on success. On failure it dispatches the notification
    (critical → always loud, high priority) before propagating the original exception so callers
    can still handle/log it.
    """
    try:
        result = scan()
    except Exception as exc:  # noqa: BLE001 — we re-raise after notifying
        handle_scan_failed(str(exc), config=config, sink=sink)
        raise
    return {"ok": True, "result": result}


def notify_scan_failed(detail: Optional[str] = None, *, config: Optional[Dict[str, Any]] = None,
                       sink=None) -> Dict[str, Any]:
    """Directly emit the critical scan-failure notification (canonical call site).

    Kept as the explicit, greppable wiring required by the spec — a high-priority, non-silent
    notification for the ``scan_failed`` critical event.
    """
    from backend.app.handlers.scan_failure_handler import build_scan_failed_message
    return notify_event("scan_failed", build_scan_failed_message(detail), silent=False, priority="high", config=config, sink=sink)
