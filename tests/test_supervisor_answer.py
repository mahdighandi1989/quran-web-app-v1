"""scripts/supervisor/inspection.py answer: success only when the server shows the answer (read-back), and the last
line is `ANSWERED <n>` (2026-11-05 — a «sent» answer that never reached the server used to look like success)."""
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "supervisor"))
import inspection as ins  # noqa: E402
from client import SupervisorError  # noqa: E402


class FakeClient:
    def __init__(self, store=True):
        self.sheet = {"notes": [{"by": "owner", "text": "x"}], "status": "open"}
        self.store = store

    def api(self, path, *, body=None, method=None):
        if path.endswith("/notes"):
            if self.store:
                self.sheet["notes"].append({"by": "reviewer", "text": body["text"]})
            return {"report": {"status_label": "ناظر پاسخ داد", "glow": "green"}}
        return {"report": self.sheet}


def _args(tmp_path, text="۱) انجام شد"):
    f = tmp_path / "a.md"
    f.write_text(text, encoding="utf-8")
    return SimpleNamespace(number=9, text_file=str(f), outcome="partial", commit=["abc1234"], dep=["src/App.jsx=ok"],
                           place="", no_change_reason="", after=None)


def test_answer_is_proven_by_reading_back(tmp_path, capsys):
    assert ins.cmd_answer(FakeClient(), _args(tmp_path)) == 0
    assert capsys.readouterr().out.strip().splitlines()[-1] == "ANSWERED 9"


def test_an_answer_the_server_does_not_show_fails(tmp_path):
    with pytest.raises(SupervisorError):
        ins.cmd_answer(FakeClient(store=False), _args(tmp_path))
