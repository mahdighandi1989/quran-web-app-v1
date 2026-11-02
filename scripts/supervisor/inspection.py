#!/usr/bin/env python3
"""The supervisor's side of «نظارت و سرکشی» (docs/supervisor/PROMPT.md).

    python3 scripts/supervisor/inspection.py whoami   # sign-in works? (exit 3 = no)
    python3 scripts/supervisor/inspection.py file     # owner-ticked sheets → binder (every round)
    python3 scripts/supervisor/inspection.py pull     # QUEUE.md + shots/ + files/ (exit 4 = sheets owed)
    python3 scripts/supervisor/inspection.py urgent   # claim ONE urgent sheet → URGENT.md (0 empty · 5 claimed · 3 error)
    python3 scripts/supervisor/inspection.py answer N --text-file a.md --outcome fixed|partial|needs-owner|not-done \
        [--after after.png] [--commit SHA ...] --dep 'name=ok|missing|risk:note' ... [--place "…"] [--no-change-reason "…"]

Files are read IN FULL here (every text slice is fetched until the end; files without text are
downloaded), because the server refuses an answer while any attachment is unread.
"""
from __future__ import annotations

import argparse
import http.client
import base64
import json
import mimetypes
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client import Client, SupervisorError  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "docs" / "supervisor" / "inspection"
SHOTS, FILES = WORK / "shots", WORK / "files"
OUTCOME_FA = {"fixed": "✓ درست شد", "partial": "◑ نیمه‌کاره", "needs-owner": "؟ منتظرِ انتخابِ مالک", "not-done": "✗ درست نشد"}
HERE = re.compile(r"اینجا|این‌جا|این قسمت|این بخش|همین‌جا|همینجا|همین جا|\bhere\b", re.I)


