"""Integration test for the frontend "data" pipeline: app-state + quran-sample
summarization feeding the Firestore mirror that the Telegram bot reads
(consolidated task ``task_ce802af4072b``).

The pipeline (see ``docs/architecture/data-pipeline.md``) is:

    App state ─▶ buildAppStateSummary / buildQuranSample ─▶ saveAppState / saveQuranSample
                 (src/lib/appStateStore.js)                   (Firestore appState/{uid},
                                                               quranSamples/{uid})

This guard exercises the empty → populated path end-to-end with a Python mirror of the
two pure builders, asserting the whole pipeline never throws and always yields a stable,
serializable shape (the contract the downstream bot relies on). Self-contained
(stdlib + pytest) so it runs without the JS toolchain.
"""

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent

# Reuse the ground-truth mirror from the unit test so both stay in lockstep.
from tests.backend.data_pipeline.test_app_state_store import build_app_state_summary


def build_quran_sample(dataset=None, cap=300, sessions=None):
    """Python mirror of ``buildQuranSample`` — capped ayah slice + top mistakes.

    Mirrors the JS: skip malformed rows (missing surah/ayah), skip rows with no text,
    cap the ayah list, and surface the most-mistaken ayahs that we have text for.
    """
    dataset = dataset or []
    sessions = sessions or []
    items = []
    by_key = {}
    for a in dataset:
        if a.get("surah_number") is None or a.get("ayah_number") is None:
            continue
        with_dia = " ".join(a.get("tokens_with_diacritics") or a.get("tokens") or [])
        plain = " ".join(a.get("tokens_plain") or a.get("tokens") or [])
        if not with_dia and not plain:
            continue
        rec = {
            "s": a["surah_number"], "a": a["ayah_number"],
            "n": a.get("surah_name", ""), "t": with_dia or plain, "p": plain or with_dia,
        }
        by_key[f"{a['surah_number']}:{a['ayah_number']}"] = rec
        if len(items) < cap:
            items.append(rec)

    wrong = {}
    for sess in sessions:
        for w in sess.get("wrongItems") or []:
            k = f"{w.get('surah')}:{w.get('ayah')}"
            wrong[k] = wrong.get(k, 0) + 1
    top = []
    for k, count in sorted(wrong.items(), key=lambda kv: kv[1], reverse=True):
        r = by_key.get(k)
        if r:
            top.append({**r, "wrong": count})
    return {"count": len(items), "ayahs": items, "topMistakes": top[:50]}


def _assert_serializable(*objs):
    """The whole point of the mirror: every doc written to Firestore must serialize."""
    for o in objs:
        json.dumps(o)  # raises TypeError on a non-serializable value


def test_empty_state_pipeline_does_not_fail():
    # Empty/new user: the whole pipeline must produce stable, serializable zero docs.
    summary = build_app_state_summary({})
    sample = build_quran_sample([], 800, [])
    _assert_serializable(summary, sample)
    assert summary["sessions"]["total"] == 0
    assert sample["count"] == 0
    assert sample["topMistakes"] == []


def test_populated_state_pipeline_end_to_end():
    dataset = [
        {"surah_number": 2, "ayah_number": 255, "surah_name": "البقرة",
         "tokens_with_diacritics": ["اللَّهُ", "لَا"], "tokens_plain": ["الله", "لا"]},
        {"surah_number": 1, "ayah_number": 1, "surah_name": "الفاتحة",
         "tokens_plain": ["بسم", "الله"]},
        # malformed rows must be skipped, never crash the pipeline:
        {"ayah_number": 5},
        {"surah_number": 3, "ayah_number": 7},  # no text -> skipped
    ]
    sessions = [
        {"correctItems": [1, 2, 3], "wrongItems": [{"surah": 2, "ayah": 255}]},
        {"correctItems": [1], "wrongItems": [{"surah": 2, "ayah": 255}, {"surah": 1, "ayah": 1}]},
    ]

    summary = build_app_state_summary({"dataset": dataset, "sessions": sessions})
    sample = build_quran_sample(dataset, 800, sessions)
    _assert_serializable(summary, sample)

    # summary side
    assert summary["sessions"]["total"] == 2
    assert summary["sessions"]["totalCorrect"] == 4
    assert summary["sessions"]["totalWrong"] == 3
    assert summary["dataset"]["ayahs"] == 4  # counts raw rows, malformed included

    # sample side: only the two well-formed, text-bearing rows survive
    assert sample["count"] == 2
    assert {r["s"] for r in sample["ayahs"]} == {1, 2}
    # 2:255 was missed twice, 1:1 once → sorted, both have text
    assert sample["topMistakes"][0] == {
        "s": 2, "a": 255, "n": "البقرة",
        "t": "اللَّهُ لَا", "p": "الله لا", "wrong": 2,
    }
    assert len(sample["topMistakes"]) == 2


def test_docs_document_the_pipeline():
    # Cross-tier doc sync: the architecture note for this pipeline must exist and explain
    # the empty-input ground truth (so the contract is discoverable, not just in code).
    doc = REPO_ROOT / "docs" / "architecture" / "data-pipeline.md"
    assert doc.is_file(), "docs/architecture/data-pipeline.md must document the pipeline"
    text = doc.read_text(encoding="utf-8")
    assert "Empty input handling" in text
    assert "GROUND TRUTH" in text
