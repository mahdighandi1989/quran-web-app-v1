// Per-user Telegram config persistence in Firestore — NOT in browser localStorage.
// Each signed-in user reads/writes only their own document: telegramConfigs/{uid}
// (enforced by Firestore security rules; see firestore.rules). This keeps the bot token,
// chat ids, devices and preferences in the backend and scoped to the logged-in account.
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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

// Flat list of every chat id (primary + devices) so the bot can resolve a chat -> user via
// an array-contains query (the bot only knows the chat id of an incoming message).
export function collectChatIds(config) {
  const ids = [];
  if (config && config.primaryChatId) ids.push(String(config.primaryChatId));
  for (const d of (config && config.devices) || []) if (d && d.chatId) ids.push(String(d.chatId));
  return [...new Set(ids)];
}

export async function loadTelegramConfig(uid) {
  if (!uid) return withTelegramDefaults(null);
  const snap = await getDoc(ref(uid));
  return withTelegramDefaults(snap.exists() ? snap.data() : null);
}

// Realtime subscription: reflects changes made by the bot (e.g. /remind) or other devices.
export function subscribeTelegramConfig(uid, onData, onError) {
  if (!uid) { onData(withTelegramDefaults(null)); return () => {}; }
  return onSnapshot(
    ref(uid),
    (snap) => onData(withTelegramDefaults(snap.exists() ? snap.data() : null)),
    (err) => { if (onError) onError(err); },
  );
}

export async function saveTelegramConfig(uid, config) {
  if (!uid) throw new Error('برای ذخیرهٔ تنظیمات تلگرام باید وارد حساب شوید.');
  const data = withTelegramDefaults(config);
  data.allChatIds = collectChatIds(data); // index field for the bot's chat->user lookup
  await setDoc(ref(uid), data);
  return true;
}