def _safe(name: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", name)[:80] or "file"


def save_shot(c: Client, shot_id: str | None, name: str) -> str | None:
    if not shot_id:
        return None
    st, raw, h = c.raw(f"/api/inspection/shots/{shot_id}")
    if st != 200:
        return f"(تصویر خوانده نشد: HTTP {st})"
    ct = h.get("Content-Type") or ""
    ext = ".png" if "png" in ct else ".webp" if "webp" in ct else ".jpg"
    SHOTS.mkdir(parents=True, exist_ok=True)
    p = SHOTS / f"{name}{ext}"
    p.write_bytes(raw)
    return str(p.relative_to(ROOT))


def read_file_fully(c: Client, f: dict, number: int) -> dict:
    """Fetch every slice of the text (discharges the read debt) and the bytes when text is not enough."""
    FILES.mkdir(parents=True, exist_ok=True)
    out = {"text_path": None, "raw_path": None}
    if f.get("extract_status") == "ok":
        parts, offset = [], 0
        while True:
            d = c.api(f"/api/inspection/files/{f['id']}/text?offset={offset}")
            parts.append(d.get("text") or "")
            offset = d.get("end", offset)
            if d.get("done") or not d.get("text"):
                break
        p = FILES / f"{number}-{f['id']}-{_safe(f['filename'])}.txt"
        p.write_text("".join(parts), encoding="utf-8")
        out["text_path"] = str(p.relative_to(ROOT))
    if f.get("extract_status") != "ok" or f.get("text_truncated"):
        st, raw, _ = c.raw(f"/api/inspection/files/{f['id']}/raw")
        if st == 200:
            p = FILES / f"{number}-{f['id']}-{_safe(f['filename'])}"
            p.write_bytes(raw)
            out["raw_path"] = str(p.relative_to(ROOT))
        else:
            out["raw_path"] = f"(بایت‌ها خوانده نشد: HTTP {st})"
    return out


def render_sheet(c: Client, r: dict) -> list[str]:
    n = r["number"]
    lines = [f"## برگهٔ {n} — {r.get('title', '')}", "",
             f"- وضعیت: **{r.get('status_label', r.get('status'))}** · رنگ: {r.get('glow')} · بدهکار: {'بله' if r.get('owed') else 'نه'}"
             + (" · ⚡ فوری" if r.get("urgent_at") and not r.get("urgent_done_at") else ""),
             f"- ثبت: {r.get('created_by')} · {r.get('created_at')}"]
    sp = r.get("spot") or {}
    if sp:
        lines.append(f"- صفحه (reopen): `{sp.get('path')}` — {sp.get('page_label', '')}")
        rect, vp = sp.get("rect") or {}, sp.get("viewport") or {}
        lines.append(f"- کادر (مختصاتِ سند): x={rect.get('x')} y={rect.get('y')} w={rect.get('w')} h={rect.get('h')} · پنجره {vp.get('w')}×{vp.get('h')} dpr={vp.get('dpr')} اسکرول=({vp.get('sx')},{vp.get('sy')})")
        a = sp.get("anchor") or {}
        if a:
            lines.append(f"- عنصر: `{a.get('tag')}` · گره: `{a.get('selector')}` ({'تأییدشده' if a.get('verified') else 'تأییدنشده'})")
            lines.append(f"- جای دقیق داخلِ همان گره (کسر از لبهٔ چپ/بالا): fx={a.get('fx')} fy={a.get('fy')} fw={a.get('fw')} fh={a.get('fh')}")
        if sp.get("covered_text"):
            lines.append(f"- متنِ زیرِ کادر: «{sp['covered_text'][:400]}»")
    if any(nt.get("by") == "owner" and HERE.search(nt.get("text", "")) for nt in r.get("notes", [])) and sp.get("anchor"):
        lines.append("- ⚠ متن «اینجا» می‌گوید ⇒ برای `fixed` باید `--place` بدهی (بخشِ ۰-ب-۴).")
    lines += ["", "### گفت‌وگو"]
    for i, nt in enumerate(r.get("notes", []), 1):
        who = "🤖 ناظر" if nt.get("by") == "reviewer" else f"👤 {nt.get('author')}"
        lines.append(f"**{i}. {who}** · {nt.get('at')}" + (f" · {OUTCOME_FA.get(nt.get('outcome'), '')}" if nt.get("outcome") else ""))
        lines.append("")
        lines.append(nt.get("text", ""))
        if nt.get("spot"):
            ns = nt["spot"]
            lines.append(f"> کادرِ همین یادداشت (جای تازه): `{ns.get('path')}` گره `{(ns.get('anchor') or {}).get('selector')}`")
        for key, label in (("shot_id", "تصویرِ پیش"), ("after_shot_id", "تصویرِ بعد")):
            if nt.get(key):
                lines.append(f"- {label}: {save_shot(c, nt[key], f'{n}-{i}-{key}')}")
        if nt.get("commits"):
            lines.append(f"- کامیت: {', '.join(nt['commits'])}")
        lines.append("")
    files = r.get("files") or []
    if files:
        lines.append("### پیوست‌ها — سه‌تایی را با هم بخوان: متنِ برگه، توضیحِ فایل، متنِ کاملِ فایل")
        for f in files:
            got = read_file_fully(c, f, n)
            lines.append(f"- **{f['filename']}** ({f.get('mime')}, {f.get('byte_size')} بایت) · استخراج: `{f.get('extract_status')}` {f.get('extract_note') or ''}")
            if f.get("caption"):
                lines.append(f"  - توضیحِ مالک: {f['caption']}")
            if got["text_path"]:
                lines.append(f"  - متنِ کامل ({f.get('text_chars')} نویسه): `{got['text_path']}` — تا آخر بخوان")
            if got["raw_path"]:
                lines.append(f"  - خودِ فایل: `{got['raw_path']}` — بازش کن و ببین")
    if r.get("deps"):
        lines.append("### زنجیرهٔ وابستگیِ جواب‌های قبلی")
        lines += [f"- {d.get('name')} = {d.get('status')} {d.get('note', '')}" for d in r["deps"]]
    lines.append("")
    return lines


def cmd_whoami(c: Client) -> int:
    me = c.api("/api/me")
    print(json.dumps({"base": c.base, "source": c.source, **me}, ensure_ascii=False))
    return 0 if me.get("isSupervisor") else 3


def cmd_file(c: Client) -> int:
    d = c.api("/api/inspection/file", body={})
    for x in d.get("filed", []):
        print(f"برگهٔ {x['number']} ⇒ زونکنِ {x['binder']['number']} برگِ {x['binder']['page']}")
    return 0


def cmd_pull(c: Client) -> int:
    q = c.api("/api/inspection/queue")
    WORK.mkdir(parents=True, exist_ok=True)
    lines = ["# کارتابلِ ناظر (QUEUE.md — کپیِ کاری، در git نیست)", "",
             f"{len(q['reports'])} برگه · بدهکار: {q.get('owed', 0)}", ""]
    for r in sorted(q["reports"], key=lambda x: (not x.get("owed"), x.get("urgent_at") is None, x["number"])):
        full = c.api(f"/api/inspection/{r['number']}")["report"]
        lines += render_sheet(c, full)
    (WORK / "QUEUE.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"QUEUE.md نوشته شد — {len(q['reports'])} برگه، {q.get('owed', 0)} بدهکار")
    return 4 if q.get("owed") else 0


def cmd_urgent(c: Client) -> int:
    d = c.api("/api/inspection/urgent/claim", body={})
    r = d.get("report")
    if not r:
        return 0
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "URGENT.md").write_text("\n".join(["# برگهٔ فوریِ برداشته‌شده", ""] + render_sheet(c, r)), encoding="utf-8")
    print(f"برگهٔ فوری {r['number']} برداشته شد ⇒ docs/supervisor/inspection/URGENT.md")
    return 5


def _data_url(path: str) -> str:
    p = Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "image/png"
    if mime not in ("image/png", "image/jpeg", "image/webp"):
        raise SupervisorError(f"تصویرِ بعد باید PNG/JPEG/WebP باشد، نه {mime}")
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def _dep(raw: str) -> dict:
    name, _, rest = raw.partition("=")
    status, _, note = rest.partition(":")
    if not name or not status:
        raise SupervisorError(f"--dep نامعتبر: «{raw}» (قالب: 'نام=ok|missing|risk:توضیح')")
    return {"name": name.strip(), "status": status.strip(), "note": note.strip()}


def cmd_answer(c: Client, a) -> int:
    body = {"text": Path(a.text_file).read_text(encoding="utf-8"), "outcome": a.outcome,
            "commits": a.commit or [], "dependencies": [_dep(x) for x in a.dep or []],
            "place": a.place or "", "no_change_reason": a.no_change_reason or ""}
    if a.after:
        body["after_shot"] = _data_url(a.after)
    if a.outcome == "fixed" and not a.after:
        raise SupervisorError("«fixed» بدونِ --after پذیرفته نمی‌شود — عکسِ بعد بگیر یا نتیجه را partial/not-done بگذار")
    d = c.api(f"/api/inspection/{a.number}/notes", body=body)
    print(f"جواب ثبت شد — برگهٔ {a.number}: {d['report']['status_label']} ({d['report']['glow']})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("whoami", "file", "pull", "urgent"):
        sub.add_parser(name)
    an = sub.add_parser("answer")
    an.add_argument("number", type=int)
    an.add_argument("--text-file", required=True)
    an.add_argument("--outcome", required=True, choices=list(OUTCOME_FA))
    an.add_argument("--after")
    an.add_argument("--commit", action="append")
    an.add_argument("--dep", action="append", required=True)
    an.add_argument("--place")
    an.add_argument("--no-change-reason")
    a = ap.parse_args()
    try:
        c = Client()
        return {"whoami": lambda: cmd_whoami(c), "file": lambda: cmd_file(c), "pull": lambda: cmd_pull(c),
                "urgent": lambda: cmd_urgent(c), "answer": lambda: cmd_answer(c, a)}[a.cmd]()
    except SupervisorError as e:
        print(f"خطا: {e}", file=sys.stderr)
        return 3
    except (ValueError, KeyError, OSError, http.client.HTTPException) as e:
        # A waking Render instance can answer 200 with HTML, or cut the stream: «could not look», not a crash.
        print(f"خطا (پاسخِ ناقص/نامعتبر از سرور): {type(e).__name__}: {e}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
