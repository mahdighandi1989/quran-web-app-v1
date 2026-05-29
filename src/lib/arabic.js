// Arabic text normalization, similarity & grapheme helpers (moved verbatim from App.jsx).
const AR_DIAC=/[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const AR_TAT=/\u0640/g;
const INVIS=/[\u200c\u200f]/g;
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
const eq = (a,b) => normAR(a) === normAR(b);

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

export { normAR, eq, levenshtein, getSimilarity, segGraphemes, normalizeWS, isAllGreen };
