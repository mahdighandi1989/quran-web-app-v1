// Google Drive sync: payload (de)serialization, download validation, and REST helpers.
const DRIVE_FILE_NAME = "quran_backup_full.json";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_TOKEN_SS = "quran.drive.token"; // sessionStorage: survives same-tab reloads only

// The exact slice of app state mirrored to the Drive file.
const buildSyncPayload = (s) => ({
  dataset: s.dataset || [],
  sessions: s.sessions || [],
  pageStructure: s.pageStructure || [],
  flaggedAyahs: s.flaggedAyahs || {},
  settings: s.settings || {},
});
// Stable serialization used to detect "did anything actually change?" (ignores metadata).
const serializeSync = (s) => JSON.stringify(buildSyncPayload(s));

async function driveErr(res){
  let msg = String(res.status);
  try { const j = await res.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch {}
  const e = new Error(msg); e.status = res.status; return e;
}
async function driveFindFile(token, name){
  const params = new URLSearchParams({
    q: `name='${name}' and trashed=false`,
    spaces: "drive",
    pageSize: "10",
    orderBy: "modifiedTime desc",
    fields: "files(id,name,modifiedTime)",
  });
  const url = `${DRIVE_API}/files?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if(!res.ok) throw await driveErr(res);
  const data = await res.json();
  return (data.files && data.files[0]) || null;
}
// The Drive backup file is user-readable/editable and may be empty, truncated, or
// hand-edited into invalid JSON. Validate the downloaded content instead of trusting
// res.json() blindly (anti-pattern: consuming external/IO data without validation).
// A usable backup is either the sync object {dataset,sessions,...} or a legacy bare
// dataset array; primitives/null are rejected with a clear, surfaced error so the
// caller's catch can report it rather than silently using garbage.
function validateDrivePayload(data){
  if (data === null || typeof data !== "object") {
    throw new Error("محتوای فایل پشتیبان Drive نامعتبر است (شیٔ JSON یا آرایه انتظار می‌رفت).");
  }
  return data;
}
async function driveDownload(token, fileId){
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if(!res.ok) throw await driveErr(res);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("فایل پشتیبان Drive قابل تجزیه نیست (JSON نامعتبر یا خالی).");
  }
  return validateDrivePayload(data);
}
async function driveCreate(token, name, contentObj){
  const boundary = "quranapp" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, mimeType: "application/json" }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(contentObj) +
    `\r\n--${boundary}--`;
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if(!res.ok) throw await driveErr(res);
  return res.json();
}
async function driveUpdate(token, fileId, contentObj){
  const res = await fetch(`${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(contentObj),
  });
  if(!res.ok) throw await driveErr(res);
  return res.json();
}

export {
  DRIVE_FILE_NAME, DRIVE_API, DRIVE_UPLOAD, DRIVE_TOKEN_SS,
  buildSyncPayload, serializeSync, driveErr, validateDrivePayload,
  driveFindFile, driveDownload, driveCreate, driveUpdate,
};
