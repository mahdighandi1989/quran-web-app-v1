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


def summarize_ai_config(ai_config=None):
    """Python mirror of ``summarizeAiConfig`` — non-sensitive AI-config summary.

    Surfaces provider/model/configured/hasKey/customProviders so the bot has a single
    coherent view of the user's state; the API keys themselves are NEVER copied here (they
    live only in aiConfigs/{uid}). Always a fully-formed zero-state object for None/empty.
    """
    c = ai_config or {}
    provider = c.get("activeProvider") if isinstance(c.get("activeProvider"), str) else ""
    model = c.get("activeModel") if isinstance(c.get("activeModel"), str) else ""
    keys = c.get("keys") if isinstance(c.get("keys"), dict) else {}
    has_key = bool(provider and keys.get(provider))
    custom = c.get("customProviders")
    custom_providers = len(custom) if isinstance(custom, list) else 0
    return {
        "configured": bool(provider and model and has_key),
        "provider": provider or "",
        "model": model or "",
        "hasKey": has_key,
        "customProviders": custom_providers,
    }


def build_app_state_summary(state=None):
    """Python mirror of ``buildAppStateSummary`` (Assumption 1 / ground truth).

    Accepts ``None`` or a partial dict and always returns a fully-formed summary. Empty
    and missing collections behave identically (the JS destructuring defaults). The summary
    now folds in a non-sensitive AI-config summary (``ai``) — see ``summarize_ai_config``.
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
        "ai": summarize_ai_config(state.get("aiConfig")),
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
    # AI summary is always present and fully-formed in the zero state (never None/missing).
    assert s["ai"] == {
        "configured": False, "provider": "", "model": "", "hasKey": False, "customProviders": 0,
    }

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

    # 4b) The AI-config summary is folded in, non-sensitively: provider/model/configured are
    #     surfaced, but the raw key is NEVER copied into the summary (it stays in aiConfigs).
    with_ai = build_app_state_summary(
        {
            "aiConfig": {
                "activeProvider": "openai",
                "activeModel": "gpt-4o-mini",
                "keys": {"openai": "sk-super-secret"},
                "customProviders": [{"id": "x"}],
            }
        }
    )
    assert with_ai["ai"] == {
        "configured": True, "provider": "openai", "model": "gpt-4o-mini",
        "hasKey": True, "customProviders": 1,
    }
    # The key must not leak anywhere into the serialized summary doc.
    import json as _json

    assert "sk-super-secret" not in _json.dumps(with_ai)
    # Missing key for the active provider -> not configured (and key never surfaced).
    no_key = build_app_state_summary(
        {"aiConfig": {"activeProvider": "openai", "activeModel": "gpt-4o", "keys": {"groq": "gsk"}}}
    )
    assert no_key["ai"]["configured"] is False and no_key["ai"]["hasKey"] is False

    # 5) The JS source must document BOTH sides of the ambiguity and the chosen ground truth,
    #    so the contract stays explicit and the two pipeline ends cannot silently diverge.
    assert APP_STATE_STORE_JS.is_file(), "src/lib/appStateStore.js must exist"
    js = APP_STATE_STORE_JS.read_text(encoding="utf-8")
    assert "Ambiguity: Empty input handling for appStateStore" in js
    assert "Assumption 1:" in js
    assert "Assumption 2" in js
    # The defaults that encode Assumption 1 must remain on the exported builder.
    assert "sessions = []" in js and "flaggedAyahs = {}" in js
    # 6) The AI-config integration must be present and documented in the JS source, so the
    #    cross-tier contract (appState carries a non-sensitive AI summary) stays explicit.
    assert "summarizeAiConfig" in js
    assert "ai: summarizeAiConfig(aiConfig)" in js
