#!/usr/bin/env python3
"""Is what runs on Render what `main` says, and is every service up? Read-only (Render API GETs).

    python3 scripts/supervisor/deploys.py     # JSON; exit 0 healthy · 1 a problem to act on · 3 could not look

* newest effective deploy `build_failed` / `update_failed` / `pre_deploy_failed` / canceled without a
  replacement — P1 (read the build log, fix in code, ship; never redeploy/restart by hand);
* a deploy «in progress» for more than 30 minutes — P2 (stuck);
* the web service has no RUNNING instance, or a service is suspended — P1;
* `main` has commits touching a service's paths that its live deploy does not carry, 20+ minutes
  after the push — P2. The bot imports `src/lib/notificationRules.js` from OUTSIDE its rootDir, and
  Render does not redeploy it for that file alone (experiences/render-rootdir-skips-deploys-for-files-outside-it.md).
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client import BOT_SERVICE_ID, SITE_SERVICE_ID, SupervisorError, render_get  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "supervisor" / "last_deploys.json"
SERVICES = {
    "quran-web-app": (SITE_SERVICE_ID, ("src/", "public/", "index.html", "package.json", "package-lock.json", "vite.config.js")),
    "quran-telegram-bot": (BOT_SERVICE_ID, ("server/", "src/lib/notificationRules.js")),
}
FAILED = {"build_failed", "update_failed", "pre_deploy_failed"}
RUNNING = {"created", "queued", "build_in_progress", "update_in_progress", "pre_deploy_in_progress"}


def _t(s: str | None) -> datetime | None:
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def _replaced(service_id: str) -> set[str]:
    out = set()
    for x in render_get(f"/services/{service_id}/events?limit=50") or []:
        e = x.get("event") or {}
        d = e.get("details") or {}
        if e.get("type") == "deploy_ended" and (d.get("reason") or {}).get("newDeploy"):
            out.add(d.get("deployId"))
    return out


def _pending(paths: tuple[str, ...], since: str) -> list[str]:
    try:
        raw = subprocess.run(["git", "-C", str(ROOT), "log", "--format=%H", f"{since}..origin/main", "--", *paths],
                             capture_output=True, text=True, timeout=30).stdout
        return [x for x in raw.split() if x]
    except (OSError, subprocess.SubprocessError):
        return []


def check() -> dict:
    now = datetime.now(timezone.utc)
    report = {"at": now.isoformat(), "services": {}, "problems": []}
    for name, (sid, paths) in SERVICES.items():
        s = render_get(f"/services/{sid}")
        deploys = [x["deploy"] for x in (render_get(f"/services/{sid}/deploys?limit=10") or [])]
        replaced = _replaced(sid)
        effective = next((d for d in deploys if not (d["status"] == "canceled" and d["id"] in replaced)), None)
        live = next((d for d in deploys if d["status"] == "live"), None)
        row = {"id": sid, "suspended": s.get("suspended"), "plan": (s.get("serviceDetails") or {}).get("plan"),
               "dashboard_label": deploys[0]["status"] if deploys else None,
               "effective": effective and {"status": effective["status"], "commit": (effective.get("commit") or {}).get("id", "")[:7],
                                           "created": effective.get("createdAt")},
               "live_commit": (live.get("commit") or {}).get("id", "")[:7] if live else None}
        if s.get("suspended") == "suspended":
            report["problems"].append({"p": "P1", "service": name, "what": "سرویس معلق (suspended) است — احتمالاً پرداخت/پلن؛ کارِ مالک در داشبورد"})
        if effective is not None:
            st = effective["status"]
            if st in FAILED or st == "canceled":
                report["problems"].append({"p": "P1", "service": name, "what": f"آخرین انتشار «{st}» است (کامیت {row['effective']['commit']})"})
            elif st in RUNNING and _t(effective.get("createdAt")) and (now - _t(effective["createdAt"])).total_seconds() > 1800:
                report["problems"].append({"p": "P2", "service": name, "what": f"انتشار بیش از ۳۰ دقیقه در «{st}» مانده"})
        if s.get("type") == "web_service":
            inst = render_get(f"/services/{sid}/instances") or []
            row["instances"] = [{"status": i.get("status")} for i in inst]
            if inst and not any(i.get("status") == "RUNNING" for i in inst) and s.get("suspended") != "suspended":
                report["problems"].append({"p": "P1", "service": name, "what": "هیچ نمونهٔ در حالِ اجرایی ندارد"})
        if live:
            full = (live.get("commit") or {}).get("id", "")
            pend = _pending(paths, full) if full else []
            last = _t(deploys[0].get("createdAt")) if deploys else None
            if pend and (effective is None or effective["status"] not in RUNNING) and (last is None or (now - last).total_seconds() > 1200):
                report["problems"].append({"p": "P2", "service": name,
                                           "what": f"{len(pend)} کامیتِ main که به این سرویس مربوط است هنوز منتشر نشده (live: {row['live_commit']}; نمونه: {pend[0][:7]})"})
            row["pending_commits"] = len(pend)
        report["services"][name] = row
    report["ok"] = not report["problems"]
    return report


def main() -> int:
    try:
        subprocess.run(["git", "-C", str(ROOT), "fetch", "-q", "origin", "main"], timeout=60, check=False)
        report = check()
    except (SupervisorError, OSError, ValueError, KeyError) as e:
        print(json.dumps({"ok": None, "error": f"وضعیتِ انتشار دیده نشد: {e}"}, ensure_ascii=False))
        return 3
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": report["ok"], "problems": report["problems"],
                      "services": {k: {"label": v["dashboard_label"], "live": v["live_commit"], "plan": v["plan"],
                                       "pending": v.get("pending_commits")} for k, v in report["services"].items()}}, ensure_ascii=False))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
