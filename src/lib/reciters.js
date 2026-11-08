// Reciter audio sources and per-ayah URL builder.
// Sheet 5-۵ (measured 2026-11-05, HEAD on 001001): audio.qurancdn.com and verses.quran.com answer 404 for all three
// reciters; http://everyayah.com only redirects (301); https://everyayah.com answers 200. So https everyayah is tried
// FIRST — no failed round-trips before every ayah. The other templates stay as fallbacks (nothing removed).
import { pad3 } from "./format.js";

const RECITERS = [
  { id:"parhizgar", name:"استاد پرهیزکار",
    templates:[
      "https://everyayah.com/data/Parhizgar_48kbps/{SSS}{AAA}.mp3",
      "https://audio.qurancdn.com/verses/Parhizgar_48kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Parhizgar_48kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Parhizgar_48kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"minshawi", name:"منشاوی (مرتّل)",
    templates:[
      "https://everyayah.com/data/Minshawy_Murattal_128kbps/{SSS}{AAA}.mp3",
      "https://audio.qurancdn.com/verses/Minshawy_Murattal_128kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Minshawy_Murattal_128kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Minshawy_Murattal_128kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"husary", name:"حصری (مرتّل)",
    templates:[
      "https://everyayah.com/data/Husary_64kbps/{SSS}{AAA}.mp3",
      "https://audio.qurancdn.com/verses/Husary_64kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Husary_64kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Husary_64kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"husary_muallim", name:"حصری (معلّم — تکرارِ کودکان)",
    templates:[
      "https://everyayah.com/data/Husary_Muallim_128kbps/{SSS}{AAA}.mp3",
      "https://audio.qurancdn.com/verses/Husary_Muallim_128kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Husary_Muallim_128kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Husary_Muallim_128kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"minshawi_teacher", name:"منشاوی (معلّم)",
    templates:[
      "https://everyayah.com/data/Minshawy_Teacher_128kbps/{SSS}{AAA}.mp3",
      "https://audio.qurancdn.com/verses/Minshawy_Teacher_128kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Minshawy_Teacher_128kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Minshawy_Teacher_128kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"alafasy", name:"عفاسی (مرتّل)",
    templates:[
      "https://everyayah.com/data/Alafasy_128kbps/{SSS}{AAA}.mp3",
      "https://audio.qurancdn.com/verses/Alafasy_128kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Alafasy_128kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Alafasy_128kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"abdulbasit", name:"عبدالباسط (مرتّل)",
    templates:[
      "https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/{SSS}{AAA}.mp3",
      "https://audio.qurancdn.com/verses/Abdul_Basit_Murattal_192kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Abdul_Basit_Murattal_192kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Abdul_Basit_Murattal_192kbps/{SSS}{AAA}.mp3",
    ]},
];
const buildAyahUrl=(reciterId,s,a,i=0)=>{
  const r=RECITERS.find(x=>x.id===reciterId)||RECITERS[0];
  const t=r.templates[i]; if(!t) return null;
  return t.replace("{SSS}", pad3(s)).replace("{AAA}", pad3(a));
};

export { RECITERS, buildAyahUrl };
