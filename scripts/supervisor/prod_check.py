#!/usr/bin/env python3
"""Read-only production check over HTTPS — the REAL flows, not a health ping.

    python3 scripts/supervisor/prod_check.py      # → docs/supervisor/last_prod_check.json; exit 0 ok · 1 problems · 3 could not look

Checks (no writes, no user data touched):
  1. the static site serves index.html AND the JS bundle it references (a 200 on / alone proves nothing);
  2. a deep link (/settings) reaches the app (rewrite, or the 404.html redirect trick) — reported, not hidden;
  3. the bot service answers, its inspection API is deployed (/api/me as anonymous → signedIn:false),
     Firestore is attached (storage == firestore), ADMIN_EMAILS and SUPERVISOR_PASSWORD are configured;
  4. the supervisor can sign in and read its queue (the real flow of this routine);
  5. the Telegram webhook refuses an unsigned update (401) — the secret is enforced;
  6. the AI proxy refuses a guest call to a non-allow-listed host (SSRF guard) without calling it;
  7. the Render deploy state (deploys.py).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client import BOT_SERVICE_ID, Client, SupervisorError, frontend_url, http, service_url  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "supervisor" / "last_prod_check.json"


def main() -> int:
    res: dict = {"at": datetime.now(timezone.utc).isoformat(), "checks": {}, "problems": []}

    def bad(p: str, what: str) -> None:
        res["problems"].append({"p": p, "what": what})

    try:
        site, bot = frontend_url(), service_url(BOT_SERVICE_ID)
    except SupervisorError as e:
        print(json.dumps({"ok": None, "error": str(e)}, ensure_ascii=False))
        return 3
    try:
        st, raw, _ = http(site + "/")
        html = raw.decode("utf-8", "replace")
        js = re.findall(r'src="(/assets/[^"]+\.js)"', html)
        res["checks"]["site_index"] = {"status": st, "bundles": js}
        if st != 200 or not js:
            bad("P1", f"صفحهٔ اصلیِ سایت درست سرو نمی‌شود (HTTP {st}, bundle: {len(js)})")
        for j in js[:2]:
            s2, b2, _ = http(site + j)
            res["checks"].setdefault("bundle", []).append({"path": j, "status": s2, "bytes": len(b2),
                                                           "inspector_bridge": "Inspector Bridge" in b2.decode("utf-8", "ignore")})
            if s2 != 200:
                bad("P1", f"bundle ِ {j} پاسخِ {s2} داد")
            if "Inspector Bridge" in b2.decode("utf-8", "ignore"):
                bad("P2", "اسکریپتِ دیباگِ Inspector Bridge در bundle ِ production است")
        s3, b3, _ = http(site + "/settings")
        res["checks"]["deep_link"] = {"status": s3, "spa_redirect_script": "/?/" in b3.decode("utf-8", "ignore") or "l.replace" in b3.decode("utf-8", "ignore")}
        if s3 != 200:
            bad("P3", f"پیوندِ مستقیمِ /settings با HTTP {s3} جواب می‌دهد (فقط ترفندِ 404.html برمی‌گرداند) — rewrite ِ Render لازم است")

        s4, b4, _ = http(bot + "/")
        res["checks"]["bot_root"] = {"status": s4}
        s5, b5, _ = http(bot + "/api/me")
        me = json.loads(b5 or b"{}") if s5 == 200 else {}
        res["checks"]["api_me"] = {"status": s5, **{k: me.get(k) for k in ("signedIn", "adminConfigured", "supervisorConfigured", "storage")}}
        if s5 != 200:
            bad("P1", f"API ِ نظارت روی سرویسِ بات نیست (/api/me ⇒ {s5}) — دیپلوی را ببین")
        else:
            if me.get("storage") != "firestore":
                bad("P1", "Firestore به سرورِ بات وصل نیست (FIREBASE_SERVICE_ACCOUNT)")
            if not me.get("adminConfigured"):
                bad("P2", "ADMIN_EMAILS روی سرورِ بات تنظیم نیست — هیچ‌کس مدیر نیست")
            if not me.get("supervisorConfigured"):
                bad("P2", "SUPERVISOR_PASSWORD روی سرورِ بات تنظیم نیست")
        s6, _, _ = http(bot + "/webhook", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
        res["checks"]["webhook_unsigned"] = {"status": s6}
        if s6 != 401:
            bad("P1", f"وبهوکِ تلگرام بدونِ secret پذیرفته شد (HTTP {s6})")
        body = json.dumps({"provider": {"id": "x", "kind": "openai", "baseUrl": "http://169.254.169.254/latest"}, "model": "m", "key": "k", "prompt": "hi"}).encode()
        s7, b7, _ = http(bot + "/api/ai/proxy", data=body, headers={"Content-Type": "application/json"}, method="POST")
        res["checks"]["ai_proxy_ssrf"] = {"status": s7, "body": b7[:160].decode("utf-8", "replace")}
        if s7 not in (400, 403):
            bad("P1", f"پراکسیِ AI آدرسِ داخلی را رد نکرد (HTTP {s7}) — SSRF")
    except SupervisorError as e:
        print(json.dumps({"ok": None, "error": str(e)}, ensure_ascii=False))
        return 3

    try:
        c = Client()
        who = c.api("/api/me")
        q = c.api("/api/inspection/queue")
        res["checks"]["supervisor_flow"] = {"isSupervisor": who.get("isSupervisor"), "queue": len(q.get("reports", [])), "owed": q.get("owed")}
        if not who.get("isSupervisor"):
            bad("P1", "ورودِ ناظر جواب داد ولی نقشِ ناظر نگرفت")
    except SupervisorError as e:
        res["checks"]["supervisor_flow"] = {"error": str(e)}
        bad("P2", f"جریانِ ناظر اجرا نشد: {e}")

    dep = subprocess.run([sys.executable, str(Path(__file__).with_name("deploys.py"))], capture_output=True, text=True, timeout=300)
    try:
        res["checks"]["deploys"] = json.loads(dep.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        res["checks"]["deploys"] = {"error": dep.stderr[-300:]}
    if dep.returncode == 1:
        bad("P1", "Render: " + "؛ ".join(p["what"] for p in res["checks"]["deploys"].get("problems", [])))
    elif dep.returncode == 3:
        bad("P2", "وضعیتِ انتشار در Render دیده نشد")

    res["ok"] = not res["problems"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": res["ok"], "problems": res["problems"]}, ensure_ascii=False))
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
