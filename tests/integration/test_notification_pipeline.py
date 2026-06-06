"""Integration tests for the notification pipeline (proactive triggering + silent flag policy +
caption generation + the TelegramSettings role + the scan_failed critical event).

This is the regression guard for the consolidated "notification pipeline" task. Following the repo
convention (see ``tests/test_engagement_outcome.py`` / ``tests/test_anti_pattern_edge_case.py``)
the tests are self-contained (stdlib + pytest only) so they run in a verification environment
without the JS toolchain. They exercise the importable Python ground-truth reference
(``backend/app/notification_pipeline.py`` and the scan handlers/tasks) AND assert that the JS
implementation (``src/lib/*.js``, ``src/components/TelegramSettings.jsx``) is wired to the same
policy, so the documented behaviour and the shipped code can never drift.
"""

import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.notification_pipeline import (  # noqa: E402
    CRITICALITY_CRITICAL,
    CRITICALITY_ROUTINE,
    build_daily_summary_text,
    build_goal_reached_text,
    build_proactive_caption,
    build_reminder_text,
    collect_due_events,
    get_notification_criticality,
    is_critical_notification,
    notify_event,
    notification_type_for_event,
    reset_dispatch_log,
    resolve_silent,
)
from backend.app.handlers.scan_failure_handler import (  # noqa: E402
    SCAN_FAILED_MESSAGE,
    handle_scan_failed,
)
from backend.app.tasks.scan_tasks import notify_scan_failed, run_quran_scan  # noqa: E402

TELEGRAM_JS = REPO_ROOT / "src" / "lib" / "telegram.js"
SCHEDULER_JS = REPO_ROOT / "src" / "lib" / "notificationScheduler.js"
RULES_JS = REPO_ROOT / "src" / "lib" / "notificationRules.js"
FORMATTER_JS = REPO_ROOT / "src" / "lib" / "proactiveNotificationFormatter.js"
SETTINGS_JSX = REPO_ROOT / "src" / "components" / "TelegramSettings.jsx"
ADR_DOC = REPO_ROOT / "docs" / "adr" / "00x_silent_flag_logic.md"


def _live_config(**overrides):
    cfg = {
        "enabled": True,
        "botToken": "BOT",
        "primaryChatId": "555",
        "tzOffsetMinutes": 0,
        "dailyGoal": 0,
        "reminders": [],
        "notifications": {
            "session_complete": {"enabled": True, "silent": False},
            "exam_result": {"enabled": True, "silent": False},
            "critical_error": {"enabled": True, "silent": True},  # user TRIES to silence it
            "drive_sync": {"enabled": False, "silent": True},
            "reminder": {"enabled": True, "silent": False},
            "daily_summary": {"enabled": False, "silent": True},
            "new_login": {"enabled": False, "silent": True},
        },
    }
    cfg.update(overrides)
    return cfg


