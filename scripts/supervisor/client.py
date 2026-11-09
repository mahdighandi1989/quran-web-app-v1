#!/usr/bin/env python3
"""Shared HTTP client for the supervisor's tools — WHERE production is and HOW the supervisor
signs in, resolved without anything secret written in the repo.

Resolution order (first that works wins):
1. Environment: ``QS_API_BASE`` (e.g. ``https://<bot-host>``) and the password from ``SUPERVISOR_PASSWORD``
   (the name the routines' prompts use) or ``QS_SUPERVISOR_PASSWORD``.
2. Render API: the bot service's public URL (not a secret). The PASSWORD is read from Render only when
   ``QS_PASSWORD_FROM_RENDER=1`` is set explicitly — 2026-11-09 the urgent routine's prompt allowed the password from
   the environment only, the tool silently read it from Render (``source: render``) and the run stopped itself
   with sheet 24 claimed. Without the variable and without the opt-in: a clear error, exit 3.
   The password is held in memory only — never printed, never written to disk.

Every failure says WHAT to fix; callers exit with code 3 — «could not look» must never look like
«looked and found nothing».
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

RENDER_API = "https://api.render.com/v1"
#: Render service ids (not secrets).
BOT_SERVICE_ID = os.getenv("QS_RENDER_BOT_ID", "srv-d8etqmbbc2fs73ctpk30")
SITE_SERVICE_ID = os.getenv("QS_RENDER_SITE_ID", "srv-d8cm8rt7vvec73den44g")
TIMEOUT = float(os.getenv("QS_TIMEOUT", "90"))


class SupervisorError(RuntimeError):
    """Carries WHAT to fix, not just that something failed."""


def http(url: str, *, data: bytes | None = None, headers: dict | None = None, method: str = "GET",
         timeout: float = TIMEOUT) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers or {})
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        reason = str(getattr(e, "reason", e))
        if "Tunnel connection failed: 403" in reason:
            raise SupervisorError(
                f"شبکهٔ محیطِ این اجرا «{url.split('/')[2]}» را راه نمی‌دهد (403 از پراکسی) — در claude.ai › Routines › همین روتین › "
                "Edit، محیطی را انتخاب کن که به api.render.com و onrender.com دسترسی دارد.") from e
        raise SupervisorError(f"به «{url.split('?')[0]}» نرسیدم ({reason}) — شبکهٔ محیط یا سرور") from e


def render_get(path: str):
    headers = {"Accept": "application/json"}
    key = os.getenv("RENDER_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"
    st, raw, _ = http(f"{RENDER_API}{path}", headers=headers)
    if st in (401, 403):
        raise SupervisorError(f"Render API پاسخِ HTTP {st} داد برای {path}: محیطِ این اجرا دسترسیِ Render ندارد (اتصالِ Render در محیط یا RENDER_API_KEY).")
    if st != 200:
        raise SupervisorError(f"Render API پاسخِ HTTP {st} داد برای {path}")
    return json.loads(raw or b"null")


def service_url(service_id: str) -> str:
    url = ((render_get(f"/services/{service_id}") or {}).get("serviceDetails") or {}).get("url") or ""
    if not url:
        raise SupervisorError(f"آدرسِ عمومیِ سرویسِ {service_id} از Render خوانده نشد")
    return url.rstrip("/")


def frontend_url() -> str:
    return (os.getenv("QS_FRONTEND_URL") or "").rstrip("/") or service_url(SITE_SERVICE_ID)


def _detail(raw: bytes) -> str:
    try:
        return str((json.loads(raw) or {}).get("error") or raw[:200])
    except Exception:  # noqa: BLE001
        return str(raw[:200])


class Client:
    def __init__(self) -> None:
        self.base = (os.getenv("QS_API_BASE") or "").strip().rstrip("/")
        self._password = os.getenv("SUPERVISOR_PASSWORD") or os.getenv("QS_SUPERVISOR_PASSWORD") or ""
        self.token = ""
        self.source = "env"
        if not self.base or not self._password:
            self._from_render()

    def _from_render(self) -> None:
        if not self.base:
            self.base = service_url(BOT_SERVICE_ID)
        if not self._password and os.getenv("QS_PASSWORD_FROM_RENDER") != "1":
            raise SupervisorError(
                "رمزِ ناظر در محیطِ این اجرا نیست: SUPERVISOR_PASSWORD را در محیطِ همین روتین (claude.ai › Routines › "
                "Edit › Environment) بگذار. خواندنش از Render فقط با QS_PASSWORD_FROM_RENDER=1 (اجازهٔ صریح).")
        if not self._password:
            env, cursor = {}, None
            for _ in range(10):  # paginate: the env-var list is cursor-paged
                page = render_get(f"/services/{BOT_SERVICE_ID}/env-vars?limit=100"
                                  + (f"&cursor={urllib.parse.quote(cursor)}" if cursor else "")) or []
                for item in page:
                    ev = item.get("envVar") or {}
                    env[ev.get("key")] = ev.get("value")
                if len(page) < 100:
                    break
                cursor = page[-1].get("cursor")
            self._password = env.get("SUPERVISOR_PASSWORD") or ""
            self.source = "render"
        if not self._password:
            raise SupervisorError("SUPERVISOR_PASSWORD روی سرویسِ quran-telegram-bot در Render تنظیم نیست — حسابِ ناظر فعال نیست")

    def login(self) -> str:
        if self.token:
            return self.token
        body = json.dumps({"password": self._password}).encode()
        for attempt in range(5):  # a cold Render instance can take a while to wake
            st, raw, _ = http(f"{self.base}/api/inspection/supervisor/login", data=body,
                              headers={"Content-Type": "application/json"}, method="POST")
            if st == 200:
                self.token = (json.loads(raw) or {}).get("token") or ""
                if not self.token:
                    raise SupervisorError("سرور توکنی برنگرداند")
                return self.token
            if st in (404, 502, 503, 504) and attempt < 4:
                # 404 = an older deploy without the inspection API, or still deploying
                import time  # noqa: PLC0415
                time.sleep(20 * (attempt + 1))
                continue
            raise SupervisorError(f"ورودِ ناظر ناموفق بود (HTTP {st}): {_detail(raw)}")
        raise SupervisorError("ورودِ ناظر ناموفق بود")

    def raw(self, path: str, *, data: bytes | None = None, headers: dict | None = None, method: str = "GET",
            timeout: float = TIMEOUT) -> tuple[int, bytes, dict]:
        h = {"Authorization": f"Supervisor {self.login()}"}
        h.update(headers or {})
        return http(f"{self.base}{path}", data=data, headers=h, method=method, timeout=timeout)

    def api(self, path: str, *, body: dict | None = None, method: str | None = None) -> dict:
        data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        st, raw, _ = self.raw(path, data=data, headers=headers, method=method or ("POST" if data is not None else "GET"))
        if st != 200:
            raise SupervisorError(f"«{path}» پاسخِ HTTP {st} داد: {_detail(raw)}")
        return json.loads(raw or b"{}")
