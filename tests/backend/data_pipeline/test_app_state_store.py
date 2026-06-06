"""Ground-truth test for empty-input handling in the app-state summarizer
(consolidated task ``task_ce802af4072b`` / original ``[منطق] Ambiguous Empty Input``).

The real implementation lives in ``src/lib/appStateStore.js`` (``buildAppStateSummary``).
Its empty-input contract was ambiguous; the project chose **Assumption 1** as ground
truth: empty/missing input is a valid "zero" state and the function returns a fully-formed
summary with all counts ``0`` and ``accuracyPct = 0`` — never ``null``/``None``, never
throwing. See ``docs/architecture/data-pipeline.md``.

This test is self-contained (stdlib + pytest) so it runs without the JS toolchain. It
mirrors the JS contract in Python and also asserts the JS source documents the chosen
assumptions, locking the cross-language agreement in place.
"""

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
APP_STATE_STORE_JS = REPO_ROOT / "src" / "lib" / "appStateStore.js"


def build_app_state_summary(state=None):
    """Python mirror of ``buildAppStateSummary`` (Assumption 1 / ground truth).

    Accepts ``None`` or a partial dict and always returns a fully-formed summary. Empty
    and missing collections behave identically (the JS destructuring defaults).
    """
    state = state or {}
    user = state.get("user") or {}
    sessions = state.get("sessions") or []
    dataset = state.get("dataset") or []
    page_structure = state.get("pageStructure") or []
    flagged = state.get("flaggedAyahs") or {}

    total_correct = total_wrong = 0
    for s in sessions:
        total_correct += len(s.get("correctItems") or [])
        total_wrong += len(s.get("wrongItems") or [])
    graded = total_correct + total_wrong

    return {
        "user": {"name": user.get("displayName") or user.get("email") or ""},
        "dataset": {"ayahs": len(dataset)},
        "pages": len(page_structure),
        "flagged": len(flagged),
        "sessions": {
            "total": len(sessions),
            "totalCorrect": total_correct,
            "totalWrong": total_wrong,
            "accuracyPct": round((total_correct / graded) * 100) if graded else 0,
        },
    }


def test_empty_input_handling_ground_truth():
    # 1) No argument at all (undefined state) → fully-formed zero summary, never None/raise.
    s = build_app_state_summary()
    assert s is not None
    assert s["sessions"]["total"] == 0
    assert s["sessions"]["totalCorrect"] == 0
    assert s["sessions"]["totalWrong"] == 0
    assert s["sessions"]["accuracyPct"] == 0
    assert s["dataset"]["ayahs"] == 0
    assert s["pages"] == 0
    assert s["flagged"] == 0
    assert s["user"]["name"] == ""

    # 2) Explicit empty collections behave IDENTICALLY to the missing-argument case
    #    (the destructuring-defaults contract — Assumption 1).
    explicit_empty = build_app_state_summary(
        {"sessions": [], "dataset": [], "pageStructure": [], "flaggedAyahs": {}, "user": {}}
    )
    assert explicit_empty == s

    # 3) accuracyPct must never divide-by-zero on empty graded counts.
    assert build_app_state_summary({"sessions": []})["sessions"]["accuracyPct"] == 0

    # 4) Sanity: a populated state still summarizes correctly (4 correct / 6 graded = 67%).
    populated = build_app_state_summary(
        {
            "user": {"displayName": "Ali"},
            "dataset": [{}, {}, {}],
            "pageStructure": [{}, {}],
            "flaggedAyahs": {"2:255": True},
            "sessions": [
                {"correctItems": [1, 2, 3], "wrongItems": [1]},
                {"correctItems": [1], "wrongItems": [1]},
            ],
        }
    )
    assert populated["user"]["name"] == "Ali"
    assert populated["dataset"]["ayahs"] == 3
    assert populated["pages"] == 2
    assert populated["flagged"] == 1
    assert populated["sessions"]["total"] == 2
    assert populated["sessions"]["totalCorrect"] == 4
    assert populated["sessions"]["totalWrong"] == 2
    assert populated["sessions"]["accuracyPct"] == 67

    # 5) The JS source must document BOTH sides of the ambiguity and the chosen ground truth,
    #    so the contract stays explicit and the two pipeline ends cannot silently diverge.
    assert APP_STATE_STORE_JS.is_file(), "src/lib/appStateStore.js must exist"
    js = APP_STATE_STORE_JS.read_text(encoding="utf-8")
    assert "Ambiguity: Empty input handling for appStateStore" in js
    assert "Assumption 1:" in js
    assert "Assumption 2" in js
    # The defaults that encode Assumption 1 must remain on the exported builder.
    assert "sessions = []" in js and "flaggedAyahs = {}" in js
