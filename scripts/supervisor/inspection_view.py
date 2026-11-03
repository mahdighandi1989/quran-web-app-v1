"""Make every attached file something the supervisor can actually SEE (ported from Detective-1).

Used by `inspection.py` (pull / urgent). The TEXT of a file is read through the API (the server
extracted it at upload); this is the other half — the parts that are only visible, not readable:

  * images the Read tool cannot show (HEIC/HEIF, TIFF — every page, BMP, AVIF, ICO, …) → PNG;
    SVG → rendered in headless Chromium;
  * archives → unpacked to disk, every member (no path escapes), with the same treatment inside;
  * videos/audio → videos get one frame every 5 s (≤ 360); there is NO automatic transcription in this
    project, so the supervisor must say it could not listen rather than claim it did;
  * PDFs → a reminder to look at EVERY page (tables, figures, scans).

Optional tools (scripts/supervisor/requirements.txt). A missing one is reported, never skipped silently.
"""
from __future__ import annotations

import subprocess
import zipfile
from pathlib import Path
from typing import Callable

VIEWABLE = (".png", ".jpg", ".jpeg", ".gif", ".webp")
CONVERT = (".heic", ".heif", ".tif", ".tiff", ".bmp", ".avif", ".ico", ".svg", ".jfif", ".jp2", ".psd")
VIDEO_EXT = (".mp4", ".mov", ".mkv", ".webm", ".avi", ".3gp", ".m4v", ".wmv", ".mpeg", ".mpg", ".mts")
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".ogg", ".oga", ".opus", ".flac", ".aac", ".amr", ".wma")
INSTALL = "`python3 -m pip install -q -r scripts/supervisor/requirements.txt`"
CHROMIUM = Path("/opt/pw-browsers/chromium")
MAX_MEMBERS = 2000
MAX_UNPACKED = 200 * 1024 * 1024  # the same zip-bomb caution as the server


def viewable(path: Path) -> Path | None:
    """A copy the Read tool can show, or None."""
    ext = path.suffix.lower()
    if ext in VIEWABLE:
        return path
    out = path.with_name(path.name + ".png")
    if ext == ".svg":
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as pw:
                b = pw.chromium.launch(**({"executable_path": str(CHROMIUM)} if CHROMIUM.exists() else {}))
                pg = b.new_page()
                pg.goto(path.resolve().as_uri())
                pg.screenshot(path=str(out), full_page=True)
                b.close()
            return out
        except Exception:  # noqa: BLE001
            return None
    try:
        from PIL import Image
        try:
            import pillow_heif
            pillow_heif.register_heif_opener()
        except Exception:  # noqa: BLE001
            pass
        with Image.open(path) as im:
            frames = getattr(im, "n_frames", 1)
            im.seek(0)
            im.convert("RGB").save(out)
            for i in range(1, min(frames, 50)):  # multi-page TIFF: every page
                im.seek(i)
                im.convert("RGB").save(path.with_name(f"{path.name}.p{i + 1}.png"))
        return out
    except Exception:  # noqa: BLE001
        return None


def video_frames(path: Path, rel: Callable[[Path], str] = str) -> tuple[str, int]:
    """One frame every 5 s (≤ 360) so the supervisor SEES the video."""
    try:
        import imageio_ffmpeg
        dest = path.with_name(path.name + ".frames")
        dest.mkdir(exist_ok=True)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-i", str(path),
                        "-vf", "fps=1/5,scale='min(1280,iw)':-2", "-frames:v", "360",
                        str(dest / "t%04d.jpg")], check=True, timeout=1200)
        return rel(dest), len(list(dest.glob("*.jpg")))
    except Exception as exc:  # noqa: BLE001
        return f"(فریم گرفته نشد: {type(exc).__name__} — {INSTALL})", 0


def unzip(path: Path, rel: Callable[[Path], str] = str) -> tuple[str, list[str]]:
    """Every member on disk (no path escapes, bounded); images made viewable, videos framed."""
    dest = path.with_name(path.name + ".d")
    notes: list[str] = []
    total = 0
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        if len(infos) > MAX_MEMBERS:
            return rel(dest), [f"آرشیو {len(infos)} عضو دارد (بیش از {MAX_MEMBERS}) — باز نشد"]
        for info in infos:
            target = (dest / info.filename).resolve()
            if info.is_dir() or not str(target).startswith(str(dest.resolve())):
                continue
            total += info.file_size
            if total > MAX_UNPACKED:
                notes.append("سقفِ باز کردن پر شد — بقیهٔ آرشیو باز نشد")
                break
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(z.read(info))
            ext = target.suffix.lower()
            if ext in VIDEO_EXT:
                d, n = video_frames(target, rel)
                notes.append(f"{info.filename}: {n} فریم در `{d}`")
            elif ext in AUDIO_EXT:
                notes.append(f"{info.filename}: صوت — رونویسیِ خودکار نداریم؛ اگر نشنیدی، needs-owner")
            elif ext == ".zip":
                _d, inner = unzip(target, rel)
                notes += [f"{info.filename}/ {x}" for x in inner]
            elif ext in CONVERT:
                v = viewable(target)
                notes.append(f"{info.filename}: برای دیدن ← `{rel(v)}`" if v else f"{info.filename}: تبدیل نشد — {INSTALL}")
    return rel(dest), notes


def look_notes(path: Path, filename: str, status: str, rel: Callable[[Path], str] = str) -> tuple[list[str], Path | None]:
    """What else there is to SEE in this file — `(notes, better_path_to_open)`."""
    low = (filename or path.name).lower()
    if low.endswith(".zip"):
        try:
            d, inner = unzip(path, rel)
        except zipfile.BadZipFile:
            return ["ZIP خراب است — خودِ فایل را بررسی کن"], None
        return [f"همهٔ محتوای آرشیو باز شد در `{d}`" + (" — " + "؛ ".join(inner) if inner else "")], None
    if low.endswith(VIDEO_EXT):
        d, n = video_frames(path, rel)
        return [f"{n} فریم (هر ۵ ثانیه) در `{d}` — **نگاهشان کن**؛ رونویسیِ گفتار در این پروژه نیست"], None
    if low.endswith(AUDIO_EXT):
        return ["صوت است و رونویسیِ خودکار نداریم — اگر نتوانستی کاملش را بشنوی، ادعا نکن؛ بخشِ وابسته needs-owner"], None
    if low.endswith(".pdf"):
        return ["PDF را با ابزارِ Read و پارامترِ `pages` ببین — **همهٔ صفحه‌ها** (۲۰ تا ۲۰ تا)؛ "
                "جدول، شکل و صفحهٔ اسکن فقط آن‌جا دیده می‌شوند"], None
    if status == "image" or low.endswith(CONVERT):
        v = viewable(path)
        if v is None:
            return [f"تبدیل به قالبِ قابلِ دیدن نشد — {INSTALL}"], None
        if v != path:
            return [f"برای دیدن: `{rel(v)}`"], v
    return [], None


def needs_bytes(filename: str) -> bool:
    """Files whose text is complete but which must ALSO be looked at."""
    return (filename or "").lower().endswith((".zip", ".pdf") + VIDEO_EXT + AUDIO_EXT)
