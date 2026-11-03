"""scripts/supervisor/inspection_view.py: archives unpack safely (no path escape, bounded) and the
«must also be looked at» rule covers PDF/ZIP/video/audio. Stdlib only."""
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "supervisor"))
import inspection_view as iv  # noqa: E402


def test_needs_bytes_covers_visible_only_formats():
    for name in ("a.pdf", "b.ZIP", "c.mp4", "d.mp3"):
        assert iv.needs_bytes(name), name
    assert not iv.needs_bytes("notes.txt")


def test_unzip_never_writes_outside_its_folder(tmp_path):
    z = tmp_path / "x.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("../escape.txt", "no")
        f.writestr("ok/inner.txt", "yes")
    notes, _ = iv.look_notes(z, "x.zip", "ok")
    assert (tmp_path / "x.zip.d" / "ok" / "inner.txt").read_text() == "yes"
    assert not (tmp_path / "escape.txt").exists()
    assert "باز شد" in notes[0]


def test_audio_is_never_claimed_as_heard(tmp_path):
    p = tmp_path / "v.mp3"
    p.write_bytes(b"\0")
    notes, _ = iv.look_notes(p, "v.mp3", "unsupported")
    assert "needs-owner" in notes[0]
