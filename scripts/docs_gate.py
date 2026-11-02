#!/usr/bin/env python3
"""Docs gate — makes the multi-agent documentation rules fail the build.

Offline, no credentials, standard library only:  python3 scripts/docs_gate.py

Exits 1 (listing every problem) when:
  1. an agent entry file is missing or does not point back to AGENTS.md;
  2. AGENTS.md does not name every command scripts/ship.sh actually runs (parsed, not hard-coded);
  3. a path in the docs map (the '## ساختار' table in CLAUDE.md) does not resolve;
  4. the NEWEST entry of docs/WORKLOG.md (bottom of the file) has no signature line;
  5. docs/handbook/HANDBOOK.md or PROGRESS.md is missing, or PROGRESS has no row dated on/after
     the newest WORKLOG entry (the handbook must stay live);
  6. a file in experiences/ lacks the frontmatter required by experiences/README.md, or names
     this project (lessons must be project-agnostic);
  7. the supervisor's versioned prompts lack their frontmatter / archive (once docs/supervisor exists).
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
problems: list[str] = []


def fail(msg: str) -> None:
    problems.append(msg)


def read(rel: str) -> str | None:
    p = ROOT / rel
    return p.read_text(encoding="utf-8") if p.is_file() else None


# --- 1. entry files ------------------------------------------------------------
agents = read("AGENTS.md") or ""
for rel, must in {"AGENTS.md": None, "CLAUDE.md": "AGENTS.md", "GEMINI.md": "AGENTS.md"}.items():
    text = read(rel)
    if text is None:
        fail(f"[entry] missing agent entry file: {rel}")
    elif must and must not in text:
        fail(f"[entry] {rel} does not point to {must}")
for rel in ("CLAUDE.md", "GEMINI.md"):
    if agents and rel not in agents:
        fail(f"[entry] AGENTS.md does not reference {rel}")

# --- 2. verification commands named in AGENTS.md --------------------------------
ship = read("scripts/ship.sh") or ""
if not ship:
    fail("[verify] scripts/ship.sh not found")
commands: set[str] = set()
for line in ship.splitlines():
    code = line.split("#", 1)[0]
    if re.search(r"-m pytest\b", code):
        commands.add("pytest")
    for m in re.finditer(r"\bnpm (ci|test|run [\w:-]+)", code):
        commands.add(f"npm {m.group(1)}")
    if re.search(r"\bnpx vitest run\b", code):
        commands.add("npx vitest run")
    if re.search(r"\bnode --test\b", code):
        commands.add("node --test")
    for m in re.finditer(r"\bscripts/[\w.-]+\.(?:py|sh)\b", code):
        commands.add(m.group(0))
for cmd in sorted(commands):
    if cmd not in agents:
        fail(f"[verify] AGENTS.md does not name the verification command `{cmd}` (run by scripts/ship.sh)")

# --- 3. docs map paths resolve ----------------------------------------------------
try:
    tracked = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout.splitlines()
except (OSError, subprocess.CalledProcessError):
    tracked = []


def resolves(token: str) -> bool:
    tok = token.strip().rstrip("/")
    if not tok or any(c in tok for c in "*<>{} ") or tok.startswith(("http", "$")):
        return True
    if (ROOT / tok).exists():
        return True
    return any(f == tok or f.endswith("/" + tok) or f.startswith(tok + "/") for f in tracked)


claude = read("CLAUDE.md") or ""
section = re.search(r"^## ساختار\s*$(.*?)(?=^## )", claude, re.S | re.M)
if not section:
    fail("[map] docs map ('## ساختار' table in CLAUDE.md) not found")
else:
    for row in section.group(1).splitlines():
        if not row.startswith("|") or set(row) <= set("|- "):
            continue
        cells = row.strip("|").split("|")
        if len(cells) < 2:
            continue
        for token in re.findall(r"`([^`]+)`", cells[1]):
            if not resolves(token):
                fail(f"[map] path in CLAUDE.md docs map does not resolve: {token}")

# --- 4. newest work-log entry is signed ---------------------------------------------
SIGNATURE = re.compile(r"^>\s*\*\*(?:امضا|Signed)[^*]*:\*\*\s*`[^`]+`\s*·\s*(\d{4}-\d{2}-\d{2})\s*·\s*\S", re.M)
worklog = read("docs/WORKLOG.md")
newest_date = None
if worklog is None:
    fail("[log] docs/WORKLOG.md missing")
else:
    entries = re.split(r"^## ", worklog, flags=re.M)
    if len(entries) < 2:
        fail("[log] docs/WORKLOG.md has no entries")
    else:
        newest = entries[-1]
        m = SIGNATURE.search(newest)
        if not m:
            fail(f"[log] newest WORKLOG entry is not signed: '## {newest.splitlines()[0][:80]}' "
                 "(needs '> **امضا:** `agent-id` · YYYY-MM-DD · how verified')")
        else:
            newest_date = m.group(1)

# --- 5. handbook is live ---------------------------------------------------------------
if read("docs/handbook/HANDBOOK.md") is None:
    fail("[handbook] docs/handbook/HANDBOOK.md missing")
progress = read("docs/handbook/PROGRESS.md")
if progress is None:
    fail("[handbook] docs/handbook/PROGRESS.md missing")
elif newest_date:
    dates = re.findall(r"^\|\s*(\d{4}-\d{2}-\d{2})\s*\|", progress, re.M)
    if not dates or max(dates) < newest_date:
        fail(f"[handbook] PROGRESS.md has no row dated {newest_date} or later (newest WORKLOG entry) — add one")

# --- 6. experiences frontmatter -----------------------------------------------------------
REQUIRED = ["title", "tags", "topic_canonical", "source", "created_at", "updated_at", "merged_from", "agents"]
PROJECT_WORDS = re.compile(r"quran-web-app|quran-telegram-bot|مرکز حفظ قرآن", re.I)
exp_dir = ROOT / "experiences"
if not exp_dir.is_dir():
    fail("[lessons] experiences/ folder missing")
else:
    for f in sorted(exp_dir.glob("*.md")):
        if f.name == "README.md":
            continue
        text = f.read_text(encoding="utf-8")
        m = re.match(r"---\n(.*?)\n---\n", text, re.S)
        if not m:
            fail(f"[lessons] {f.name}: no YAML frontmatter")
            continue
        keys = set(re.findall(r"^([A-Za-z_]+):", m.group(1), re.M))
        for k in REQUIRED:
            if k not in keys:
                fail(f"[lessons] {f.name}: frontmatter missing '{k}'")
        if PROJECT_WORDS.search(text):
            fail(f"[lessons] {f.name}: names this project — lessons must be project-agnostic")
        if "How to Apply Elsewhere" not in text:
            fail(f"[lessons] {f.name}: missing the '🔁 چطور در جای دیگر اعمال کنیم / How to Apply Elsewhere' section")

# --- 7. supervisor prompts are versioned ----------------------------------------------------
sup = ROOT / "docs" / "supervisor"
if sup.is_dir():
    for name in ("PROMPT.md", "URGENT_PROMPT.md"):
        text = read(f"docs/supervisor/{name}")
        if text is None:
            fail(f"[supervisor] docs/supervisor/{name} missing")
            continue
        fm = re.match(r"---\n(.*?)\n---\n", text, re.S)
        if not fm or not re.search(r"^version:\s*\d+", fm.group(1), re.M):
            fail(f"[supervisor] {name}: frontmatter 'version:' missing")
    for name in ("RUNLOG.md", "OPEN_ITEMS.md", "README.md", "archive/README.md"):
        if read(f"docs/supervisor/{name}") is None:
            fail(f"[supervisor] docs/supervisor/{name} missing")

if problems:
    print(f"docs gate: {len(problems)} problem(s)")
    for p in problems:
        print("  ✗", p)
    sys.exit(1)
print("docs gate: OK")
