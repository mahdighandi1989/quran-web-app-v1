"""Discoverability/accessibility test for AI conversation initiation
(task task_bd3f356bffe0, subtask 5).

The AI system must be discoverable and usable: a user must be able to *initiate an AI
conversation* from the UI, with accessible affordances (labelled controls, live regions) and
clear guidance when AI is not yet configured. These self-contained tests (stdlib + pytest, no
JS toolchain) assert the source provides those affordances and that a successful initiation is
instrumented as a measurable interaction.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AI_WIDGETS = REPO_ROOT / "src" / "components" / "AIWidgets.jsx"
AI_EXAM = REPO_ROOT / "src" / "components" / "AIExamGenerator.jsx"


def _read(p):
    assert p.is_file(), f"missing {p}"
    return p.read_text(encoding="utf-8")


def test_user_can_initiate_ai_conversation():
    widgets = _read(AI_WIDGETS)
    exam = _read(AI_EXAM)

    # 1) There is a chat surface to initiate a conversation: an input + a send action.
    assert "AIChat" in widgets, "AIWidgets must expose an AIChat surface"
    assert "ارسال" in widgets, "AIChat must have a send button"
    assert re.search(r"on(KeyDown|KeyPress)=", widgets), "AIChat must support Enter-to-send"

    # 2) Accessibility: the chat surface is labelled, has a live log, and surfaces errors as alerts.
    assert 'role="region"' in widgets and "aria-label=" in widgets, (
        "the AI chat region must be labelled for assistive tech"
    )
    assert 'aria-live="polite"' in widgets or 'role="log"' in widgets, (
        "the AI chat transcript must be an announced live region"
    )
    assert 'role="alert"' in widgets, "AI errors must be announced to assistive tech"
    # The assist button advertises its expandable popup.
    assert "aria-expanded=" in widgets and "aria-label=" in widgets, (
        "the AI assist button must expose aria-expanded/aria-label"
    )

    # 3) Discoverability when unconfigured: clear guidance pointing to settings.
    assert "تنظیمات → هوش مصنوعی" in widgets, (
        "unconfigured AI must guide the user to settings (discoverability)"
    )
    # Controls are gated on readiness so users are not left clicking dead buttons.
    assert "isAIReady" in widgets, "AI surfaces must gate on isAIReady()"

    # 4) A successful initiation is measured (so adoption is observable).
    assert "trackAIInteraction" in widgets, "initiating an AI chat must be instrumented"
    assert "trackAIInteraction" in exam, "generating an AI exam must be instrumented"

    # 5) The exam surface also exposes accessible feedback (error alert role).
    assert 'role="alert"' in exam, "AIExamGenerator must announce errors as alerts"