# ── ST1: proactive notification triggering ───────────────────────────────────────────────────────
def test_proactive_notification_triggering():
    """The proactive trigger turns time/state events into notifications with the right captions.

    Ground truth: a dedicated scheduler owns the 'event -> notify_event' logic. Given a config with
    a due reminder, a reached daily goal and a due daily summary, collect_due_events() must surface
    exactly those proactive events (the bug being that nothing connected app events to sends)."""
    app_state = {"sessions": {"total": 9, "last7Days": 5, "accuracyPct": 80,
                              "today": {"sessions": 3, "correct": 25, "wrong": 5}}}
    config = _live_config(
        dailyGoal=10,
        dailySummaryTime="08:00",
        reminders=[{"id": "r1", "time": "08:00", "text": "مرور صفحهٔ ۱", "enabled": True}],
    )
    events = collect_due_events(config, app_state, "08:00", "2026-01-15")
    kinds = {e["kind"] for e in events}
    assert kinds == {"daily_goal", "reminder", "daily_summary"}, (
        "the proactive trigger must fire the daily-goal, reminder and daily-summary events that are "
        f"due at this minute; got {kinds}"
    )
    # Each event carries a non-empty caption and a stable dedup key (so it fires at most once).
    for ev in events:
        assert ev["text"], f"proactive event {ev['kind']} must carry a caption"
        assert ev["dedup_key"], f"proactive event {ev['kind']} must carry a dedup key"

    # Time-bound events (reminder, daily summary) do not fire at the wrong minute; the daily-goal
    # event is state-bound (fires whenever the goal is met), so it remains due at 09:00.
    off_minute = collect_due_events(config, app_state, "09:00", "2026-01-15")
    assert {e["kind"] for e in off_minute} == {"daily_goal"}
    # With no daily goal configured and the wrong minute, nothing fires at all.
    no_goal = _live_config(dailySummaryTime="08:00",
                           reminders=[{"id": "r1", "time": "08:00", "text": "x", "enabled": True}])
    assert collect_due_events(no_goal, app_state, "09:00", "2026-01-15") == []
    assert collect_due_events(None, app_state, "08:00", "2026-01-15") == []

    # A reminder already fired today (lastFiredDay) is suppressed (cross-tier dedup).
    fired = _live_config(reminders=[{"id": "r1", "time": "08:00", "text": "x",
                                     "enabled": True, "lastFiredDay": "2026-01-15"}])
    assert collect_due_events(fired, app_state, "08:00", "2026-01-15") == []

    # The JS scheduler is the matching owner of this proactive notification trigger.
    sched = SCHEDULER_JS.read_text(encoding="utf-8")
    assert "collectDueEvents" in sched and "proactive notification trigger" in sched


# ── ST2: silent flag logic ground truth (criticality-based) ──────────────────────────────────────
def test_silent_flag_ground_truth():
    """Critical notifications can NEVER be silent — overriding both config and caller override.

    This is the resolved coherence bug: importance and the silent flag were decoupled, so a user
    could silence a critical alert. Ground truth: critical => always loud."""
    cfg = _live_config()  # critical_error is configured silent=True by the user here

    # 1) critical type: forced loud regardless of config silent=True ...
    assert resolve_silent(cfg, "critical_error") is False
    # ... and regardless of an explicit silent=True override.
    assert resolve_silent(cfg, "critical_error", True) is False
    # ... and the scan_failed EVENT (routed through critical_error) is critical too.
    assert is_critical_notification("scan_failed") is True
    assert resolve_silent(cfg, "scan_failed", True) is False

    # 2) non-critical type: the user's config / override is honoured.
    assert resolve_silent(cfg, "daily_summary") is True          # config default
    assert resolve_silent(cfg, "reminder") is False              # config default
    assert resolve_silent(cfg, "reminder", True) is True         # explicit override wins
    assert resolve_silent(cfg, "daily_summary", False) is False  # explicit override wins

    # 3) classification is exactly the documented table.
    assert get_notification_criticality("critical_error") == CRITICALITY_CRITICAL
    assert get_notification_criticality("daily_summary") == CRITICALITY_ROUTINE
    assert get_notification_criticality("session_complete") == "important"
    # unknown types fail safe to routine (never accidentally critical).
    assert get_notification_criticality("totally_new_type") == CRITICALITY_ROUTINE
    assert is_critical_notification("totally_new_type") is False

    # 4) the frontend transport is ALIGNED with the same policy (resolveSilent + classification).
    tg = TELEGRAM_JS.read_text(encoding="utf-8")
    assert "resolveSilent" in tg and "NOTIFICATION_CRITICALITY" in tg
    assert "isCriticalNotification" in tg
    # notify() must route through the policy, not read the raw silent flag directly any more.
    assert re.search(r"resolveSilent\(\s*tg\s*,\s*type\s*,\s*silentOverride\s*\)", tg), (
        "src/lib/telegram.js#notify must derive `silent` via resolveSilent(tg, type, override)"
    )
    # the ADR documents the same ground truth.
    adr = ADR_DOC.read_text(encoding="utf-8")
    assert "silent flag logic" in adr and "ground truth" in adr.lower()


