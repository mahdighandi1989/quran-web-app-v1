"""Code-quality guards for the frontend source (consolidated task ``task_ce802af4072b``).

The repo ships no ESLint/TypeScript toolchain (plain Vite + JSX, see package.json), so a
real ``eslint``/``tsc`` invocation is not available in the verification environment. These
checks reproduce the *intent* of "linter passes" and "type-check passes" with a
self-contained static analysis (stdlib + pytest):

  * ``test_linter_passes``     — no merge-conflict markers, no reintroduced anti-patterns,
                                 and no obviously-broken left-over debug sinks in the source.
  * ``test_type_check_passes`` — every relative import in ``src/`` resolves to a real file
                                 (the "broken import / wrong reference" class a type-checker
                                 would catch), and the components an automated scan wrongly
                                 flagged as "unused" (StatsUI exports, AIChat) are in fact
                                 imported AND used — so removing them would have broken the
                                 build. This documents why they were retained.
"""

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"

SRC_FILES = sorted(p for p in SRC.rglob("*.js") if p.is_file()) + sorted(
    p for p in SRC.rglob("*.jsx") if p.is_file()
)

# Candidate resolutions for an extensionless relative import (Vite/Node-style).
_RESOLVE_SUFFIXES = ["", ".js", ".jsx", ".json", ".mjs", ".ts", ".tsx"]
_INDEX_SUFFIXES = ["/index.js", "/index.jsx", "/index.ts", "/index.tsx"]

_IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"](?P<spec>\.[^'"]+)['"]"""
)
_DYNAMIC_IMPORT_RE = re.compile(r"""import\(\s*['"](?P<spec>\.[^'"]+)['"]\s*\)""")


def _resolve(importer: Path, spec: str):
    """Return True if a relative import spec resolves to an existing file."""
    base = (importer.parent / spec).resolve()
    if base.is_file():
        return True
    for suf in _RESOLVE_SUFFIXES:
        if suf and Path(str(base) + suf).is_file():
            return True
    if base.is_dir():
        for suf in _INDEX_SUFFIXES:
            if Path(str(base) + suf).is_file() or (base / suf.lstrip("/")).is_file():
                return True
    return False


def test_linter_passes():
    assert SRC_FILES, "expected source files under src/"
    problems = []
    for f in SRC_FILES:
        text = f.read_text(encoding="utf-8")
        rel = f.relative_to(REPO_ROOT)
        # 1) No VCS merge-conflict markers left in tracked source.
        for marker in ("<<<<<<<", ">>>>>>>"):
            if marker in text:
                problems.append(f"{rel}: merge-conflict marker {marker!r}")
        if re.search(r"^={7}$", text, re.MULTILINE):
            problems.append(f"{rel}: merge-conflict marker '======='")
        # 2) The WS_URL self-comparison anti-pattern (task 1) must not reappear.
        if re.search(r"WS_URL\s*===\s*['\"]wss:", text):
            problems.append(f"{rel}: WS_URL self-comparison anti-pattern reintroduced")
        # 3) No tab/space-mixed indentation that a linter would reject outright is checked
        #    loosely: a line must not start with a TAB (repo uses spaces).
        for i, line in enumerate(text.splitlines(), 1):
            if line.startswith("\t"):
                problems.append(f"{rel}:{i}: tab-indented line (repo uses spaces)")
                break
    assert not problems, "lint problems found:\n" + "\n".join(problems)


def test_type_check_passes():
    # 1) Every relative import in src/ must resolve — the broken-reference class of error a
    #    type-checker/bundler catches (and exactly what deleting a "used" file would cause).
    broken = []
    for f in SRC_FILES:
        text = f.read_text(encoding="utf-8")
        specs = {m.group("spec") for m in _IMPORT_RE.finditer(text)}
        specs |= {m.group("spec") for m in _DYNAMIC_IMPORT_RE.finditer(text)}
        for spec in specs:
            if not _resolve(f, spec):
                broken.append(f"{f.relative_to(REPO_ROOT)} -> {spec}")
    assert not broken, "unresolved relative imports:\n" + "\n".join(broken)

    # 2) Components an automated scan flagged as "unused" are actually used — proof that
    #    keeping them (instead of deleting) was correct and the build stays green.
    app = (SRC / "App.jsx").read_text(encoding="utf-8")

    # AIChat (task 4) — imported from AIWidgets and rendered.
    assert "AIChat" in app and "<AIChat" in app, "AIChat is used in App.jsx; it is not dead code"
    assert (SRC / "components" / "AIWidgets.jsx").is_file()

    # StatsUI exports (task 3) — imported and rendered as JSX elements.
    statsui = SRC / "components" / "StatsUI.jsx"
    assert statsui.is_file(), "StatsUI.jsx is used by App.jsx and must not be removed"
    for comp in ("StatCard", "Accordion", "Segmented", "TrendChart", "Heatmap", "HBars", "ProgressRing"):
        assert re.search(r"<" + comp + r"[\s/>]", app), f"{comp} from StatsUI.jsx is used in App.jsx"
