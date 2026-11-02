#!/usr/bin/env python3
"""Take the «after» picture the way the owner sees the page — in a real browser, on production
(or any frontend you point it at), of THE PLACE THE OWNER BOXED.

    python3 scripts/supervisor/screenshot.py /practice --out /tmp/after.png
    python3 scripts/supervisor/screenshot.py /settings --selector "#root > div > main" --out /tmp/a.png
    python3 scripts/supervisor/screenshot.py / --frontend http://localhost:4173 --out /tmp/x.png --console

Use the sheet's own anchor selector (QUEUE.md «گره») with --selector. Pages behind Google sign-in
(e.g. /inspection) cannot be opened as the supervisor — the app has no password login; say so in the
answer and picture the nearest public state, or a local build, instead.

Needs: python3 -m pip install -q playwright (Chromium is preinstalled at /opt/pw-browsers/chromium and
used directly — never run `playwright install`). Console errors are printed: an error on the page is a finding.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client import SupervisorError, frontend_url  # noqa: E402

PROXY_CA = Path("/root/.ccr/agent-proxy-ca.crt")


def trust_args() -> list[str]:
    """Chromium ignores the system CA bundle the way curl/python use it: trust exactly ONE extra
    key — the environment proxy's CA, pinned by its SPKI hash. Verification stays on otherwise."""
    if not PROXY_CA.exists():
        return []
    try:
        der = subprocess.run(f"openssl x509 -in {PROXY_CA} -pubkey -noout | openssl pkey -pubin -outform der",
                             shell=True, check=True, capture_output=True).stdout
        return [f"--ignore-certificate-errors-spki-list={base64.b64encode(hashlib.sha256(der).digest()).decode()}"]
    except (OSError, subprocess.CalledProcessError):
        return []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--out", required=True)
    ap.add_argument("--selector")
    ap.add_argument("--frontend")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--wait", type=int, default=2500, help="ms after load")
    ap.add_argument("--console", action="store_true", help="print every console message, not only errors")
    a = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright  # noqa: PLC0415
    except ImportError:
        print("playwright نصب نیست: python3 -m pip install -q playwright", file=sys.stderr)
        return 3
    try:
        base = (a.frontend or frontend_url()).rstrip("/")
    except SupervisorError as e:
        print(f"خطا: {e}", file=sys.stderr)
        return 3
    errors: list[str] = []
    with sync_playwright() as p:
        exe = Path("/opt/pw-browsers/chromium")  # the environment's Chromium, whatever playwright version pip installed
        browser = p.chromium.launch(args=trust_args(), **({"executable_path": str(exe)} if exe.exists() else {}))
        page = browser.new_page(viewport={"width": a.width, "height": a.height}, locale="fa-IR")
        page.on("console", lambda m: (errors.append(f"[{m.type}] {m.text}") if (m.type == "error" or a.console) else None))
        page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
        resp = page.goto(base + a.path, wait_until="networkidle", timeout=90000)
        page.wait_for_timeout(a.wait)
        target = page.locator(a.selector).first if a.selector else None
        if target is not None and target.count() == 0:
            print(f"گره «{a.selector}» روی صفحه پیدا نشد — عکسِ کلِ صفحه گرفته شد", file=sys.stderr)
            target = None
        (target.screenshot(path=a.out) if target is not None else page.screenshot(path=a.out, full_page=True))
        print(f"عکس: {a.out} · HTTP {resp.status if resp else '?'} · نشانی نهایی: {page.url}")
        browser.close()
    for e in errors:
        print(e)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
