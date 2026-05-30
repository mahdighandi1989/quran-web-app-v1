// Per-user AI config persistence in Firestore at aiConfigs/{uid} (owner-only via rules).
// Stored ONLY when signed in. Signed-out (guest) usage keeps the key in memory only — the
// caller simply doesn't persist it. Realtime subscribe mirrors changes across devices.
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { DEFAULT_AI } from './aiProviders.js';

const ref = (uid) => doc(db, 'aiConfigs', uid);

export function withAiDefaults(data) {
  const d = data || {};
  return {
    ...DEFAULT_AI,
    ...d,
    keys: (d.keys && typeof d.keys === 'object') ? d.keys : {},
    customProviders: Array.isArray(d.customProviders) ? d.customProviders : [],
    extraModels: (d.extraModels && typeof d.extraModels === 'object') ? d.extraModels : {},
  };
}

export async function loadAiConfig(uid) {
  if (!uid) return withAiDefaults(null);
  const snap = await getDoc(ref(uid));
  return withAiDefaults(snap.exists() ? snap.data() : null);
}

export function subscribeAiConfig(uid, onData, onError) {
  if (!uid) { onData(withAiDefaults(null)); return () => {}; }
  return onSnapshot(
    ref(uid),
    (snap) => onData(withAiDefaults(snap.exists() ? snap.data() : null)),
    (err) => { if (onError) onError(err); },
  );
}

export async function saveAiConfig(uid, config) {
  if (!uid) throw new Error('برای ذخیرهٔ تنظیمات هوش مصنوعی باید وارد حساب شوید.');
  await setDoc(ref(uid), withAiDefaults(config));
  return true;
}
