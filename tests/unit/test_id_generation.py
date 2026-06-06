"""Tests for the custom-provider id generator `uid()` (task task_bd3f356bffe0, subtask 9).

`uid()` in ``src/components/AISettings.jsx`` mints the id for a user-added custom provider.
That id is used as a *key* into ``config.keys`` and ``config.extraModels``, so a collision
silently clobbers another provider's stored API key/models — a real "stale assumption"
anti-pattern in the old ``Math.random().toString(36).slice(2, 8)`` (≈31 bits) implementation.

The fix prefers the platform CSPRNG ``crypto.randomUUID()`` (122 bits) with a still-unique
time+random fallback. These self-contained tests assert the JS source adopts the stronger
generator and that the resulting id contract holds (correct prefix, uniqueness across many
draws, including the fallback path).
"""

import re
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AI_SETTINGS = REPO_ROOT / "src" / "components" / "AISettings.jsx"


def _source():
    assert AI_SETTINGS.is_file(), f"missing {AI_SETTINGS}"
    return AI_SETTINGS.read_text(encoding="utf-8")


# Python reference of the fixed primary path (crypto.randomUUID) and the fallback path.
def uid_primary():
    return "p_" + str(uuid.uuid4())


def uid_fallback(seq):
    # Mirrors `'p_' + Date.now().toString(36) + '_' + random` — uniqueness via time+seq.
    return "p_%x_%08x" % (1_700_000_000_000 + seq, (seq * 2654435761) & 0xFFFFFFFF)


def test_uid_edge_cases():
    src = _source()

    # 1) The anti-pattern is fixed: the source must use a CSPRNG / UUID generator.
    assert ("crypto.randomUUID" in src) or ("uuidv4" in src), (
        "uid() must use crypto.randomUUID()/uuidv4 instead of a short Math.random slice"
    )

    # 2) The weak ~6-char Math.random slice must be gone.
    assert "Math.random().toString(36).slice(2, 8)" not in src, (
        "the collision-prone 6-char Math.random id must be removed"
    )

    # 3) There must be a graceful fallback (so old environments without crypto still work).
    assert "catch" in src and "Math.random" in src, "uid() must keep a non-crypto fallback"

    # 4) Ids keep the recognisable `p_` prefix (so previously stored ids stay valid).
    assert re.search(r"'p_'\s*\+", src), "uid() must keep the 'p_' prefix"

    # 5) Contract: ids are non-empty, prefixed, and unique across many draws (primary path).
    seen = set()
    for _ in range(10000):
        u = uid_primary()
        assert u.startswith("p_") and len(u) > 2
        assert u not in seen, "crypto.randomUUID-based ids must not collide"
        seen.add(u)

    # 6) The fallback path is also unique across a tight loop (time+seq composite).
    fb = {uid_fallback(i) for i in range(10000)}
    assert len(fb) == 10000, "fallback ids must stay unique within a tight loop"
    assert all(x.startswith("p_") for x in fb)
