"""Guard test for sensitive-file ignore rules in the repository ``.gitignore``.

Part of task ``task_e3cec9e4feb5`` (تقویت امنیت و پیکربندی پایه پروژه). The
project must never accidentally commit secrets — ``.env`` files, credential
JSONs, service-account keys, and private-key material (``*.key`` / ``*.pem``).
This test asserts that the root ``.gitignore`` both *declares* those patterns
and that ``git`` actually *ignores* representative files matching them.

The test is intentionally self-contained (stdlib + pytest only) so it can run in
a verification environment without the JS toolchain. It uses ``git check-ignore``
when a git work-tree is available, and falls back to a static pattern check of
``.gitignore`` otherwise.
"""

import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
GITIGNORE = REPO_ROOT / ".gitignore"

# Representative sensitive files that must never be tracked, paired with the
# pattern in ``.gitignore`` that is expected to cover them.
SENSITIVE_FILES = [
    (".env", ".env"),
    (".env.local", ".env.local"),
    ("credentials.json", "credentials.json"),
    ("service-account-prod.json", "service-account*.json"),
    ("private.key", "*.key"),
    ("server.pem", "*.pem"),
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
    """Return True if ``git`` reports ``relpath`` as ignored."""
    result = subprocess.run(
        ["git", "check-ignore", "-q", "--", relpath],
        cwd=REPO_ROOT,
        capture_output=True,
    )
    # exit code 0 => path is ignored, 1 => not ignored.
    return result.returncode == 0


def test_gitignore_file_exists():
    assert GITIGNORE.is_file(), ".gitignore must exist at the repository root"


@pytest.mark.parametrize("relpath,pattern", SENSITIVE_FILES)
def test_sensitive_files_are_ignored(relpath, pattern):
    """Every representative secret file must be ignored by git.

    Asserts both that the covering pattern is declared in ``.gitignore`` and —
    when a git work-tree is available — that ``git check-ignore`` agrees the
    file would be ignored.
    """
    content = GITIGNORE.read_text(encoding="utf-8")
    assert pattern in content, (
        f"Expected pattern {pattern!r} in .gitignore to cover {relpath!r}"
    )

    if _git_available():
        assert _is_git_ignored(relpath), (
            f"git does not ignore {relpath!r}; check .gitignore pattern {pattern!r}"
        )


def test_env_example_is_not_ignored():
    """``.env.example`` documents required vars and MUST stay tracked."""
    content = GITIGNORE.read_text(encoding="utf-8")
    assert "!.env.example" in content, (
        ".gitignore must keep .env.example tracked via a negation pattern"
    )
    if _git_available():
        assert not _is_git_ignored(".env.example"), (
            ".env.example must not be ignored — contributors need it"
        )
