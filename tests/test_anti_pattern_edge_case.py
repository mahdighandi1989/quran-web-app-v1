"""Edge-case test for handling the large/verbose package-lock.json (task 5e99a172).

A static "over-engineering" scan flagged ``package-lock.json`` (around line 15) for its
exhaustive list of platform-specific optional dependencies (every ``@esbuild/*`` target,
etc.). As documented in ``docs/package-lock-verbosity.md`` this verbosity is the intended
behavior of ``lockfileVersion: 3`` and must be preserved for cross-platform reproducible
installs — it is *not* an anti-pattern to "optimize" away.

This test guards two things:

  1. A small, self-contained ``load_lockfile`` parser handles the edge cases of reading
     such a file robustly: valid JSON object, blank/whitespace, invalid JSON, and a
     payload that parses but is not a lockfile object (None / primitive / array) are all
     handled with a clear, surfaced error rather than a silent crash or bad value.
  2. The committed ``package-lock.json`` itself stays valid JSON, stays at
     ``lockfileVersion: 3``, and keeps its optional platform dependencies — i.e. nobody
     hand-strips the "verbose" entries and breaks reproducible installs.

The test is intentionally self-contained (stdlib + pytest only) so it can run in a
verification environment without the JS toolchain.
"""

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
PACKAGE_LOCK = REPO_ROOT / "package-lock.json"


class LockfileError(ValueError):
    """Raised when a package-lock body is not a usable JSON lockfile object."""


def load_lockfile(raw_text):
    """Parse + structurally validate a package-lock.json body.

    Mirrors the validation command in the task spec
    (``python -c "import json; json.load(open('package-lock.json'))"``) but hardens it
    against the edge cases of an oversized/handwritten file: invalid JSON, an empty
    body, or a payload that parses yet is not a lockfile object (e.g. a bare array or a
    primitive). Returns the parsed dict on success.
    """
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise LockfileError("package-lock.json body is empty or not text")
    try:
        data = json.loads(raw_text)
    except (ValueError, TypeError):
        raise LockfileError("package-lock.json is not parseable JSON")
    # A lockfile is a JSON object. An array/primitive parses but is not a lockfile.
    if not isinstance(data, dict):
        raise LockfileError("package-lock.json must be a JSON object")
    if data.get("lockfileVersion") != 3:
        raise LockfileError("package-lock.json must declare lockfileVersion: 3")
    return data


def test_oversized_lockfile_handling():
    # 1) Empty / non-string bodies are rejected, never silently treated as a lockfile.
    for bad in (None, "", "   ", "\n\t ", 42, b"{}", {}):
        with pytest.raises(LockfileError):
            load_lockfile(bad)

    # 2) Bodies that are not valid JSON are rejected with a clear error.
    for bad_json in ("not json", "{unterminated", "12345abc", "{,}"):
        with pytest.raises(LockfileError):
            load_lockfile(bad_json)

    # 3) JSON that parses but is not a lockfile object (array / primitive) is rejected.
    for primitive_json in ("[]", "[1,2,3]", "12345", '"lock"', "true", "null"):
        with pytest.raises(LockfileError):
            load_lockfile(primitive_json)

    # 4) A wrong lockfileVersion is rejected (guards against silently accepting a v1/v2
    #    file that would not carry the full optional-dependency graph).
    assert load_lockfile(json.dumps({"lockfileVersion": 3, "packages": {}}))[
        "lockfileVersion"
    ] == 3
    for wrong in (1, 2, "3", None):
        with pytest.raises(LockfileError):
            load_lockfile(json.dumps({"lockfileVersion": wrong, "packages": {}}))

    # 5) Regression guard against the live, committed lockfile: it must parse, be a
    #    lockfileVersion-3 object, and KEEP its verbose optional platform deps. The
    #    @esbuild/* targets are the canonical example; if someone "optimizes" the
    #    verbosity away, cross-platform `npm ci` breaks (see docs/package-lock-verbosity.md).
    assert PACKAGE_LOCK.is_file(), "package-lock.json must exist at the repo root"
    lock = load_lockfile(PACKAGE_LOCK.read_text(encoding="utf-8"))

    packages = lock.get("packages")
    assert isinstance(packages, dict) and packages, (
        "lockfileVersion 3 must record the resolved package graph under 'packages'"
    )

    esbuild_targets = [k for k in packages if k.startswith("node_modules/@esbuild/")]
    assert len(esbuild_targets) > 1, (
        "the platform-specific @esbuild/* optional dependencies must be preserved for "
        "cross-platform reproducibility; do not hand-strip them"
    )

    optional_entries = [
        k for k, v in packages.items() if isinstance(v, dict) and v.get("optional")
    ]
    assert optional_entries, (
        "optional platform dependencies must remain in the lockfile (lockfileVersion 3 "
        "intentionally includes all of them)"
    )
