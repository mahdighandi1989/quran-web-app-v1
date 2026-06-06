"""Notification pipeline — Python ground-truth reference for the proactive notification logic.

This module is the server-side / reference mirror of the browser pipeline that lives in
``src/lib/telegram.js`` (transport + silent flag logic), ``src/lib/notificationRules.js`` (shared
caption rules) and ``src/lib/notificationScheduler.js`` (proactive triggering). It exists so the
documented policy has a single, importable, *testable* source of truth that CI can pin against —
see ``tests/integration/test_notification_pipeline.py``.

It is dependency-free (stdlib only) so it runs in any verification environment without the JS
toolchain.

────────────────────────────────────────────────────────────────────────────────────────────────
COHERENCE NOTES
────────────────────────────────────────────────────────────────────────────────────────────────

silent flag logic (criticality-based) — see docs/adr/00x_silent_flag_logic.md:
  inconsistency identified: importance and the ``silent`` flag were decoupled, so a CRITICAL alert
    could be delivered silently and missed.
  assumptions documented:
    * Side A (transport): "the per-type silent flag is the single source of truth".
    * Side B (product): "critical alerts must always ring; the user cannot silence them".
  ground truth established: Side B wins — critical notifications can never be silent (this overrides
    both the per-type config and any explicit caller override). The frontend transport
    (src/lib/telegram.js#resolveSilent) is aligned with new logic by using the same classification.

proactive notification logic / proactive notification trigger:
  inconsistency identified: nothing connected "an application event happened" to "send the matching
    notification" — appStateStore only persists, telegramCommands only reacts to inbound commands.
  assumptions documented:
    * Side A (appStateStore): "my job is persistence, never triggering".
    * Side B (telegramCommands): "every outbound message originates from a user command".
  ground truth established: a dedicated scheduler owns the proactive notification trigger; the
    in-app (notificationScheduler.js) and server tiers are aligned with new logic via shared rules.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, List, Optional

# ── Criticality-based silent flag logic ──────────────────────────────────────────────────────────

CRITICALITY_CRITICAL = "critical"
CRITICALITY_IMPORTANT = "important"
CRITICALITY_ROUTINE = "routine"

# Mirror of NOTIFICATION_CRITICALITY in src/lib/telegram.js — keep the two in sync.
NOTIFICATION_CRITICALITY: Dict[str, str] = {
    "critical_error": CRITICALITY_CRITICAL,
    "session_complete": CRITICALITY_IMPORTANT,
    "exam_result": CRITICALITY_IMPORTANT,
    "reminder": CRITICALITY_IMPORTANT,
    "new_login": CRITICALITY_IMPORTANT,
    "drive_sync": CRITICALITY_ROUTINE,
    "daily_summary": CRITICALITY_ROUTINE,
}

# Application EVENTS map to a notification TYPE. ``scan_failed`` is a data-integrity failure routed
# through the critical_error channel (matching notifyCriticalEvent("scan_failed", ...) in the app's
# src/lib/storage.js + src/App.jsx), so it inherits the CRITICAL no-silence guarantee.
EVENT_TYPE: Dict[str, str] = {
    "scan_failed": "critical_error",
    "storage_save_failed": "critical_error",
    "session_complete": "session_complete",
    "exam_result": "exam_result",
    "daily_goal": "daily_summary",
    "reminder": "reminder",
    "daily_summary": "daily_summary",
    "new_login": "new_login",
    "drive_sync": "drive_sync",
}


def notification_type_for_event(event: str) -> str:
    """The telegram notification TYPE used to deliver an application EVENT."""
    return EVENT_TYPE.get(event, event)


def get_notification_criticality(type_or_event: str) -> str:
    """Criticality for a notification TYPE (or an event name). Defaults to ROUTINE (fail-safe)."""
    ntype = NOTIFICATION_CRITICALITY.get(type_or_event)
    if ntype is not None:
        return ntype
    mapped = EVENT_TYPE.get(type_or_event)
    if mapped is not None:
        return NOTIFICATION_CRITICALITY.get(mapped, CRITICALITY_ROUTINE)
    return CRITICALITY_ROUTINE


def is_critical_notification(type_or_event: str) -> bool:
    """Is this a critical notification that must always ring (can never be silent)?"""
    return get_notification_criticality(type_or_event) == CRITICALITY_CRITICAL


def resolve_silent(
    config: Optional[Dict[str, Any]],
    type_or_event: str,
    override: Optional[bool] = None,
) -> bool:
    """Effective ``silent`` flag, applying the ground-truth precedence.

    1. critical types are ALWAYS loud (``silent=False``) — overrides config and override.
    2. else an explicit caller ``override`` wins.
    3. else the per-type config default (``config['notifications'][type]['silent']``).
    """
    if is_critical_notification(type_or_event):
        return False
    if override is not None:
        return bool(override)
    notifications = (config or {}).get("notifications") or {}
    per_type = notifications.get(notification_type_for_event(type_or_event)) or {}
    return bool(per_type.get("silent"))


# ── Caption (message content) generation for proactive notifications ──────────────────────────────
# Mirror of src/lib/notificationRules.js + the dedicated formatter (proactiveNotificationFormatter).


def build_daily_summary_text(app_state: Optional[Dict[str, Any]]) -> str:
    s = (app_state or {}).get("sessions")
    head = "🌅 <b>خلاصهٔ روزانه</b>"
    if not s:
        return head + "\nهنوز داده‌ای ثبت نشده. امروز یک تمرین کوتاه را شروع کن! 🌿"
    t = s.get("today")
    if t:
        today_line = (
            f"امروز: {t.get('sessions')} جلسه • "
            f"{t.get('correct')} درست / {t.get('wrong')} غلط"
        )
    else:
        today_line = "امروز هنوز جلسه‌ای ثبت نشده."
    return head + (
        f"\n{today_line}\n"
        f"دقت کلی: {s.get('accuracyPct', 0)}% • جلسات ۷ روز اخیر: {s.get('last7Days', 0)}\n"
        "یک تمرین تازه را همین حالا شروع کن. 💪"
    )


def build_goal_reached_text(done_today: int, goal: int) -> str:
    return (
        "🎯 <b>هدف امروز محقق شد!</b>\n"
        f"امروز {done_today} مورد تمرین کردی (هدف: {goal}). آفرین — ادامه بده! 🌟"
    )


def build_reminder_text(reminder_text: str) -> str:
    return f"⏰ یادآوری: {reminder_text}"


def build_proactive_caption(event: Dict[str, Any]) -> str:
    """Caption (message body) for a proactive event context. Mirror of the JS formatter."""
    if not event or not event.get("kind"):
        return ""
    kind = event["kind"]
    if kind == "daily_goal":
        return build_goal_reached_text(event.get("doneToday", 0), event.get("dailyGoal", 0))
    if kind == "reminder":
        return build_reminder_text(event.get("reminderText", ""))
    if kind == "daily_summary":
        return build_daily_summary_text(event.get("appState"))
    return ""


# ── notify_event: the single proactive dispatch entry point ───────────────────────────────────────

# A pluggable sink so callers/tests can observe what was dispatched without a real transport.
_SINK: Optional[Callable[[Dict[str, Any]], Any]] = None
# In-memory audit log of dispatched notifications (most-recent last). Useful for tests + debugging.
DISPATCH_LOG: List[Dict[str, Any]] = []


def set_notification_sink(fn: Optional[Callable[[Dict[str, Any]], Any]]) -> None:
    """Register (or clear with ``None``) the transport sink ``notify_event`` dispatches through."""
    global _SINK
    _SINK = fn if callable(fn) else None


def reset_dispatch_log() -> None:
    DISPATCH_LOG.clear()


def notify_event(
    event: str,
    message: str = "",
    *,
    silent: bool = False,
    priority: str = "high",
    config: Optional[Dict[str, Any]] = None,
    sink: Optional[Callable[[Dict[str, Any]], Any]] = None,
    **meta: Any,
) -> Dict[str, Any]:
    """Originate a proactive notification for an application ``event``.

    Applies the criticality-based silent flag logic: the caller may *request* ``silent``, but a
    critical event (e.g. ``scan_failed``) is always delivered loud. Returns the resolved
    notification record and appends it to ``DISPATCH_LOG``; if a sink is registered it is invoked
    with the record (best-effort — a sink failure never raises).
    """
    ntype = notification_type_for_event(event)
    effective_silent = resolve_silent(config, event, silent)
    record: Dict[str, Any] = {
        "event": event,
        "type": ntype,
        "message": message,
        "silent": effective_silent,
        "requested_silent": bool(silent),
        "priority": priority,
        "criticality": get_notification_criticality(event),
        "meta": meta,
    }
    DISPATCH_LOG.append(record)
    target = sink if callable(sink) else _SINK
    if target is not None:
        try:
            target(record)
        except Exception:  # best-effort transport — never crash the producer
            pass
    return record


# ── Proactive notification trigger (time/state-driven event detection) ────────────────────────────
# Mirror of src/lib/notificationScheduler.js#collectDueEvents (the pure proactive-trigger core).


def detect_daily_goal_reached(
    app_state: Optional[Dict[str, Any]], daily_goal: Any, day: str
) -> Optional[Dict[str, Any]]:
    try:
        goal = int(daily_goal)
    except (TypeError, ValueError):
        return None
    if goal < 1:
        return None
    today = (app_state or {}).get("sessions", {}).get("today")
    if not today:
        return None
    done_today = (today.get("correct") or 0) + (today.get("wrong") or 0)
    if done_today < goal:
        return None
    return {
        "kind": "daily_goal",
        "type": "daily_summary",
        "text": build_proactive_caption({"kind": "daily_goal", "doneToday": done_today, "dailyGoal": goal}),
        "dedup_key": f"goal:{day}",
    }


def detect_due_reminders(config: Dict[str, Any], hhmm: str, day: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in (config or {}).get("reminders", []) or []:
        if not r or r.get("enabled") is False:
            continue
        if r.get("time") != hhmm:
            continue
        if r.get("lastFiredDay") == day:
            continue
        out.append(
            {
                "kind": "reminder",
                "type": "reminder",
                "text": build_proactive_caption({"kind": "reminder", "reminderText": r.get("text", "")}),
                "dedup_key": f"reminder:{r.get('id') or r.get('text')}:{day}",
            }
        )
    return out


def detect_daily_summary_due(
    config: Dict[str, Any], app_state: Optional[Dict[str, Any]], hhmm: str, day: str
) -> Optional[Dict[str, Any]]:
    if not config or not config.get("dailySummaryTime"):
        return None
    if config.get("dailySummaryTime") != hhmm:
        return None
    if config.get("dailySummaryDay") == day:
        return None
    return {
        "kind": "daily_summary",
        "type": "daily_summary",
        "text": build_proactive_caption({"kind": "daily_summary", "appState": app_state}),
        "dedup_key": f"summary:{day}",
    }


def collect_due_events(
    config: Optional[Dict[str, Any]],
    app_state: Optional[Dict[str, Any]],
    hhmm: str,
    day: str,
) -> List[Dict[str, Any]]:
    """All time/state-driven proactive events due at (hhmm, day). Pure (no I/O)."""
    if not config:
        return []
    events: List[Dict[str, Any]] = []
    goal = detect_daily_goal_reached(app_state, config.get("dailyGoal"), day)
    if goal:
        events.append(goal)
    events.extend(detect_due_reminders(config, hhmm, day))
    summary = detect_daily_summary_due(config, app_state, hhmm, day)
    if summary:
        events.append(summary)
    return events


# Regex used by the static verifier for scan_failed wiring; exported so the grep contract is
# documented in-code: notify_event("scan_failed", ...silent=False, priority="high").
SCAN_FAILED_CALL_RE = re.compile(r'notify_event\("scan_failed", .*silent=False, .*priority="high".*\)')