# ── ST4: the role of TelegramSettings.jsx (controlled view) ──────────────────────────────────────
def test_telegram_settings_integration():
    """TelegramSettings.jsx is a CONTROLLED settings view aligned to the pipeline's silent policy.

    Ground truth: it owns no durable config (App.jsx does, via config/setConfig) and it must not
    offer a silent toggle the transport would override for critical notifications."""
    src = SETTINGS_JSX.read_text(encoding="utf-8")

    # role conflict resolved + ground truth recorded in-file.
    assert "CONFLICT_RESOLUTION: Ambiguous Role of TelegramSettings.jsx - Side A identified" in src
    assert "CONFLICT_RESOLUTION: Ambiguous Role of TelegramSettings.jsx - Side B identified" in src
    assert "GROUND_TRUTH: TelegramSettings.jsx role defined as:" in src
    assert "ALIGNED: TelegramSettings.jsx now reflects ground truth" in src

    # controlled component: config flows via props + every mutation goes through setConfig.
    assert "config, setConfig" in src
    assert "setConfig((c)" in src, "config edits must be emitted up via the setConfig prop"

    # the UI enforces the criticality policy: silent toggle disabled for critical types.
    assert "isCriticalNotification" in src
    assert re.search(r"disabled=\{critical\}", src), (
        "the silent checkbox must be disabled for critical notification types"
    )
    # critical rows force the silent value to false in the UI too.
    assert re.search(r"checked=\{critical \? false", src)

    # addReminder remains functional (the under-engineering fix): it patches reminders state.
    assert "const addReminder" in src
    m = re.search(r"const addReminder = \(\) => \{(.+?)\};", src, re.S)
    assert m and "patch(" in m.group(1) and "reminders" in m.group(1), (
        "addReminder must actually patch the reminders config (not validate-then-noop)"
    )


# ── ST5: caption generation for proactive notifications ──────────────────────────────────────────
def test_proactive_notification_caption_generation_integration():
    """Proactive notifications get rich, context-aware captions from a dedicated generator.

    Ground truth: a single caption generator owns proactive message content (was previously absent /
    ad-hoc). Captions must reflect the supplied app-state/context."""
    app_state = {"sessions": {"total": 12, "last7Days": 6, "accuracyPct": 91,
                              "today": {"sessions": 4, "correct": 30, "wrong": 3}}}

    summary = build_proactive_caption({"kind": "daily_summary", "appState": app_state})
    assert "خلاصهٔ روزانه" in summary
    assert "4 جلسه" in summary and "30 درست / 3 غلط" in summary  # context-aware (not generic)
    assert "91%" in summary and "6" in summary

    goal = build_proactive_caption({"kind": "daily_goal", "doneToday": 33, "dailyGoal": 30})
    assert "هدف امروز محقق شد" in goal and "33" in goal and "30" in goal

    reminder = build_proactive_caption({"kind": "reminder", "reminderText": "مرور صفحهٔ ۵"})
    assert reminder == "⏰ یادآوری: مرور صفحهٔ ۵"

    # empty / unknown context never crashes; yields an empty caption.
    assert build_proactive_caption({}) == ""
    assert build_proactive_caption({"kind": "nope"}) == ""

    # an empty app-state still yields a meaningful (non-empty) daily summary, not a blank message.
    assert build_daily_summary_text(None).strip() != ""

    # parity with the direct rule builders (the generator delegates to the shared rules).
    assert build_proactive_caption({"kind": "daily_goal", "doneToday": 5, "dailyGoal": 3}) == \
        build_goal_reached_text(5, 3)
    assert build_proactive_caption({"kind": "reminder", "reminderText": "x"}) == build_reminder_text("x")

    # the JS pipeline ships the matching dedicated caption generator, wired into the scheduler.
    assert FORMATTER_JS.exists(), "src/lib/proactiveNotificationFormatter.js must exist"
    fmt = FORMATTER_JS.read_text(encoding="utf-8")
    assert "buildProactiveCaption" in fmt
    sched = SCHEDULER_JS.read_text(encoding="utf-8")
    assert "buildProactiveCaption" in sched, (
        "notificationScheduler.js must delegate caption building to the formatter"
    )


