// Mirrors a compact, read-only summary of the user's app state to Firestore at
// appState/{uid}, so the Telegram bot server (Firebase Admin) can answer /status, /progress
// and /today with REAL data. Only the signed-in owner can write it (see firestore.rules).
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const DAY = 24 * 60 * 60 * 1000;

// Pure: build the summary object from app state (exported for testing).
export function buildAppStateSummary({ user, sessions = [], dataset = [], pageStructure = [], flaggedAyahs = {} } = {}) {
  const today0 = startOfToday();
  const weekAgo = Date.now() - 7 * DAY;
  let totalCorrect = 0, totalWrong = 0, last7 = 0, lastSessionAt = 0;
  let todaySessions = 0, todayCorrect = 0, todayWrong = 0;
  for (const s of sessions || []) {
    const c = (s.correctItems && s.correctItems.length) || 0;
    const w = (s.wrongItems && s.wrongItems.length) || 0;
    totalCorrect += c; totalWrong += w;
    const t = s.end || s.start || 0;
    if (t > lastSessionAt) lastSessionAt = t;
    if (t >= weekAgo) last7 += 1;
    if (t >= today0) { todaySessions += 1; todayCorrect += c; todayWrong += w; }
  }
  const graded = totalCorrect + totalWrong;
  return {
    updatedAt: Date.now(),
    user: { name: (user && (user.displayName || user.email)) || '' },
    dataset: { ayahs: dataset.length },
    pages: pageStructure.length,
    flagged: Object.keys(flaggedAyahs || {}).length,
    sessions: {
      total: (sessions || []).length,
      last7Days: last7,
      totalCorrect, totalWrong,
      accuracyPct: graded ? Math.round((totalCorrect / graded) * 100) : 0,
      lastSessionAt,
      today: { sessions: todaySessions, correct: todayCorrect, wrong: todayWrong },
    },
  };
}

export async function saveAppState(uid, summary) {
  if (!uid) return false;
  await setDoc(doc(db, 'appState', uid), summary);
  return true;
}

// A compact slice of the user's ayah dataset, so the Telegram bot can run practice/hifz/AI
// over real ayahs. Capped to stay well under Firestore's 1MB/doc limit.
export function buildQuranSample(dataset = [], cap = 300) {
  const items = [];
  for (const a of dataset) {
    const withDia = (a.tokens_with_diacritics || a.tokens || []).join(' ');
    const plain = (a.tokens_plain || a.tokens || []).join(' ');
    if (!withDia && !plain) continue;
    items.push({ s: a.surah_number, a: a.ayah_number, n: a.surah_name || '', t: withDia || plain, p: plain || withDia });
    if (items.length >= cap) break;
  }
  return { updatedAt: Date.now(), count: items.length, ayahs: items };
}

export async function saveQuranSample(uid, dataset) {
  if (!uid) return false;
  await setDoc(doc(db, 'quranSamples', uid), buildQuranSample(dataset));
  return true;
}
