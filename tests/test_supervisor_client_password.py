"""The supervisor password comes from the run's environment; Render only with explicit opt-in (2026-11-09)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "supervisor"))
import client  # noqa: E402


@pytest.fixture
def no_render(monkeypatch):
    calls = []
    monkeypatch.setattr(client, "service_url", lambda sid: "https://bot.example")
    monkeypatch.setattr(client, "render_get", lambda path: calls.append(path) or [])
    for v in ("SUPERVISOR_PASSWORD", "QS_SUPERVISOR_PASSWORD", "QS_API_BASE", "QS_PASSWORD_FROM_RENDER"):
        monkeypatch.delenv(v, raising=False)
    return calls


def test_missing_password_is_a_clear_error_and_render_env_vars_are_not_read(no_render):
    with pytest.raises(client.SupervisorError, match="SUPERVISOR_PASSWORD"):
        client.Client()
    assert not any("env-vars" in p for p in no_render)


def test_supervisor_password_env_name_is_accepted(no_render, monkeypatch):
    monkeypatch.setenv("SUPERVISOR_PASSWORD", "x")
    c = client.Client()
    assert c.source == "env" and c.base == "https://bot.example"
    assert not any("env-vars" in p for p in no_render)


def test_render_password_only_with_explicit_opt_in(no_render, monkeypatch):
    monkeypatch.setenv("QS_PASSWORD_FROM_RENDER", "1")
    monkeypatch.setattr(client, "render_get", lambda path: [{"envVar": {"key": "SUPERVISOR_PASSWORD", "value": "y"}}])
    c = client.Client()
    assert c.source == "render"