# ── ST6: scan_failed critical notification ───────────────────────────────────────────────────────
def test_scan_failed_emits_high_priority_loud_notification():
    """The scan_failed critical event must emit a high-priority, non-silent notification."""
    reset_dispatch_log()
    captured = []
    rec = handle_scan_failed("ردیف نامعتبر در شیت ۲", sink=captured.append)

    assert rec["event"] == "scan_failed"
    assert rec["type"] == "critical_error"
    assert notification_type_for_event("scan_failed") == "critical_error"
    assert rec["priority"] == "high"
    assert rec["silent"] is False  # critical -> always loud
    assert rec["criticality"] == CRITICALITY_CRITICAL
    assert SCAN_FAILED_MESSAGE.split("؛")[0][:6] in rec["message"]  # Persian, meaningful template
    assert "جزئیات: ردیف نامعتبر در شیت ۲" in rec["message"]
    assert captured and captured[0]["event"] == "scan_failed"  # dispatched through the transport

    # Even if a caller mistakenly REQUESTS silent=True, the policy forces it loud.
    rec2 = notify_scan_failed("x")
    assert rec2["silent"] is False and rec2["priority"] == "high"

    # The scan task wires the failure path: a failing scan triggers the notification then re-raises.
    reset_dispatch_log()
    sink = []

    def boom():
        raise RuntimeError("corrupt xlsx")

    with pytest.raises(RuntimeError):
        run_quran_scan(boom, sink=sink.append)
    assert sink and sink[0]["event"] == "scan_failed" and sink[0]["silent"] is False

    # A successful scan does NOT notify.
    reset_dispatch_log()
    sink2 = []
    out = run_quran_scan(lambda: 42, sink=sink2.append)
    assert out == {"ok": True, "result": 42} and sink2 == []


def test_notify_event_routes_through_silent_policy():
    """notify_event applies the silent flag logic for every event, not just scan_failed."""
    reset_dispatch_log()
    cfg = _live_config()
    # routine event honours config silent default.
    rec = notify_event("daily_summary", "hi", silent=None, config=cfg)
    assert rec["silent"] is True
    # important event with explicit silent override.
    rec2 = notify_event("reminder", "r", silent=True, config=cfg)
    assert rec2["silent"] is True
    # critical event ignores requested silent.
    rec3 = notify_event("critical_error", "boom", silent=True, config=cfg)
    assert rec3["silent"] is False


def test_js_and_python_pipelines_share_one_classification():
    """Cross-tier coherence: the JS NOTIFICATION_CRITICALITY map matches the Python one exactly."""
    from backend.app.notification_pipeline import NOTIFICATION_CRITICALITY

    tg = TELEGRAM_JS.read_text(encoding="utf-8")
    block = re.search(r"NOTIFICATION_CRITICALITY\s*=\s*\{(.+?)\};", tg, re.S)
    assert block, "src/lib/telegram.js must define NOTIFICATION_CRITICALITY"
    js_map = dict(re.findall(r"(\w+):\s*CRITICALITY\.(\w+)", block.group(1)))
    assert js_map, "could not parse the JS criticality map"
    js_norm = {k: v.lower() for k, v in js_map.items()}
    assert js_norm == NOTIFICATION_CRITICALITY, (
        "the JS and Python criticality classifications must be identical (cross-tier ground truth).\n"
        f"JS: {js_norm}\nPY: {NOTIFICATION_CRITICALITY}"
    )
