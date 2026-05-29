// XLSX (Excel) parsing + dataset merge. xlsxLoadFailed is set by the CDN loader in App.jsx.
let xlsxLoadFailed = false;
const sheetToAoA = ws => window.XLSX?.utils?.sheet_to_json(ws, { header:1, raw:true }) || [];
function parseWithOrWithout(ws,{mode}){
  const A=sheetToAoA(ws); if(!A.length) return [];
  const header=A[0]; const idx={ page:1, surah:2, ayah:3, start:4 };
  header.forEach((v,i)=>{ const s=(v||"").toString().trim().toLowerCase();
    if(s.includes("surah")||s.includes("سوره")) idx.surah=i;
    if(s.includes("ayah")||s.includes("آیه")||s.includes("ایه")) idx.ayah=i;
    if(s.includes("page")||s.includes("صفحه")) idx.page=i;
  });
  const rows=[];
  for(let r=1;r<A.length;r++){
    const row=A[r]; const s=Number(row[idx.surah]); const a=Number(row[idx.ayah]); if(!s||!a) continue;
    const page=row[idx.page]!=null && row[idx.page]!=="" ? Number(row[idx.page]) : null;
    const toks=[]; for(let c=idx.start;c<row.length;c++){ const v=row[c]; if(typeof v==="string" && v.trim()) toks.push(v.trim()); }
    const base={ surah_number:s, ayah_number:a, page, tokens:toks };
    rows.push(mode==="with" ? { ...base, tokens_with_diacritics:toks } : { ...base, tokens_plain:toks });
  }
  return rows;
}
function parseSurahList(ws){
  const A=sheetToAoA(ws), out=[];
  for(const row of A){
    const n=row.find(v=>typeof v==="number");
    const t=row.find(v=>typeof v==="string" && v.trim());
    if(n && t) out.push({ number:n, name:t.trim() });
  }
  return out;
}
function parseExcelFile(file,{mode}){
  if (!window.XLSX) {
    alert(xlsxLoadFailed
      ? "بارگذاری کتابخانهٔ پردازش اکسل ناموفق بود. اتصال اینترنت را بررسی کرده و صفحه را تازه‌سازی کنید."
      : "کتابخانهٔ پردازش اکسل در حال بارگذاری است، لطفاً چند لحظه صبر کرده و دوباره تلاش کنید.");
    return {};
  }
  const wb=window.XLSX.read(file,{type:"array"}); const ws=wb.Sheets[wb.SheetNames[0]];
  if(mode==="surah") return { surahList:parseSurahList(ws) };
  if(mode==="with") return { withDia:parseWithOrWithout(ws,{mode:"with"}) };
  if(mode==="without") return { withoutDia:parseWithOrWithout(ws,{mode:"without"}) };
  return {};
}
const mapByKey = rows => { const m=new Map(); for(const r of rows||[]){ const k=`${r.surah_number}:${r.ayah_number}`; if(!m.has(k)) m.set(k,r); } return m; };
function mergeData({withDia, withoutDia, surahList}){
  const wM=mapByKey(withDia), woM=mapByKey(withoutDia);
  const names=new Map(); (surahList||[]).forEach(s=>names.set(Number(s.number), s.name));
  const keys=new Set([...wM.keys(), ...woM.keys()]); const merged=[];
  keys.forEach(k=>{
    const [s,a]=k.split(":").map(Number); const w=wM.get(k), wo=woM.get(k);
    merged.push({
      surah_number:s, ayah_number:a, surah_name:names.get(s)||w?.surah_name||wo?.surah_name||null,
      page: w?.page ?? wo?.page ?? null,
      tokens_with_diacritics: w?.tokens_with_diacritics || w?.tokens || [],
      tokens_plain: wo?.tokens_plain || wo?.tokens || [],
    });
  });
  merged.sort((x,y)=> x.surah_number-y.surah_number || x.ayah_number-y.ayah_number);
  return { merged };
}

export function setXlsxLoadFailed(v){ xlsxLoadFailed = v; }
export {
  sheetToAoA, parseWithOrWithout, parseSurahList, parseExcelFile, mapByKey, mergeData,
};
