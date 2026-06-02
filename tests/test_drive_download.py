"""Edge-case test for the Google Drive download payload validation (task 60d2a8a0).

This mirrors `validateDrivePayload` / `driveDownload` in `src/lib/drive.js`, which
guards the "AI/IO without validation" anti-pattern: a corrupted backup downloaded
from Google Drive must never be silently consumed. A usable backup is either the
sync object ``{"dataset": [...], ...}`` or a legacy bare ``[...]`` dataset array;
``None`` and primitive/corrupted payloads are rejected with a clear, surfaced error.

The test is intentionally self-contained (stdlib + pytest only) so it can run in a
verification environment without the JS toolchain.
"""

import json

import pytest


class DrivePayloadError(ValueError):
    """Raised when a downloaded Drive backup is not a usable JSON object/array."""


def validate_drive_payload(data):
    """Reject corrupted payloads; return the object/array unchanged otherwise.

    Mirrors validateDrivePayload() in src/lib/drive.js.
    """
    # In JS, both objects ({}) and arrays ([]) are typeof === "object". The Python
    # equivalent of "is an object or array" is dict or list.
    if data is None or not isinstance(data, (dict, list)):
        raise DrivePayloadError(
            "محتوای فایل پشتیبان Drive نامعتبر است (شیٔ JSON یا آرایه انتظار می‌رفت)."
        )
    return data


def drive_download(raw_text):
    """Parse + validate a downloaded backup body (mirrors driveDownload()).

    Raises DrivePayloadError on invalid JSON or on a structurally invalid payload.
    """
    try:
        data = json.loads(raw_text)
    except (ValueError, TypeError):
        raise DrivePayloadError(
            "فایل پشتیبان Drive قابل تجزیه نیست (JSON نامعتبر یا خالی)."
        )
    return validate_drive_payload(data)


def test_drive_download_corrupted_payload():
    # 1) Primitive / null payloads are rejected, never silently used as garbage.
    for corrupted in (None, 42, 3.14, "corrupt", True):
        with pytest.raises(DrivePayloadError):
            validate_drive_payload(corrupted)

    # 2) A body that is not valid JSON is rejected with a clear error.
    for bad_json in ("", "not json", "{unterminated", "12345abc"):
        with pytest.raises(DrivePayloadError):
            drive_download(bad_json)

    # 3) A JSON primitive (e.g. a bare number/string) is rejected even though it
    #    parses, because it is not a usable backup object/array.
    for primitive_json in ("12345", '"corrupt"', "true", "null"):
        with pytest.raises(DrivePayloadError):
            drive_download(primitive_json)

    # 4) Structurally valid payloads pass through unchanged: the sync object and the
    #    legacy bare-array form.
    sync_obj = {"dataset": [{"surah_number": 1}], "sessions": [], "settings": {"theme": "dark"}}
    assert drive_download(json.dumps(sync_obj)) == sync_obj

    legacy_array = [{"surah_number": 1}, {"surah_number": 2}]
    assert drive_download(json.dumps(legacy_array)) == legacy_array
