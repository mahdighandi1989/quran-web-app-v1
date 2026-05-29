// Small formatting / tokenization helpers shared across the app.
export const toAr = n => String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);
export const pad3 = n => String(n).padStart(3, "0");
export const slugAyah = a => `${a.surah_number}:${a.ayah_number}`;
export const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const joinTokens = a => (a || []).join(" ");
export const tokenizeWords = s => (s || "").trim() ? (s || "").trim().split(/\s+/) : [];
