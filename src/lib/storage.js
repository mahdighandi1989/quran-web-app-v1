// localStorage keys, default settings, merge + safe persistence with critical-event notify.
// NOTE: Telegram config is intentionally NOT stored here — it lives per-user in Firestore
// (see src/lib/telegramStore.js) so the bot token/ids never persist in the browser.
const LS = {
  DATASET:"quran.datacenter.dataset.v1",
  SETTINGS:"quran.datacenter.settings.v5",
  PAGE_STRUCTURE:"quran.hifz.page_structure.v3", // ** Version updated for new structure **
  FLAGGED_AYAHS: "quran.hifz.flagged.v1",
  PRACTICE_MODE:"quran.practice.mode",
  PRACTICE_CLOZE:"quran.practice.cloze",
  PRACTICE_RANDOM:"quran.practice.randomCount",
  PRACTICE_COLOR_INSIDE:"quran.practice.colorInside",
  SHOW_REF:"quran.practice.showRef",
  SHOW_MCQ_REF:"quran.practice.showMcqRef",
  AUTO_ADV:"quran.practice.autoAdvance",
  PRACTICE_RANGE_TYPE: "quran.practice.range.type",
  PRACTICE_RANGE_START_S:"quran.practice.range.start.s",
  PRACTICE_RANGE_START_A:"quran.practice.range.start.a",
  PRACTICE_RANGE_END_S:"quran.practice.range.end.s",
  PRACTICE_RANGE_END_A:"quran.practice.range.end.a",
  PRACTICE_RANGE_JUZ:"quran.practice.range.juz",
  PRACTICE_RANGE_PAGE_START:"quran.practice.range.page.start",
  PRACTICE_RANGE_PAGE_END:"quran.practice.range.page.end",
  PRACTICE_ORDER:"quran.practice.order",
  RECITER:"quran.audio.reciter",
  SESSIONS:"quran.sessions.v1",
  MCQ_DELAY: "quran.practice.mcqDelay",
};
const defaultSettings = {
    deckSize: 40,
    rtlUI: true,
    reciter: "parhizgar",
    showMcqRef: true,
    colorInside: true,
    mcqDelay: 300,
    voiceAutoAdvanceDelay: 10,
    showHifzTab: true,
    recognitionSensitivity: 0.8,
    hifzAdvanceDelay: 10,
    trainAdvanceOnWrong: false,
    hifzAdvanceOnWrong: false,
    enableAutoFill: false,
    autoFillPercentage: 70,
    // appearance & accessibility
    darkMode: false,
    fontScale: 100,        // % scale for Arabic ayah text (80–160)
    // exam defaults
    examPassPct: 80,       // pass threshold for exam karnameh
    examTimeLimit: 0,      // minutes; 0 = unlimited
    // goals
    dailyGoal: 20,         // ayahs/questions per day
    hifzTheme: {
        bg: '#fdfaf3',
        border: '#c9b89b',
        font: '#000000',
        ayahMarker: '#0d9488',
        ayahMarkerBg: '#ccfbf1',
    },
    hifzHighlight: {
        color: '#fff2b2',
        animation: 'fade-in'
    }
};

// Merge incoming settings (from Drive) over the defaults, preserving nested objects.
const mergeSettings = (saved) => {
  const s = saved && typeof saved === "object" ? saved : {};
  return {
    ...defaultSettings,
    ...s,
    hifzTheme: { ...defaultSettings.hifzTheme, ...(s.hifzTheme || {}) },
    hifzHighlight: { ...defaultSettings.hifzHighlight, ...(s.hifzHighlight || {}) },
  };
};


// Frontend analog of a non-silent, high-priority notification: a CRITICAL failure must
// never be swallowed silently (the user would never know). Always logs to the console,
// and surfaces a single user-facing message — rate-limited per event so a repeated
// failure (e.g. storage quota hit on every change) cannot spam the user.
const _criticalEventLast = {};
// Optional external sink (e.g. App registers one to forward critical events to Telegram).
let _criticalEventSink = null;
function setCriticalEventSink(fn) { _criticalEventSink = typeof fn === "function" ? fn : null; }
function notifyCriticalEvent(event, message, { minIntervalMs = 30000, priority = "high", silent = false } = {}) {
  // Defaults model a non-silent, high-priority notification (silent=false, priority=high):
  // never swallow — log every occurrence. silent=true downgrades to log/forward only (no popup).
  try { console.error(`[critical:${event}] (priority=${priority}) ${message}`); } catch {}
  const now = Date.now();
  if (_criticalEventLast[event] && now - _criticalEventLast[event] < minIntervalMs) return false;
  _criticalEventLast[event] = now;
  if (!silent) { try { if (typeof window !== "undefined" && typeof window.alert === "function") window.alert(message); } catch {} }
  try { if (_criticalEventSink) _criticalEventSink(event, message, { priority, silent }); } catch {}
  return true;
}

const saveLS=(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){
  // Persisting to localStorage failed (quota exceeded / private mode / blocked). This is
  // critical — the user's data is silently lost otherwise — so notify instead of swallowing.
  notifyCriticalEvent("storage_save_failed", "ذخیرهٔ داده‌ها در حافظهٔ مرورگر ناموفق بود (احتمالاً حافظه پر است یا حالت ناشناس فعال است). تغییرات اخیر ممکن است حفظ نشوند.");
} };
const loadLS=(k,d)=>{ try{ const v=localStorage.getItem(k); return v? JSON.parse(v):d; }catch{ return d; } };

export { LS, defaultSettings, mergeSettings, notifyCriticalEvent, setCriticalEventSink, saveLS, loadLS };
