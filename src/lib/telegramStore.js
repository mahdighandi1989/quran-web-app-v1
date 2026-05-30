// Per-user Telegram config persistence in Firestore — NOT in browser localStorage.
// Each signed-in user reads/writes only their own document: telegramConfigs/{uid}
// (enforced by Firestore security rules; see firestore.rules). This keeps the bot token,
// chat ids, devices and preferences in the backend and scoped to the logged-in account.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { DEFAULT_TELEGRAM } from './telegram.js';

const ref = (uid) => doc(db, 'telegramConfigs', uid);

// Merge a (possibly partial) stored config over the defaults so new fields always exist.
export function withTelegramDefaults(data) {
  const d = data || {};
  return {
    ...DEFAULT_TELEGRAM,
    ...d,
    notifications: { ...DEFAULT_TELEGRAM.notifications, ...(d.notifications || {}) },
    devices: Array.isArray(d.devices) ? d.devices : [],
    reminders: Array.isArray(d.reminders) ? d.reminders : [],
  };
}

export async function loadTelegramConfig(uid) {
  if (!uid) return withTelegramDefaults(null);
  const snap = await getDoc(ref(uid));
  return withTelegramDefaults(snap.exists() ? snap.data() : null);
}

export async function saveTelegramConfig(uid, config) {
  if (!uid) throw new Error('برای ذخیرهٔ تنظیمات تلگرام باید وارد حساب شوید.');
  await setDoc(ref(uid), withTelegramDefaults(config));
  return true;
}
