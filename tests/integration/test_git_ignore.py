"""Integration guard: build/dependency artifacts stay out of ``git status``.

Part of task ``task_e3cec9e4feb5`` (تقویت امنیت و پیکربندی پایه پروژه). A
React + Vite project must ignore the heavyweight generated directories
(``node_modules``, ``dist``, ``build``) plus local env files so that a clean
checkout never shows them as untracked noise in ``git status``.

The test is self-contained (stdlib + pytest only). It verifies both that the
patterns are declared in ``.gitignore`` and that ``git`` actually ignores
representative paths, then asserts no such artifact is currently *tracked*.
"""

import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
GITIGNORE = REPO_ROOT / ".gitignore"

# Generated / unnecessary artifacts that must never clutter git status, paired
# with the representative path used to probe ``git check-ignore``.
UNNECESSARY_PATTERNS = [
    ("node_modules", "node_modules/some-package/index.js"),
    ("dist", "dist/assets/index-abc123.js"),
    ("build", "build/output.js"),
    (".env", ".env"),
    ("*.log", "npm-debug.log"),
    ("coverage", "coverage/lcov.info"),
]


def _git_available():
    if not (REPO_ROOT / ".git").exists():
        return False
    try:
        subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=REPO_ROOT,
            capture_output=True,
            check=True,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def _is_git_ignored(relpath):
    result = subprocess.run(
        ["git", "check-ignore", "-q", "--", relpath],
        cwd=REPO_ROOT,
        capture_output=True,
    )
    return result.returncode == 0


def test_gitignore_declares_core_patterns():
    content = GITIGNORE.read_text(encoding="utf-8")
    for pattern in ("node_modules", "dist", ".env"):
        assert pattern in content, f"{pattern!r} must be declared in .gitignore"


@pytest.mark.parametrize("pattern,relpath", UNNECESSARY_PATTERNS)
def test_unnecessary_files_ignored(pattern, relpath):
    """Each generated artifact must be ignored by git so it never shows in status."""
    content = GITIGNORE.read_text(encoding="utf-8")
    assert pattern in content, (
        f"Expected pattern {pattern!r} in .gitignore to cover {relpath!r}"
    )
    if _git_available():
        assert _is_git_ignored(relpath), (
            f"git does not ignore {relpath!r}; check .gitignore pattern {pattern!r}"
        )


def test_no_artifacts_currently_tracked():
    """Sanity check: none of node_modules/dist/build are tracked in the repo."""
    if not _git_available():
        pytest.skip("git work-tree not available")
    tracked = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    offenders = [
        p
        for p in tracked
        if p.startswith(("node_modules/", "dist/", "build/"))
    ]
    assert not offenders, f"Generated artifacts must not be tracked: {offenders}"
