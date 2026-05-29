// Reciter audio sources and per-ayah URL builder.
import { pad3 } from "./format.js";

const RECITERS = [
  { id:"parhizgar", name:"استاد پرهیزکار",
    templates:[
      "https://audio.qurancdn.com/verses/Parhizgar_48kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Parhizgar_48kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Parhizgar_48kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"minshawi", name:"منشاوی (مرتّل)",
    templates:[
      "https://audio.qurancdn.com/verses/Minshawy_Murattal_128kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Minshawy_Murattal_128kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Minshawy_Murattal_128kbps/{SSS}{AAA}.mp3",
    ]},
  { id:"husary", name:"حصری (مرتّل)",
    templates:[
      "https://audio.qurancdn.com/verses/Husary_64kbps/{SSS}{AAA}.mp3",
      "https://verses.quran.com/Husary_64kbps/mp3/{SSS}{AAA}.mp3",
      "http://everyayah.com/data/Husary_64kbps/{SSS}{AAA}.mp3",
    ]},
];
const buildAyahUrl=(reciterId,s,a,i=0)=>{
  const r=RECITERS.find(x=>x.id===reciterId)||RECITERS[0];
  const t=r.templates[i]; if(!t) return null;
  return t.replace("{SSS}", pad3(s)).replace("{AAA}", pad3(a));
};

export { RECITERS, buildAyahUrl };
