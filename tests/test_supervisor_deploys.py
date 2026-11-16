"""deploys.py must not report «not deployed» from a shallow clone's boundary commit (2026-11-16)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "supervisor"))
import deploys  # noqa: E402


def _fake_render(live_commit="abc1234def"):
    def get(path):
        if path.endswith("/events?limit=50"):
            return []
        if "/deploys" in path:
            return [{"deploy": {"id": "d1", "status": "live", "commit": {"id": live_commit},
                                "createdAt": "2026-01-01T00:00:00Z"}}]
        if path.endswith("/instances"):
            return [{"status": "RUNNING"}]
        return {"type": "web_service", "suspended": "not_suspended", "serviceDetails": {}}
    return get


def test_shallow_clone_reports_unmeasured_not_a_problem(monkeypatch):
    monkeypatch.setattr(deploys, "render_get", _fake_render())
    monkeypatch.setattr(deploys, "_shallow", lambda: True)
    rep = deploys.check()
    assert rep["ok"] is True and rep["problems"] == []
    for row in rep["services"].values():
        assert row["pending_commits"] is None and "shallow" in row["pending_note"]


def test_full_clone_still_reports_pending_commits(monkeypatch):
    monkeypatch.setattr(deploys, "render_get", _fake_render())
    monkeypatch.setattr(deploys, "_shallow", lambda: False)
    monkeypatch.setattr(deploys, "_pending", lambda paths, since: ["f" * 40])
    rep = deploys.check()
    assert any(p["p"] == "P2" and "منتشر نشده" in p["what"] for p in rep["problems"])
