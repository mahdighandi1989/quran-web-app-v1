// Visual RTL-order guard for the hifz cloze modes (owner sheet 10, 2026-11-04).
// Usage: npm run build && npx vite preview --port 4173 & node scripts/supervisor/rtl_cloze_check.cjs [outDir]
// Exit 0 = order is mushaf order (word 1 is the RIGHT-most; last word is the LEFT-most); 1 = wrong; screenshots go to outDir.
const { chromium } = require('playwright');
const OUT=process.argv[2]||'/tmp';
(async()=>{
 const ds=[[1,'الفاتحة',1,['بِسْمِ','اللَّهِ','الرَّحْمَٰنِ','الرَّحِيمِ'],['بسم','الله','الرحمن','الرحيم']],[1,'الفاتحة',2,['الْحَمْدُ','لِلَّهِ','رَبِّ','الْعَالَمِينَ'],['الحمد','لله','رب','العالمين']],[1,'الفاتحة',3,['الرَّحْمَٰنِ','الرَّحِيمِ'],['الرحمن','الرحيم']]].map(([s,n,a,D,P])=>({surah_number:s,surah_name:n,ayah_number:a,tokens_with_diacritics:D,tokens_plain:P,page_number:1}));
 const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:900,height:900}});
 await ctx.addInitScript(([d])=>{ for(const k of ['quran.datacenter.dataset.v1']) localStorage.setItem(k,JSON.stringify(d)); },[ds]);
 const p=await ctx.newPage();
 await p.goto('http://localhost:4173/hifz',{waitUntil:'networkidle'}); await p.waitForTimeout(2500); await p.getByText('حفظ',{exact:true}).first().click().catch(()=>{}); await p.waitForTimeout(1500);
 
 for (const val of ['cloze_last','cloze_first']) {
  const sel = p.locator('select.form-select').filter({has:p.locator('option[value="'+val+'"]')});
  if(!(await sel.count())){console.log('no select');break;}
  await sel.first().selectOption(val); await p.waitForTimeout(800);
  const res = await p.evaluate(()=>[...document.querySelectorAll('.cloze-container')].map(c=>[...c.querySelectorAll('.cloze-text,input.hifz-blank-input')].map(e=>({t:e.tagName==='INPUT'?'_':e.textContent,x:Math.round(e.getBoundingClientRect().x)}))));
  console.log(val,JSON.stringify(res));
  const row=res[1]; const ok=val==='cloze_last'?row[row.length-1].t!=='_'&&row.slice(0,-1).every(e=>e.t==='_')&&row.every((e,i)=>i===0||e.x<row[i-1].x):row[0].t!=='_'&&row.slice(1).every(e=>e.t==='_')&&row.every((e,i)=>i===0||e.x<row[i-1].x); if(!ok){console.log('FAIL',val);process.exitCode=1;}
  await p.screenshot({path:`${OUT}/${val}.png`});
 }
 await b.close();})();
