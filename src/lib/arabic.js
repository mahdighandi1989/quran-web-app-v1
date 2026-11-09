// Arabic text normalization, similarity & grapheme helpers (moved verbatim from App.jsx).
const AR_DIAC=/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g;
const AR_TAT=/\u0640/g;
const INVIS=/[\u200b-\u200f\u2066-\u2069\ufeff]/g;
const PUNC=/[.,;:!؟،؛"'\-()\[\]{}]/g;

const normAR = s => {
  if (!s) return "";
  return String(s)
    .normalize('NFC')
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/[\u064a\u0649]/g, "\u06cc")
    .replace(/\u0643/g, "\u06a9")
    .replace(/\u0629/g, "\u0647")
    .replace(AR_DIAC,"").replace(AR_TAT,"").replace(INVIS,"")
    .replace(PUNC," ")
    .replace(/\s+/g, " ")
    .trim();
};
// Uthmani spelling vs. ordinary spelling (sheet 26, 2026-11-09): «مَٰلِكِ» carries a superscript alef (U+0670) and a
// plain column made from Uthmani text has no alef at all («ملك»), while the user types «مالك». Compared word by
// word: equal after normAR; or the target's superscript alef read as «ا»; or the typed word has EXTRA «ا» (not at
// the start) that the Uthmani spelling leaves out. One direction only — a typed word MISSING an alef the target
// has is still wrong.
const DAGGER=/\u0670/g;
const dropMedialAlef = w => w.length > 1 ? w[0] + w.slice(1).replace(/\u0627/g, "") : w;
const eqWord = (t, g) => {
  const nt = normAR(t), ng = normAR(g);
  if (nt === ng) return true;
  if (!nt || !ng) return false;
  if (/\u0670/.test(String(g)) && normAR(String(g).replace(DAGGER, "\u0627")) === nt) return true;
  return dropMedialAlef(nt) === ng;
};
const eq = (a,b) => {
  const na = normAR(a), nb = normAR(b);
  if (na === nb) return true;
  const ta = na.split(" "), tb = nb.split(" ");
  if (ta.length !== tb.length) return false;
  // re-split the RAW target so the superscript alef is still visible to eqWord
  const rb = String(b||"").normalize("NFC").replace(PUNC," ").replace(INVIS,"").trim().split(/\s+/);
  const raw = rb.length === tb.length ? rb : tb;
  return ta.every((w,i) => eqWord(w, raw[i]));
};
// «Has the user typed as much as the target?» — for marking a WRONG answer once typing is finished. Raw .length
// counted vowel marks and the alef Uthmani omits, so «مال» for «ملك» was graded wrong before «ك» was typed.
const typedReachedTarget = (typed, target) => {
  const t = normAR(typed).split(" ").filter(Boolean), g = normAR(target).split(" ").filter(Boolean);
  if (!g.length) return t.length > 0;
  if (t.length !== g.length) return t.length > g.length;
  return dropMedialAlef(t[t.length-1]).length >= g[g.length-1].length;
};

// Levenshtein distance for fuzzy string matching (voice recognition)
const levenshtein = (s1, s2) => {
  if (!s1 || !s2) return (s1 || s2).length;
  const l1 = s1.length, l2 = s2.length;
  let prevRow = Array(l2 + 1).fill(0).map((_, i) => i);
  for (let i = 0; i < l1; i++) {
    let currRow = [i + 1];
    for (let j = 0; j < l2; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      currRow[j + 1] = Math.min(prevRow[j + 1] + 1, currRow[j] + 1, prevRow[j] + cost);
    }
    prevRow = currRow;
  }
  return prevRow[l2];
};

const getSimilarity = (s1, s2) => {
  const normalized1 = normAR(s1);
  const normalized2 = normAR(s2);
  const maxLen = Math.max(normalized1.length, normalized2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshtein(normalized1, normalized2);
  return 1.0 - distance / maxLen;
};


/** Arabic grapheme segmentation */
function segGraphemes(str){
  if(!str) return [];
  try{
    const seg = new (Intl).Segmenter("ar",{granularity:"grapheme"});
    return Array.from(seg.segment(str), s => s.segment);
  }catch{
    const out=[]; let buf=""; const isMark=ch=>/[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(ch);
    for(const ch of Array.from(str)){ if(!buf){buf=ch;continue;} if(isMark(ch)) buf+=ch; else {out.push(buf); buf=ch;} }
    if(buf) out.push(buf);
    return out;
  }
}

/* ===== Whole-ayah strict visual check ===== */
const normalizeWS = s => (s||"").replace(/\s+/g," ").trim();
const isAllGreen = (typed, target)=>{
  const t = segGraphemes(normalizeWS(typed));
  const g = segGraphemes(normalizeWS(target));
  if(t.length !== g.length) return false;
  for(let i=0;i<t.length;i++){ if(t[i]!==g[i]) return false; }
  return true;
};

export { normAR, eq, eqWord, typedReachedTarget, levenshtein, getSimilarity, segGraphemes, normalizeWS, isAllGreen };
