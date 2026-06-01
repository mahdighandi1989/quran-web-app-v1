// App.jsx — Quran Web App orchestrator. Helpers/data live in ./lib/*; UI primitives + the
// main App component remain here. (Refactor task 2cf42728.)
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  auth, googleProvider, driveProvider, driveRefreshProvider, describeAuthError, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
} from "./lib/firebase.js";
import {
  DRIVE_FILE_NAME, DRIVE_API, DRIVE_UPLOAD, DRIVE_TOKEN_SS,
  buildSyncPayload, serializeSync, driveErr, validateDrivePayload,
  driveFindFile, driveDownload, driveCreate, driveUpdate,
} from "./lib/drive.js";
import { LS, defaultSettings, mergeSettings, notifyCriticalEvent, setCriticalEventSink, saveLS, loadLS } from "./lib/storage.js";
import { toAr, pad3, slugAyah, shuffle, joinTokens, tokenizeWords } from "./lib/format.js";
import { normAR, eq, levenshtein, getSimilarity, segGraphemes, normalizeWS, isAllGreen } from "./lib/arabic.js";
import { RECITERS, buildAyahUrl } from "./lib/reciters.js";
import {
  sheetToAoA, parseWithOrWithout, parseSurahList, parseExcelFile, mapByKey, mergeData, setXlsxLoadFailed,
} from "./lib/excel.js";
import { QURAN_PAGE_STRUCTURE_DEFAULT, transformPageStructureIfNeeded } from "./lib/quran.js";
import { notify as tgNotify, buildSessionEndMessage, DEFAULT_TELEGRAM } from "./lib/telegram.js";
import { subscribeTelegramConfig, saveTelegramConfig } from "./lib/telegramStore.js";
import { buildAppStateSummary, saveAppState, saveQuranSample } from "./lib/appStateStore.js";
import { startTelegramResponder } from "./lib/telegramCommands.js";
import { subscribeAiConfig, saveAiConfig } from "./lib/aiStore.js";
import { DEFAULT_AI } from "./lib/aiProviders.js";
import TelegramSettings from "./components/TelegramSettings.jsx";
import AISettings from "./components/AISettings.jsx";
import { AIAssistButton, AIChat } from "./components/AIWidgets.jsx";
import AIExamGenerator from "./components/AIExamGenerator.jsx";
import { tafsirPrompt, hifzPrompt, qaPrompt, examGenPrompt, parseJsonArray } from "./lib/aiTasks.js";
import { isAIReady, askAI } from "./lib/aiClient.js";
import { StatCard, Accordion, Segmented, TrendChart, Heatmap, HBars, ProgressRing } from "./components/StatsUI.jsx";
import {
  computeOverallStats, computeStreak, dailySeries, activityHeatmap,
  statsBySurah, mistakesByAyah, formatDuration, sessionCorrect, sessionWrong,
  sessionDurationMs, isExamSession, sessionTime,
} from "./lib/stats.js";

const INPUT_H = 48, PAD_X=10, PAD_Y=8;

function InlineRuns({ value, target, enabled }){
  if(!enabled || !value) return null;

  const typed = useMemo(()=> segGraphemes(value||""), [value]);
  const goal  = useMemo(()=> segGraphemes(target||""), [target]);
  const L = Math.max(typed.length, goal.length);
  const nodes = [];
  for (let i=0;i<L;i++){
    const ch = typed[i] ?? "";
    const ok = (typed[i] !== undefined && goal[i] !== undefined && eq(typed[i], goal[i]));
    nodes.push(<span key={i} className={ok? "hl-in-ok":"hl-in-err"}>{ch || "\u200b"}</span>);
  }
  return <>{nodes}</>;
}

function CharColorInput({ value, target, onChange, placeholder, enabled=true, inputRef, onFocus }){
  return (
    <div className="hl-wrap" style={{height:INPUT_H}}>
      <div className="hl-overlay arabic" dir="rtl" lang="ar" style={{ lineHeight: `${INPUT_H - PAD_Y*2}px` }}>
        <InlineRuns value={value} target={target} enabled={enabled}/>
      </div>
      <input
        ref={inputRef}
        onFocus={onFocus}
        dir="rtl"
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        className="hl-input arabic"
        style={{ lineHeight: `${INPUT_H - PAD_Y*2}px`, color: enabled ? "transparent":"inherit", caretColor:"var(--text-main)" }}
      />
    </div>
  );
}

function CharColorTextarea({ value, onChange, target, placeholder, rows=3, enabled=true, textareaRef, onFocus }){
  const taRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(()=>{ const t=taRef.current, w=wrapRef.current; if(!t||!w) return;
    const sync=()=>{ w.scrollTop=t.scrollTop; w.scrollLeft=t.scrollLeft; };
    t.addEventListener("scroll", sync);
    return ()=>t.removeEventListener("scroll", sync);
  },[]);

  return (
    <div className="hl-wrap" ref={wrapRef}>
      <div className="hl-overlay arabic" dir="rtl" lang="ar" style={{ lineHeight:"2.2rem", whiteSpace:"pre-wrap" }}>
        <InlineRuns value={value} target={target} enabled={enabled}/>
      </div>
      <textarea
        ref={(el)=>{ taRef.current=el; if(textareaRef) textareaRef.current=el; }}
        dir="rtl" rows={rows} value={value}
        onChange={e=>onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="hl-textarea arabic"
        style={{ color: enabled? "transparent":"inherit", caretColor:"var(--text-main)", lineHeight:"2.2rem" }}
      />
    </div>
  );
}

// New component for underlined inputs with live character validation
function UnderlinedCharColorInput({ value, target, onChange, enabled=true, inputRef, onFocus, style }) {
  return (
    <div className="hl-wrap-underline" style={style}>
      <div className="hl-overlay-underline arabic" dir="rtl" lang="ar">
        <InlineRuns value={value} target={target} enabled={enabled}/>
      </div>
      <input
        ref={inputRef}
        onFocus={onFocus}
        dir="rtl"
        value={value}
        onChange={e=>onChange(e.target.value)}
        className="hifz-blank-input arabic" // Keep the underline style
        style={{ color: enabled ? "transparent":"inherit", caretColor:"var(--text-main)" }}
      />
    </div>
  );
}

/* ====================== Cloze (inline) ====================== */
function ClozeInline({ tokensRef, tokensTarget, blanks, values, onChangeBlank, colorInside, inputRefs, onSetActive, onRegisterHint }){
  const measureRefs = useRef({}); const [widths, setWidths] = useState({}); const MIN_W = 64;
  useLayoutEffect(()=>{ const w={}; blanks.forEach(i=>{ const el = measureRefs.current[i]; if(el) w[i] = Math.ceil(el.offsetWidth) + 20; }); setWidths(w); },
    [tokensRef.join(" "), blanks.join(",")]);

  const hintOne = (i)=>{
    const t=tokensTarget[i]||"", tSeg=segGraphemes(t);
    const cur=values[i]||"", cSeg=segGraphemes(cur);
    let k=0;
    while(k<cSeg.length && k<tSeg.length && eq(cSeg[k], tSeg[k])) k++;
    if (k < tSeg.length) {
      const next=tSeg.slice(0, k + 1).join("");
      onChangeBlank(i,next);
      const el=inputRefs.current?.[i]; el?.focus();
    }
  };

  const hintGlobal=()=>{
    const activeEl = document.activeElement;
    let activeIndex = -1;
    if (inputRefs.current) {
      activeIndex = Object.keys(inputRefs.current).find(key => inputRefs.current[key] === activeEl);
    }

    if (activeIndex !== -1 && blanks.includes(Number(activeIndex))) {
      hintOne(Number(activeIndex));
    } else {
      const pick = blanks.find(i => !eq(values[i]||"", tokensTarget[i]||"")) ?? blanks[0];
      if (pick!=null) hintOne(pick);
    }
  };
  useEffect(()=>{ onRegisterHint && onRegisterHint(()=>hintGlobal()); }, [values, tokensTarget, blanks, inputRefs]);

  return (
    <div className="cloze-container" dir="rtl" lang="ar">
      {/* Invisible measurement spans */}
      <div style={{position:"absolute", opacity:0, visibility:"hidden", pointerEvents:"none", height:0, overflow:"hidden"}}>
        {blanks.map(i=>(<span key={`m-${i}`} ref={el=>{ if(el) measureRefs.current[i]=el; }}>{tokensRef[i]||""}</span>))}
      </div>

      {tokensRef.map((tok, idx)=> {
        const isBlank = blanks.includes(idx);
        return (
          <React.Fragment key={idx}>
            {idx>0 ? " " : null}
            {isBlank ? (
              <span className="cloze-blank-wrapper" style={{ verticalAlign:"baseline" }}>
                <span className="cloze-blank" style={{ minWidth: MIN_W, width: widths[idx]||MIN_W, height: INPUT_H }}>
                  <CharColorInput value={values[idx]||""} target={tokensTarget[idx]||""}
                    onChange={nv=>onChangeBlank(idx,nv)} placeholder="…" enabled={colorInside}
                    inputRef={el=>{ if(el) inputRefs.current[idx]=el; }} onFocus={()=>onSetActive(idx)} />
                </span>
              </span>
            ) : (<span className="cloze-text">{tok}</span>)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ====================== Diff (report) ====================== */
// tokenizeWords is imported from ./lib/format.js
function buildWordRuns(typed,target){
  const tW=tokenizeWords(typed||""); const gW=tokenizeWords(target||""); const L=Math.max(tW.length,gW.length), runs=[];
  for(let i=0;i<L;i++){ const t=tW[i]??"", g=gW[i]??"", ok=eq(t,g); runs.push({text:g, cls: ok?"diff-ok":"diff-err"}); }
  const out=[]; runs.forEach((r,i)=>{ out.push(r); if(i<runs.length-1) out.push({text:" ", cls:"diff-ok"}); }); return out;
}
function Diff({ typed, target, rtl }){ const runs=useMemo(()=>buildWordRuns(typed||"",target||""),[typed,target]);
  return (<div className="diff-box arabic" style={{direction: rtl?"rtl":"ltr"}} lang="ar">{runs.map((r,i)=>(<span key={i} className={r.cls}>{r.text}</span>))}</div>);
}

// Render text with any http(s) URLs turned into clickable links (used for Drive error hints).
function LinkifiedText({ text }){
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g);
  return <>{parts.map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a>
    : <span key={i}>{p}</span>)}</>;
}

/* ====================== Routing (task ae5a1a65) ====================== */
// URL <-> tab mapping. The app keeps its tabbed UI but each tab is addressable so the URL
// updates on navigation and the browser Back/Forward buttons work.
const TAB_TO_PATH = {
  datacenter: "/",
  search: "/search",
  hifz: "/hifz",
  train: "/practice",
  exam: "/exam",
  report: "/reports",
  settings: "/settings",
};
const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_TO_PATH).map(([t, p]) => [p, t]));
const tabToPath = (t) => TAB_TO_PATH[t] || "/";
const pathToTab = (p) => PATH_TO_TAB[p] || "datacenter";

/* ====================== Main App ====================== */
export default function App(){
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // --- Google Drive sync ---
  const accessTokenRef = useRef(null);     // Google OAuth token (kept in memory only)
  const driveFileIdRef = useRef(null);     // id of quran_backup_full.json in Drive
  const syncReadyRef = useRef(false);      // gate: auto-save only after the first load
  const lastSyncedJsonRef = useRef(null);  // last content read/written (skip no-op saves)
  const saveTimerRef = useRef(null);       // debounce handle
  const [driveStatus, setDriveStatus] = useState("off"); // off|loading|synced|saving|error
  const [driveMsg, setDriveMsg] = useState("");

  // Keep the Drive token in memory + sessionStorage so a same-tab reload reconnects automatically.
  function setDriveToken(t){
    accessTokenRef.current = t || null;
    try { if(t) sessionStorage.setItem(DRIVE_TOKEN_SS, t); else sessionStorage.removeItem(DRIVE_TOKEN_SS); } catch {}
  }

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u=>{
      setUser(u || null);
      if(!u){
        // Signed out: drop the token and stop syncing — manual uploads are allowed again.
        setDriveToken(null);
        driveFileIdRef.current = null;
        syncReadyRef.current = false;
        lastSyncedJsonRef.current = null;
        setDriveStatus("off"); setDriveMsg("");
      } else if(!accessTokenRef.current){
        // Logged in but no Drive token yet: reuse a same-tab token if present, else stay
        // disconnected and let the user opt in via the "connect Drive" button.
        let saved=null; try{ saved=sessionStorage.getItem(DRIVE_TOKEN_SS); }catch{}
        if(saved){ accessTokenRef.current = saved; connectDrive(); }
        else setDriveStatus("off");
      }
    });
    return unsub;
  }, []);

  // Complete a pending redirect sign-in (the COOP fallback in handleLogin) after returning
  // from Google. On success, onAuthStateChanged sets the user; on failure, surface the error.
  useEffect(()=>{
    getRedirectResult(auth).then(applyDriveCredential).catch(err=>{
      const m = describeAuthError(err);
      if (m) setAuthError(m);
    });
  }, []);

  function applyDriveCredential(result){ if(!result) return; try{ const cred = GoogleAuthProvider.credentialFromResult(result); if(cred && cred.accessToken){ setDriveToken(cred.accessToken); connectDrive(); } }catch{} }

  async function handleLogin(){
    setAuthError("");
    setAuthBusy(true);
    try {
      // Try a scope-free popup first (fast; no full-page navigation). Drive access is
      // requested separately via authorizeDrive().
      const result = await signInWithPopup(auth, googleProvider); applyDriveCredential(result);
      // user is set by onAuthStateChanged.
    } catch (err) {
      // When the app domain != Firebase authDomain, cross-origin COOP stops the parent from
      // reading the popup's window.closed, so the popup flow fails (popup blocked/closed/
      // cancelled/internal-error). Fall back to a full-page redirect, which survives COOP;
      // getRedirectResult() on the next load completes it.
      const code = err && err.code;
      const popupFailed =
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/internal-error";
      if (popupFailed) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return; // browser navigates to Google; this page unloads.
        } catch (err2) {
          const m2 = describeAuthError(err2);
          if (m2) setAuthError(m2);
        }
      } else {
        const m = describeAuthError(err);
        if (m) setAuthError(m);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  // Opt-in / re-auth Drive: a popup that (re)grants the Drive token, then loads/syncs.
  // `silentRetry` is set when we auto-trigger this after a 401, so messaging stays soft.
  async function authorizeDrive(){
    setDriveMsg(""); setDriveStatus("loading");
    try {
      const result = await signInWithPopup(auth, driveProvider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      setDriveToken((cred && cred.accessToken) ? cred.accessToken : null);
      if (accessTokenRef.current) await connectDrive();
      else { setDriveStatus("error"); setDriveMsg("توکن دسترسی به درایو دریافت نشد؛ دوباره تلاش کنید."); }
    } catch (err) {
      setDriveStatus("error");
      const m = describeAuthError(err);
      setDriveMsg(m || "اتصال به گوگل‌درایو ناموفق بود.");
    }
  }

  // The Drive OAuth access token is short-lived (~1h). When a request returns 401, try ONCE to
  // silently mint a fresh token in the background. Google usually returns it without a visible
  // popup because the user already consented (the popup auto-closes). Returns the new token or null.
  const driveRefreshingRef = useRef(false);
  async function refreshDriveTokenSilently(){
    if(driveRefreshingRef.current) return null;
    driveRefreshingRef.current = true;
    try {
      const result = await signInWithPopup(auth, driveRefreshProvider);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      const t = (cred && cred.accessToken) ? cred.accessToken : null;
      if(t) setDriveToken(t);
      return t;
    } catch { return null; }
    finally { driveRefreshingRef.current = false; }
  }

  const [dataset, setDataset] = useState(loadLS(LS.DATASET, []));
  // Deep-merge saved settings over defaults (preserves nested objects incl. telegram config).
  const [settings, setSettings] = useState(() => mergeSettings(loadLS(LS.SETTINGS, {})));
  const [pageStructure, setPageStructure] = useState(() => transformPageStructureIfNeeded(loadLS(LS.PAGE_STRUCTURE, QURAN_PAGE_STRUCTURE_DEFAULT)));
  const [flaggedAyahs, setFlaggedAyahs] = useState(loadLS(LS.FLAGGED_AYAHS, {}));
  useEffect(()=>saveLS(LS.FLAGGED_AYAHS, flaggedAyahs),[flaggedAyahs]);

  const [tab, setTab] = useState(() => pathToTab(location.pathname));

  // Two-way sync between the active tab and the URL (task ae5a1a65). Guards prevent an
  // update loop: a tab change pushes the matching path; a path change (e.g. the browser
  // Back button or a deep link) selects the matching tab.
  useEffect(() => {
    const want = tabToPath(tab);
    if (location.pathname !== want) navigate(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => {
    const t = pathToTab(location.pathname);
    if (t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const [sessions, setSessions] = useState(loadLS(LS.SESSIONS, []));
  useEffect(()=>saveLS(LS.SESSIONS, sessions.slice(-80)),[sessions]);
  const sessionRef = useRef(null);

  /* ===== Telegram integration (per-user, stored in Firestore — never in localStorage) ===== */
  const [telegramConfig, setTelegramConfig] = useState(DEFAULT_TELEGRAM);
  const [telegramLoaded, setTelegramLoaded] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  // Always-fresh ref so interval/event callbacks aren't stale.
  const tgRef = useRef(telegramConfig);
  tgRef.current = telegramConfig;

  // Realtime subscription to this user's config (reflects bot-side changes like /remind, and
  // other devices). On logout, reset. Nothing is kept in browser storage.
  // tgSyncedJsonRef holds the last JSON we either received or wrote, to break the
  // save<->snapshot echo loop (same pattern as the Drive sync).
  const tgSyncedJsonRef = useRef(null);
  useEffect(()=>{
    setTelegramLoaded(false); setTelegramError("");
    if(!user){ setTelegramConfig(DEFAULT_TELEGRAM); tgSyncedJsonRef.current = null; return; }
    // Safety net: if Firestore is not enabled, onSnapshot may never call back (neither success
    // nor error). After a few seconds, unblock the UI (loaded=true so inputs + save work) and
    // show the setup guide instead of a stuck "loading…".
    let settled = false;
    const watchdog = setTimeout(()=>{
      if(!settled){
        setTelegramLoaded(true);
        setTelegramError("ارتباط با پایگاه‌دادهٔ سرور (Firestore) برقرار نشد — احتمالاً هنوز فعال نشده است.");
      }
    }, 6000);
    const unsub = subscribeTelegramConfig(
      user.uid,
      (cfg)=>{ settled = true; clearTimeout(watchdog); tgSyncedJsonRef.current = JSON.stringify(cfg); setTelegramConfig(cfg); setTelegramLoaded(true); setTelegramError(""); },
      (e)=>{
        settled = true; clearTimeout(watchdog);
        // Don't wipe an already-loaded config (a transient snapshot error must NOT overwrite the
        // token via the debounced save). Show the setup guide; keep inputs usable.
        setTelegramLoaded(true);
        setTelegramError("خواندن تنظیمات تلگرام از سرور ناموفق بود: " + ((e && e.message) || "Firestore در دسترس نیست") + " (آیا Firestore فعال است؟).");
      },
    );
    return ()=>{ clearTimeout(watchdog); unsub(); };
  }, [user]);

  // Persist local edits back to Firestore (debounced). A 10s timeout guarantees the "saving"
  // state never hangs forever if Firestore is unreachable (the write would otherwise never
  // settle), and surfaces an actionable error instead.
  const tgSaveTimer = useRef(null);
  const [telegramSaving, setTelegramSaving] = useState(false);
  useEffect(()=>{
    if(!user || !telegramLoaded) return;
    const j = JSON.stringify(telegramConfig);
    if(j === tgSyncedJsonRef.current) return; // came from a snapshot or nothing changed
    clearTimeout(tgSaveTimer.current);
    setTelegramSaving(true);
    tgSaveTimer.current = setTimeout(()=>{
      const withTimeout = Promise.race([
        saveTelegramConfig(user.uid, telegramConfig),
        new Promise((_, rej)=>setTimeout(()=>rej(new Error("timeout: سرور پاسخ نداد")), 10000)),
      ]);
      withTimeout
        .then(()=>{ tgSyncedJsonRef.current = j; setTelegramError(""); }) // mark synced ONLY on success
        .catch((e)=>{
          // Surface the failure instead of silently losing the token. The local edit stays in
          // state (and the inputs) so the user can retry; tgSyncedJsonRef is NOT advanced.
          setTelegramError("ذخیرهٔ تنظیمات در سرور ناموفق بود: " + (e && e.message ? e.message : "خطای ناشناخته")
            + " — احتمالاً Firestore فعال نشده یا قوانین آن منتشر نشده‌اند.");
        })
        .finally(()=>setTelegramSaving(false));
    }, 800);
    return ()=>clearTimeout(tgSaveTimer.current);
  }, [telegramConfig, user, telegramLoaded]);

  // Mirror a compact app-state summary to Firestore so the bot can answer /status, /progress,
  // /today with real data. Debounced; only the relevant slices trigger it.
  const appStateJsonRef = useRef(null);
  const appStateTimer = useRef(null);
  useEffect(()=>{
    if(!user) return;
    const summary = buildAppStateSummary({ user, sessions, dataset, pageStructure, flaggedAyahs });
    const { updatedAt, ...stable } = summary; // ignore the timestamp when diffing
    const j = JSON.stringify(stable);
    if(j === appStateJsonRef.current) return;
    clearTimeout(appStateTimer.current);
    appStateTimer.current = setTimeout(()=>{ appStateJsonRef.current = j; saveAppState(user.uid, summary).catch(()=>{}); }, 1500);
    return ()=>clearTimeout(appStateTimer.current);
  }, [user, sessions, dataset, pageStructure, flaggedAyahs]);

  // Mirror a capped sample of ayahs so the Telegram bot can run practice/hifz/AI over real text.
  const quranSampleLenRef = useRef(-1);
  useEffect(()=>{
    if(!user || !dataset.length) return;
    if(quranSampleLenRef.current === dataset.length) return; // only when the dataset size changes
    const id = setTimeout(()=>{ quranSampleLenRef.current = dataset.length; saveQuranSample(user.uid, dataset).catch(()=>{}); }, 2500);
    return ()=>clearTimeout(id);
  }, [user, dataset]);

  // Live app-state ref so the in-app Telegram responder always sees current numbers.
  const appStateRef = useRef(null);
  appStateRef.current = buildAppStateSummary({ user, sessions, dataset, pageStructure, flaggedAyahs });

  // In-app Telegram command responder: while the app is open and Telegram is enabled, answer
  // /status, /progress, /today, /remind, /settings, /help so the bot/menu work even WITHOUT the
  // deployed server. Backs off automatically if a webhook is set (the server then owns updates).
  useEffect(()=>{
    if(!user) return;
    const stop = startTelegramResponder({
      getConfig: ()=>tgRef.current,
      getAppState: ()=>appStateRef.current,
      onAddReminder: (r)=>setTelegramConfig(c=>({ ...c, reminders: [ ...(c.reminders||[]), r ] })),
    });
    return stop;
  }, [user]);

  /* ===== AI provider/key config. Signed in -> Firestore (aiConfigs/{uid}); guest -> memory only.
     So a logged-out visitor can paste their own key and use AI without it ever being saved. ===== */
  const [aiConfig, setAiConfig] = useState(DEFAULT_AI);
  const aiConfigRef = useRef(DEFAULT_AI); aiConfigRef.current = aiConfig;
  const getAiConfig = () => aiConfigRef.current;
  const aiSyncedJsonRef = useRef(null);
  useEffect(()=>{
    if(!user){
      // Guest: never load/persist; reset to empty so a previous user's keys are not shown.
      setAiConfig(DEFAULT_AI); aiSyncedJsonRef.current = null; return;
    }
    const unsub = subscribeAiConfig(
      user.uid,
      (cfg)=>{ aiSyncedJsonRef.current = JSON.stringify(cfg); setAiConfig(cfg); },
      ()=>{ /* keep whatever is in memory; surfaced lazily if a save fails */ },
    );
    return unsub;
  }, [user]);
  // Persist AI config to Firestore ONLY when signed in (guests stay in memory).
  const aiSaveTimer = useRef(null);
  useEffect(()=>{
    if(!user) return;
    const j = JSON.stringify(aiConfig);
    if(j === aiSyncedJsonRef.current) return;
    clearTimeout(aiSaveTimer.current);
    aiSaveTimer.current = setTimeout(()=>{
      saveAiConfig(user.uid, aiConfig).then(()=>{ aiSyncedJsonRef.current = j; }).catch(()=>{});
    }, 800);
    return ()=>clearTimeout(aiSaveTimer.current);
  }, [aiConfig, user]);

  // Reminder scheduler: while the app is open, fire each due reminder once per day.
  const tgFiredRef = useRef({});
  useEffect(()=>{
    const tick = ()=>{
      const tg = tgRef.current;
      if(!tg || !tg.enabled || !tg.botToken) return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      const day = now.toISOString().slice(0,10);
      for(const r of tg.reminders || []){
        if(r.enabled === false || r.time !== hhmm) continue;
        const key = `${r.id}:${day}`;
        if(tgFiredRef.current[key]) continue;
        tgFiredRef.current[key] = true;
        tgNotify(tg, "reminder", `⏰ یادآوری: ${r.text}`).catch(()=>{});
      }
    };
    const iv = setInterval(tick, 30000);
    return ()=>clearInterval(iv);
  }, []);

  // Send a Telegram notification when a practice/exam session ends (uses the always-fresh
  // tgRef so it works from finishSessionIfAny without re-creating the callback).
  function tgNotifySessionEnd(session){
    try {
      const tg = tgRef.current;
      if(!tg || !tg.enabled || !tg.botToken) return;
      const { type, text } = buildSessionEndMessage(session);
      tgNotify(tg, type, text).catch(()=>{});
    } catch {}
  }

  // new_login notification: fire when the user transitions to signed-in (not on initial restore).
  const tgPrevUserRef = useRef(undefined);
  useEffect(()=>{
    const id = user ? (user.uid || "in") : null;
    if(tgPrevUserRef.current === null && id){
      tgNotify(tgRef.current, "new_login", `🔐 ورود جدید: ${user.displayName || user.email || "کاربر"}`).catch(()=>{});
    }
    tgPrevUserRef.current = id;
  }, [user]);

  // Forward critical app errors to Telegram (the "critical_error" type), once registered.
  useEffect(()=>{
    setCriticalEventSink((event, message)=>{
      tgNotify(tgRef.current, "critical_error", `🚨 <b>خطای بحرانی</b>\n${message}`).catch(()=>{});
    });
    return ()=>setCriticalEventSink(null);
  }, []);

  /* ---- Drive: load on connect, then keep the backup file in sync ---- */
  // While the Drive backup is active, manual uploads in the Data Center are disabled.
  const driveLocked = !!user && (driveStatus==="loading" || driveStatus==="synced" || driveStatus==="saving");

  // Daily-goal progress (graded items today) + streak, for the Settings "goal" card.
  const streakInfo = useMemo(()=>computeStreak(sessions, Date.now()), [sessions]);
  const goalToday = useMemo(()=>{
    const t0 = new Date(); t0.setHours(0,0,0,0); const from = t0.getTime();
    let n = 0;
    for(const s of sessions){ if(sessionTime(s) >= from) n += sessionCorrect(s) + sessionWrong(s); }
    return n;
  }, [sessions]);

  // Exam history (sessions whose mode contains "exam") + summary stats for the Exam tab.
  const examSessions = useMemo(()=> sessions.filter(isExamSession).slice().reverse(), [sessions]);
  const examStats = useMemo(()=>{
    let best=0, sum=0, n=0, passed=0;
    const pass = settings.examPassPct||80;
    for(const s of examSessions){
      const g = sessionCorrect(s)+sessionWrong(s); if(!g) continue;
      const pct = Math.round(sessionCorrect(s)/g*100);
      best=Math.max(best,pct); sum+=pct; n++; if(pct>=pass) passed++;
    }
    return { count: examSessions.length, best, avg: n?Math.round(sum/n):0, passed, graded:n };
  }, [examSessions, settings.examPassPct]);

  // Core load-or-create + first sync against Drive using a given token. Throws on failure
  // (incl. 401), so the caller can refresh-and-retry.
  async function doDriveSync(token){
    const file = await driveFindFile(token, DRIVE_FILE_NAME);
    if(file){
      driveFileIdRef.current = file.id;
      const remote = await driveDownload(token, file.id);
      const remoteHasData =
        (remote && Array.isArray(remote.dataset) && remote.dataset.length>0) ||
        (Array.isArray(remote) && remote.length>0);
      if(remoteHasData){
        // Drive is the master copy on login — load it over local data.
        const ds = Array.isArray(remote) ? remote : remote.dataset;
        const normalized = {
          dataset: ds,
          sessions: Array.isArray(remote.sessions) ? remote.sessions : sessions,
          pageStructure: Array.isArray(remote.pageStructure) ? transformPageStructureIfNeeded(remote.pageStructure) : pageStructure,
          flaggedAyahs: (remote.flaggedAyahs && typeof remote.flaggedAyahs==="object") ? remote.flaggedAyahs : flaggedAyahs,
          settings: mergeSettings(remote.settings),
        };
        setDataset(normalized.dataset);
        setSessions(normalized.sessions);
        setPageStructure(normalized.pageStructure);
        setFlaggedAyahs(normalized.flaggedAyahs);
        setSettings(normalized.settings);
        lastSyncedJsonRef.current = serializeSync(normalized);
      } else {
        // The backup is empty/blank: keep local data and push it up to fill the file.
        const local = { dataset, sessions, pageStructure, flaggedAyahs, settings };
        await driveUpdate(token, file.id, { ...buildSyncPayload(local), _app:"quran-web-app", _savedAt:new Date().toISOString() });
        lastSyncedJsonRef.current = serializeSync(local);
      }
    } else {
      // No backup yet: create quran_backup_full.json from current local data.
      const local = { dataset, sessions, pageStructure, flaggedAyahs, settings };
      const created = await driveCreate(token, DRIVE_FILE_NAME, { ...buildSyncPayload(local), _app:"quran-web-app", _savedAt:new Date().toISOString() });
      driveFileIdRef.current = created.id;
      lastSyncedJsonRef.current = serializeSync(local);
    }
    syncReadyRef.current = true;
    setDriveStatus("synced");
  }

  async function connectDrive(){
    const token = accessTokenRef.current;
    if(!token){ setDriveStatus("off"); return; }
    setDriveStatus("loading"); setDriveMsg("");
    try {
      await doDriveSync(token);
    } catch(e){
      if(e && e.status===401){
        // Token expired (~1h). Try ONCE to silently refresh and retry before bothering the user.
        const fresh = await refreshDriveTokenSilently();
        if(fresh){
          try { setDriveStatus("loading"); setDriveMsg(""); await doDriveSync(fresh); return; }
          catch(e2){ /* fall through to the messaging below using e2 */ e = e2; }
        }
        if(e && e.status===401){
          setDriveStatus("reconnect");
          setDriveMsg("نشست گوگل‌درایو منقضی شد؛ روی «اتصال به گوگل‌درایو» بزنید تا ادامه یابد.");
          return;
        }
      }
      if(e && e.status===403){
        setDriveStatus("error");
        setDriveMsg(
          "دسترسی به Drive رد شد (۴۰۳): " + (e && e.message ? e.message : "") +
          " — معمولاً یعنی «Google Drive API» در پروژه فعال نیست. از این لینک فعالش کنید: " +
          "https://console.cloud.google.com/apis/library/drive.googleapis.com?project=quran-app-7566b"
        );
      } else if(e && e.status!==401){
        setDriveStatus("error");
        setDriveMsg("اتصال به گوگل‌درایو ناموفق بود" + (e && e.message ? `: ${e.message}` : "") + ".");
      }
    }
  }

  // Debounced auto-save: any change to the synced slice is written back to the Drive file.
  useEffect(()=>{
    if(!syncReadyRef.current || !accessTokenRef.current || !driveFileIdRef.current) return;
    const cur = serializeSync({ dataset, sessions, pageStructure, flaggedAyahs, settings });
    if(cur === lastSyncedJsonRef.current) return; // nothing meaningful changed (incl. the post-load echo)
    setDriveStatus("saving");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async ()=>{
      const writeOnce = (tok)=> driveUpdate(tok, driveFileIdRef.current, { ...JSON.parse(cur), _app:"quran-web-app", _savedAt:new Date().toISOString() });
      try {
        await writeOnce(accessTokenRef.current);
        lastSyncedJsonRef.current = cur;
        setDriveStatus("synced");
      } catch(e){
        if(e && e.status===401){
          // Expired token: silently refresh once and retry the save before alarming the user.
          const fresh = await refreshDriveTokenSilently();
          if(fresh){
            try { await writeOnce(fresh); lastSyncedJsonRef.current = cur; setDriveStatus("synced"); return; }
            catch { /* fall through */ }
          }
          // Could not refresh without interaction: mark for reconnect (data is safe locally).
          setDriveStatus("reconnect");
          setDriveMsg("نشست گوگل‌درایو منقضی شد؛ برای ادامهٔ سینک روی «اتصال به گوگل‌درایو» بزنید (تغییرات محلی حفظ شده‌اند).");
        } else {
          setDriveStatus("error");
          setDriveMsg("ذخیره در گوگل‌درایو ناموفق بود؛ تغییرات محلی حفظ شده‌اند.");
        }
      }
    }, 2000);
    return ()=>clearTimeout(saveTimerRef.current);
  }, [dataset, sessions, pageStructure, flaggedAyahs, settings]);

  const [reciter, setReciter] = useState(loadLS(LS.RECITER, settings.reciter || "parhizgar"));
  const audioRef = useRef(null); const [isPlaying, setIsPlaying] = useState(false);
  const [playingKey, setPlayingKey] = useState(null);
  const userRequestedAudioRef = useRef(false);
  const shuttingAudioRef = useRef(false);

  // --- Voice Recognition State ---
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [speechApiSupported, setSpeechApiSupported] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const [activeBlank, setActiveBlank] = useState(null);
  const advanceTimeoutRef = useRef(null);

  const handleAllChangeRef = useRef();

  // --- Hifz Tab State ---
  const [hifzPage, setHifzPage] = useState(1);
  const [allPagesAnswers, setAllPagesAnswers] = useState({}); // To persist hifz answers

  // --- Report Details State ---
  const [detailedReport, setDetailedReport] = useState({ visible: false, items: [], title: "" });


  /* Load XLSX + Speech */
  useEffect(() => {
    if (document.getElementById('xlsx-script')==null) {
      const script = document.createElement('script');
      script.id = 'xlsx-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.async = true;
      // Handle CDN load failures so the user gets a clear error instead of a forever
      // "still loading" message when XLSX cannot be fetched (offline / CDN blocked).
      script.onload = () => { setXlsxLoadFailed(false); };
      script.onerror = () => { setXlsxLoadFailed(true); console.error('XLSX: failed to load from CDN'); };
      document.head.appendChild(script);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechApiSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ar-SA';

      recognition.onstart = () => { setRecognitionError(""); setIsRecording(true); };
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (event) => {
        if (event.error === 'no-speech') setRecognitionError("صدایی تشخیص داده نشد.");
        else if (event.error === 'audio-capture') setRecognitionError("دسترسی به میکروفون ممکن نیست.");
        else if (event.error === 'not-allowed') setRecognitionError("اجازهٔ میکروفون داده نشده است.");
        else setRecognitionError("خطای ضبط صدا.");
        setIsRecording(false);
      };
      recognition.onresult = (event) => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final_transcript += event.results[i][0].transcript;
        }
        if (final_transcript && handleAllChangeRef.current) {
            handleAllChangeRef.current(final_transcript.trim(), 'voice');
        }
      };
      recognitionRef.current = recognition;
    } else {
      setSpeechApiSupported(false);
    }

    return ()=>{ clearTimeout(advanceTimeoutRef.current); };
  }, []);


  useEffect(()=>saveLS(LS.DATASET,dataset),[dataset]);
  useEffect(()=>saveLS(LS.SETTINGS,settings),[settings]);
  useEffect(()=>saveLS(LS.PAGE_STRUCTURE,pageStructure),[pageStructure]);
  useEffect(()=>saveLS(LS.RECITER,reciter),[reciter]);

  /* ---- Derived + Search index ---- */
  const indexed = useMemo(()=> (dataset||[]).map(a=>{
    const plain = joinTokens(a.tokens_plain||[]), diac = joinTokens(a.tokens_with_diacritics||[]);
    return {...a, _norm: normAR(plain+" "+diac)};
  }),[dataset]);
  const surahOptions=useMemo(()=>{ const m=new Map(); for(const a of dataset) m.set(a.surah_number, a.surah_name||`سوره ${a.surah_number}`); return [...m.entries()].sort((x,y)=>x[0]-y[0]); },[dataset]);
  const surahMap = useMemo(() => new Map(surahOptions), [surahOptions]);
  const ayahListBySurah = useMemo(()=>{ const m=new Map(); for(const a of dataset){ if(!m.has(a.surah_number)) m.set(a.surah_number,new Set()); m.get(a.surah_number).add(a.ayah_number);} const out=new Map(); for(const [s,set] of m) out.set(s,[...set].sort((x,y)=>x-y)); return out; },[dataset]);

  const hifzPages = useMemo(() => {
    const populatedPages = new Map();
    const datasetMap = new Map((dataset || []).map(a => [`${a.surah_number}:${a.ayah_number}`, a]));
    const ayahsInStructure = new Set();

    for (const pageInfo of (pageStructure || [])) {
        if (!pageInfo || !Array.isArray(pageInfo.surahs)) {
            console.warn("Skipping malformed page structure entry:", pageInfo);
            continue;
        }
        const pageNum = pageInfo.page;
        if (!populatedPages.has(pageNum)) {
            populatedPages.set(pageNum, []);
        }
        
        for (const surahInfo of pageInfo.surahs) {
            if (!surahInfo || !Array.isArray(surahInfo.ayahs)) {
                console.warn("Skipping malformed surah info entry on page " + pageNum + ":", surahInfo);
                continue;
            }
            const ayahsOnPage = surahInfo.ayahs.map(ayahNum => {
                const key = `${surahInfo.surah}:${ayahNum}`;
                ayahsInStructure.add(key);
                const ayahData = datasetMap.get(key);
                if (ayahData) {
                    return { ...ayahData, surah_name: ayahData.surah_name || surahInfo.surah_name };
                }
                return { 
                    surah_number: surahInfo.surah, 
                    ayah_number: ayahNum, 
                    surah_name: surahInfo.surah_name, 
                    page: pageNum, 
                    tokens_with_diacritics: [], 
                    tokens_plain: [] 
                };
            });
            populatedPages.get(pageNum).push(...ayahsOnPage);
        }
    }

    if (dataset) {
        for (const ayah of dataset) {
            const key = `${ayah.surah_number}:${ayah.ayah_number}`;
            if (ayah.page && !ayahsInStructure.has(key)) {
                if (!populatedPages.has(ayah.page)) {
                    populatedPages.set(ayah.page, []);
                }
                populatedPages.get(ayah.page).push(ayah);
            }
        }
    }

    for (let i = 1; i <= 604; i++) {
        if (!populatedPages.has(i)) {
            populatedPages.set(i, []);
        } else {
            populatedPages.get(i).sort((a, b) => a.surah_number - b.surah_number || a.ayah_number - b.ayah_number);
        }
    }
    return populatedPages;
  }, [dataset, pageStructure]);

  /* ====================== Data Center ====================== */
  const refs={ jsonData:useRef(null), xlsWith:useRef(null), xlsWithout:useRef(null), xlsList:useRef(null), pageStructure:useRef(null) };
  function loadConsolidatedJSON(file){
    if(driveLocked) return; // synced from Drive while logged in
    const fr=new FileReader();
    fr.onload=()=>{
      try{
        const data=JSON.parse(String(fr.result));
        if (typeof data === 'object' && data !== null) {
          if (Array.isArray(data.dataset)) setDataset(data.dataset);
          if (Array.isArray(data.sessions)) setSessions(data.sessions);
          if (Array.isArray(data.pageStructure)) {
            // ** FIX: Transform the structure before setting state **
            const transformed = transformPageStructureIfNeeded(data.pageStructure);
            setPageStructure(transformed);
          }
          alert("پشتیبان با موفقیت بارگذاری شد.");
          setTab("search");
        } else if (Array.isArray(data)) {
          setDataset(data);
          setSessions([]);
          setPageStructure(QURAN_PAGE_STRUCTURE_DEFAULT);
          alert("دیتاست با فرمت قدیمی بارگذاری شد. سوابق و ساختار صفحه بازنشانی شد.");
        } else {
          alert("ساختار فایل JSON صحیح نیست.");
        }
      } catch {
        alert("خواندن فایل JSON ناموفق بود.");
      }
    };
    fr.readAsText(file,"utf-8");
  }

  function handlePageStructureUpload(file) {
    if(driveLocked) return; // synced from Drive while logged in
    const fr = new FileReader();
    fr.onload = () => {
        try {
            const data = JSON.parse(String(fr.result));
            if (Array.isArray(data)) {
                // ** FIX: Transform the structure before merging and setting state **
                const transformedData = transformPageStructureIfNeeded(data);
                const newStructureMap = new Map(transformedData.map(p => [p.page, p]));
                const currentStructure = transformPageStructureIfNeeded(pageStructure); // Ensure current is also correct format
                const merged = [...currentStructure.filter(p => !newStructureMap.has(p.page)), ...transformedData];
                merged.sort((a, b) => a.page - b.page);
                setPageStructure(merged);
                alert(`ساختار صفحه با موفقیت به‌روزرسانی شد. ${transformedData.length} صفحه جدید اضافه یا جایگزین شد.`);
            } else {
                alert("ساختار فایل JSON برای چیدمان صفحات صحیح نیست. باید آرایه‌ای از صفحات باشد.");
            }
        } catch {
            alert("خواندن فایل JSON چیدمان صفحات ناموفق بود.");
        }
    };
    fr.readAsText(file, "utf-8");
  }

  function exportDataset(){
    const fullData = { dataset, sessions, pageStructure, flaggedAyahs };
    const blob=new Blob([JSON.stringify(fullData,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="quran_backup_full.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function runMerge(){ if(driveLocked) return; const withFile=refs.xlsWith.current?.files?.[0]||null; const withoutFile=refs.xlsWithout.current?.files?.[0]||null; const listFile=refs.xlsList.current?.files?.[0]||null;
    if(!withFile && !withoutFile && !listFile){ alert("ابتدا حداقل یک فایل بارگذاری کنید."); return; }
    let withDia=[], withoutDia=[], surahList=[]; if(withFile){ const { withDia:w }=parseExcelFile(await withFile.arrayBuffer(),{mode:"with"}); withDia=w||[]; }
    if(withoutFile){ const { withoutDia:wo }=parseExcelFile(await withoutFile.arrayBuffer(),{mode:"without"}); withoutDia=wo||[]; }
    if(listFile){ const { surahList:L }=parseExcelFile(await listFile.arrayBuffer(),{mode:"surah"}); surahList=L||[]; }
    const { merged }=mergeData({withDia, withoutDia, surahList}); setDataset(merged); setTab("search"); }

  /* ====================== Search (pagination) ====================== */
  const [q,setQ]=useState(""); const [surahFilter,setSurahFilter]=useState("");
  const [searchPage, setSearchPage] = useState(1);
  const pageSize = 40;
  const filteredAyat=useMemo(()=>{
    const sNum=Number(surahFilter)||null; const nq=normAR(q);
    let arr=indexed; if(sNum) arr=arr.filter(a=>a.surah_number===sNum);
    if(nq) arr=arr.filter(a=> a._norm.includes(nq));
    return arr;
  },[indexed,q,surahFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredAyat.length / pageSize));
  const pagedAyat = useMemo(()=>{
    const start=(searchPage-1)*pageSize;
    return filteredAyat.slice(start, start+pageSize);
  },[filteredAyat,searchPage]);

  useEffect(()=>{ setSearchPage(1); },[q,surahFilter]);

  /* ====================== Train & Exam State ====================== */
  const [deckSize, setDeckSize] = useState(settings.deckSize);
  const [practiceMode, setPracticeMode] = useState(loadLS(LS.PRACTICE_MODE,"without"));
  const [clozePattern, setClozePattern] = useState(loadLS(LS.PRACTICE_CLOZE,"all"));
  const [randomCount, setRandomCount] = useState(loadLS(LS.PRACTICE_RANDOM,2));
  const [colorInside, setColorInside] = useState(loadLS(LS.PRACTICE_COLOR_INSIDE,true));
  const [showRef, setShowRef] = useState(loadLS(LS.SHOW_REF,false));
  const [showMcqRef, setShowMcqRef] = useState(loadLS(LS.SHOW_MCQ_REF, true));
  const [autoAdvance, setAutoAdvance] = useState(loadLS(LS.AUTO_ADV,true));
  const [mcqDelay, setMcqDelay] = useState(loadLS(LS.MCQ_DELAY, settings.mcqDelay));
  const [practiceRangeType, setPracticeRangeType] = useState(loadLS(LS.PRACTICE_RANGE_TYPE, "surah"));
  const [pStartS, setPStartS] = useState(loadLS(LS.PRACTICE_RANGE_START_S, ""));
  const [pStartA, setPStartA] = useState(loadLS(LS.PRACTICE_RANGE_START_A, ""));
  const [pEndS, setPEndS]     = useState(loadLS(LS.PRACTICE_RANGE_END_S, ""));
  const [pEndA, setPEndA]     = useState(loadLS(LS.PRACTICE_RANGE_END_A, ""));
  const [pJuz, setPJuz] = useState(loadLS(LS.PRACTICE_RANGE_JUZ, "1"));
  const [pPageStart, setPPageStart] = useState(loadLS(LS.PRACTICE_RANGE_PAGE_START, "1"));
  const [pPageEnd, setPPageEnd] = useState(loadLS(LS.PRACTICE_RANGE_PAGE_END, "1"));
  const [practiceOrder, setPracticeOrder] = useState(loadLS(LS.PRACTICE_ORDER,"sequential"));
  const [practiceWrongMode, setPracticeWrongMode] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [flaggedSortOrder, setFlaggedSortOrder] = useState('surah');
  const [flaggedSurahFilter, setFlaggedSurahFilter] = useState('');
  const [flaggedCorrectnessFilter, setFlaggedCorrectnessFilter] = useState('all');

  const [examType, setExamType] = useState(null);
  const [mcqFeedback, setMcqFeedback] = useState(null);
  const [mcqQuestionType, setMcqQuestionType] = useState('surah_name');

  const [mistakeSort, setMistakeSort] = useState('count_desc');
  const [mistakeSurahFilter, setMistakeSurahFilter] = useState('');
  const [mistakeExamType, setMistakeExamType] = useState('typing');
  const [mistakesPage, setMistakesPage] = useState(1);

  const [deck, setDeck] = useState([]);
  const [pos,setPos]=useState(0);
  const [answer,setAnswer]=useState("");
  const [answersMap,setAnswersMap]=useState({});

  const latestAnswer = useRef(answer);
  useEffect(() => { latestAnswer.current = answer; }, [answer]);
  const latestAnswersMap = useRef(answersMap);
  useEffect(() => { latestAnswersMap.current = answersMap; }, [answersMap]);
  const blankRefs = useRef({});
  const allAyahRef = useRef(null);
  const hintRef = useRef(()=>{});
  const card = deck[pos];
  const sortedBlanks = useMemo(() => [...(card?.blanks || [])].sort((a, b) => a - b), [card?.blanks]);

  useEffect(()=>saveLS(LS.PRACTICE_MODE,practiceMode),[practiceMode]);
  useEffect(()=>saveLS(LS.PRACTICE_CLOZE,clozePattern),[clozePattern]);
  useEffect(()=>saveLS(LS.PRACTICE_RANDOM,randomCount),[randomCount]);
  useEffect(()=>saveLS(LS.PRACTICE_COLOR_INSIDE,colorInside),[colorInside]);
  useEffect(()=>saveLS(LS.SHOW_REF,showRef),[showRef]);
  useEffect(()=>saveLS(LS.SHOW_MCQ_REF,showMcqRef),[showMcqRef]);
  useEffect(()=>saveLS(LS.AUTO_ADV,autoAdvance),[autoAdvance]);
  useEffect(()=>saveLS(LS.MCQ_DELAY, mcqDelay), [mcqDelay]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_TYPE, practiceRangeType), [practiceRangeType]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_START_S,pStartS),[pStartS]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_START_A,pStartA),[pStartA]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_END_S,pEndS),[pEndS]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_END_A,pEndA),[pEndA]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_JUZ, pJuz), [pJuz]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_PAGE_START, pPageStart), [pPageStart]);
  useEffect(()=>saveLS(LS.PRACTICE_RANGE_PAGE_END, pPageEnd), [pPageEnd]);
  useEffect(()=>saveLS(LS.PRACTICE_ORDER,practiceOrder),[practiceOrder]);
  useEffect(()=>setDeckSize(settings.deckSize),[settings.deckSize]);

  useEffect(() => {
    if (clozePattern === 'mcq' && mcqQuestionType === 'surah_name') {
      setPracticeOrder('random');
    }
  }, [clozePattern, mcqQuestionType]);

  const detailedMistakesMap = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
        for (const w of (s.wrongItems || [])) {
            const key = `${w.surah}:${w.ayah}`;
            if (!map.has(key)) {
                map.set(key, { key, s: w.surah, a: w.ayah, count: 0, latestTimestamp: 0 });
            }
            const entry = map.get(key);
            entry.count++;
            if (w.when > entry.latestTimestamp) {
                entry.latestTimestamp = w.when;
            }
        }
    }
    return map;
  }, [sessions]);
  const detailedMistakes = useMemo(() => [...detailedMistakesMap.values()], [detailedMistakesMap]);

  const practiceAyat = useMemo(()=>{
    if(!dataset?.length) return [];

    if (practiceRangeType === 'flagged') {
        let flagged = dataset.filter(a => flaggedAyahs[`${a.surah_number}:${a.ayah_number}`]);
        if (flaggedSurahFilter) {
            flagged = flagged.filter(a => a.surah_number === Number(flaggedSurahFilter));
        }
        if (flaggedCorrectnessFilter === 'only_mistakes') {
            flagged = flagged.filter(a => detailedMistakesMap.has(slugAyah(a)));
        } else if (flaggedCorrectnessFilter === 'no_mistakes') {
            flagged = flagged.filter(a => !detailedMistakesMap.has(slugAyah(a)));
        }
        if (flaggedSortOrder === 'surah') {
            flagged.sort((x,y)=> x.surah_number - y.surah_number || x.ayah_number - y.ayah_number);
        } else if (flaggedSortOrder === 'random') {
            flagged = shuffle(flagged);
        }
        return flagged;
    }

    if (practiceRangeType === 'page') {
        const start = Math.min(Number(pPageStart) || 1, Number(pPageEnd) || 1);
        const end = Math.max(Number(pPageStart) || 1, Number(pPageEnd) || 1);
        let ayahs = [];
        for (let i = start; i <= end; i++) {
            if (hifzPages.has(i)) {
                ayahs.push(...hifzPages.get(i));
            }
        }
        return ayahs.sort((x,y)=> x.surah_number - y.surah_number || x.ayah_number - y.ayah_number);
    }

    const key=(s,a)=> (Number(s)||0)*1000 + (Number(a)||0);
    let startKey = -Infinity, endKey = Infinity;

    if (practiceRangeType === 'surah') {
        startKey = pStartS ? key(pStartS, pStartA || 1) : -Infinity;
        endKey   = pEndS   ? key(pEndS,   pEndA   || 999) : Infinity;
        if(pStartS && pEndS && Number(pEndS) < Number(pStartS)) [startKey,endKey]=[endKey,startKey];
    }

    return dataset.filter(a=>{ const k=a.surah_number*1000 + a.ayah_number; return k>=startKey && k<=endKey; })
            .sort((x,y)=> x.surah_number-y.surah_number || x.ayah_number-y.ayah_number);
  },[dataset, practiceRangeType, pStartS, pStartA, pEndS, pEndA, pJuz, pPageStart, pPageEnd, flaggedAyahs, flaggedSortOrder, flaggedSurahFilter, flaggedCorrectnessFilter, detailedMistakesMap, hifzPages]);

  const proposalDeck = useMemo(()=>{
    const base = practiceOrder==="random" ? shuffle(practiceAyat) : practiceAyat;
    const cards = base.map(a=>{
      const D=a.tokens_with_diacritics||[], P=a.tokens_plain||[];
      const display = practiceMode==="with" ? P : D;
      const expect  = practiceMode==="with" ? D : P;
      let blanks=[];
      if(clozePattern==="all") blanks=[...expect.keys()];
      else if(clozePattern==="first") blanks = expect.length ? [0] : [];
      else if(clozePattern==="last")  blanks = expect.length ? [expect.length-1] : [];
      else if (clozePattern !== 'mcq') {
        const idx=[...expect.keys()].filter(i=>i>0 && i<expect.length-1);
        idx.sort(()=>Math.random()-0.5);
        blanks=idx.slice(0, Math.max(1, Math.min(randomCount||2, idx.length)));
      }
      return { key:`${a.surah_number}:${a.ayah_number}`, surah:a.surah_number, name:a.surah_name, ayah:a.ayah_number, display, expect, blanks };
    });
    return cards.slice(0, Math.min(cards.length, Math.max(1, settings.deckSize)));
  },[practiceAyat,practiceMode,clozePattern,randomCount,practiceOrder,settings.deckSize]);

  const [repeatQueue, setRepeatQueue] = useState([]);
  const [usedAutoFill, setUsedAutoFill] = useState(false);

  function buildDeckFromRange(){
    if (clozePattern === 'mcq') {
        const newDeck = generateMcqDeckForTraining(proposalDeck.map(c => dataset.find(a => `${a.surah_number}:${a.ayah_number}` === c.key)), mcqQuestionType, dataset, surahMap);
        if (!newDeck.length) { alert("آیات کافی برای ساخت آزمون تستی در این بازه یافت نشد."); return; }
        setDeck(newDeck);
        setExamType('mcq_train');
        sessionRef.current = { id: Date.now(), start: Date.now(), end: null, mode: "mcq_train", size: newDeck.length, keys: newDeck.map(c => c.key), wrongItems: [], correctItems: [], questionType: mcqQuestionType };
    } else {
        if(!proposalDeck.length){ alert("در این بازه کارتی یافت نشد."); return; }
        setDeck(proposalDeck);
        setExamType('typing');
        sessionRef.current = {
          id: Date.now(), start: Date.now(), end: null,
          range: { pStartS, pStartA, pEndS, pEndA },
          mode: practiceMode, cloze: clozePattern, order: practiceOrder, size: proposalDeck.length,
          keys: proposalDeck.map(c=>c.key), wrongItems: [], correctItems: []
        };
    }
    setPracticeWrongMode(false); setExamMode(false);
    setRepeatQueue([]); setPos(0); setAnswer(""); setAnswersMap({}); setUsedAutoFill(false);
  }

  useEffect(()=>{
      setShowRef(false);
      clearTimeout(advanceTimeoutRef.current);
  },[card?.key,clozePattern,practiceMode]);

  function stopAudio(stopCompletely = true){
    const a = audioRef.current;
    if (stopCompletely) {
        userRequestedAudioRef.current = false;
        shuttingAudioRef.current = true;
    }
    try{ if(a){ a.pause(); a.src=""; } }catch{}
    if (stopCompletely) {
        audioRef.current=null;
        setIsPlaying(false);
        setPlayingKey(null);
        setTimeout(()=>{ shuttingAudioRef.current=false; },0);
    }
  }

  function playAyah(surah, ayah, onEndedCallback = null){
    const key = `${surah}:${ayah}`;
    if(!navigator.onLine){ if (userRequestedAudioRef.current) alert("اتصال اینترنت برقرار نیست."); return; }
    stopAudio();
    let tryIdx=0;
    const tryPlay = ()=>{
      const url = buildAyahUrl(reciter, surah, ayah, tryIdx);
      if(!url){ if (userRequestedAudioRef.current) alert("پخش برای قاری انتخاب‌شده در دسترس نیست."); userRequestedAudioRef.current = false; return; }
      const a = new Audio(url); a.crossOrigin="anonymous";
      a.addEventListener("canplay", ()=>{ a.play().catch(()=>{}); setIsPlaying(true); setPlayingKey(key); });
      a.addEventListener("ended", ()=>{
          setIsPlaying(false);
          setPlayingKey(null);
          if (userRequestedAudioRef.current) {
            userRequestedAudioRef.current = false;
          }
          if(onEndedCallback) onEndedCallback();
      });
      a.addEventListener("error", ()=>{ if (shuttingAudioRef.current) return; tryIdx++; if(tryIdx<5) tryPlay(); else { setIsPlaying(false); setPlayingKey(null); if (userRequestedAudioRef.current) alert("پخش آیه ناموفق بود."); userRequestedAudioRef.current = false; }});
      audioRef.current=a; a.play().catch(()=>{});
    };
    tryPlay();
  }

  useEffect(()=>{ try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src=""; } } catch {}
    setIsPlaying(false);
    setPlayingKey(null);
    const t=setTimeout(()=>{ if(!card || examType === 'mcq_train') return;
      if(clozePattern==="all"){ if(allAyahRef.current){ const el=allAyahRef.current; el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
      else { const fb = sortedBlanks[0]; const el = fb!=null ? blankRefs.current[fb] : null; el?.focus(); }
    },0); return ()=>clearTimeout(t);
  },[card?.key, clozePattern, sortedBlanks, examType]);

  const recordWrong = (e)=>{ const s=sessionRef.current; if(!s) return; if(!s.wrongItems) s.wrongItems = []; s.wrongItems.push({ ...e, when:Date.now() }); };
  const recordCorrect = (e)=>{ const s=sessionRef.current; if(!s) return; if(!s.correctItems) s.correctItems = []; s.correctItems.push({ ...e, when:Date.now() }); };

  function finishSessionIfAny(isNaturalCompletion = false){
    const s=sessionRef.current; if(!s) return;
    s.end = Date.now();
    s.completedCount = isNaturalCompletion ? (s.keys?.length || 0) : pos;
    setSessions(arr=>[...arr, s]); sessionRef.current=null;
    tgNotifySessionEnd(s); // Telegram: notify session-complete / exam-result (if enabled)
    setDeck([]); setPos(0); setAnswer(""); setAnswersMap({}); setUsedAutoFill(false);
    setPracticeWrongMode(false); setExamMode(false); setExamType(null);
  }

  function afterSubmitMove(correct){
    if (practiceWrongMode) {
        if (pos === deck.length - 1) {
            finishSessionIfAny(true);
        } else {
            setPos(pos + 1);
            setAnswer(""); setAnswersMap({}); setUsedAutoFill(false);
        }
        return;
    }
    let nextPos = pos + 1; let newDeck = deck; let newRepeat = repeatQueue;
    if(!correct && card) newRepeat = [...repeatQueue, card];
    const atEnd = pos === deck.length - 1;
    if (atEnd && newRepeat.length){ newDeck = [...deck, ...newRepeat]; newRepeat = []; }
    if (atEnd && !newRepeat.length){ finishSessionIfAny(true); return; }
    setRepeatQueue(newRepeat); setDeck(newDeck); setPos(Math.min(nextPos, newDeck.length - 1)); setAnswer(""); setAnswersMap({}); setUsedAutoFill(false);
  }

  function recordSkipForCurrent(){
    if(!card) return;
    if(clozePattern==="all"){
      recordWrong({ key:`${card.key}:skip`, scope:"ayah", typed:answer, target:joinTokens(card.expect), surah:card.surah, ayah:card.ayah, skip:true });
    }else{
      for(const i of card.blanks){
        recordWrong({ key:`${card.key}:${i}:skip`, scope:"token", typed:answersMap[i]||"", target:card.expect[i]||"", surah:card.surah, ayah:card.ayah, skip:true });
      }
    }
  }

  const submitCurrent = () => {
    if (!card || examType === 'mcq_train') return;
    const currentAnswer = latestAnswer.current;
    const currentAnswersMap = latestAnswersMap.current;
    let correct = false;

    if (clozePattern === "all") {
      const target = joinTokens(card.expect);
      correct = eq(currentAnswer, target);

      if (usedAutoFill) {
        recordWrong({ key: `${card.key}:ayah:auto`, scope: "ayah", typed: currentAnswer, target, surah: card.surah, ayah: card.ayah, auto: true });
        correct = false;
      } else if (!correct) {
        recordWrong({ key: `${card.key}:ayah`, scope: "ayah", typed: currentAnswer, target, surah: card.surah, ayah: card.ayah });
      } else {
        recordCorrect({ key: card.key, scope: "ayah", typed: currentAnswer, target, surah: card.surah, ayah: card.ayah });
      }
    } else {
      const allOK = card.blanks.every(i => eq(currentAnswersMap[i] || "", card.expect[i] || ""));
      correct = allOK;

      if (usedAutoFill) {
        for (const i of card.blanks) {
          recordWrong({ key: `${card.key}:${i}:auto`, scope: "token", typed: currentAnswersMap[i] ?? "", target: card.expect[i] ?? "", surah: card.surah, ayah: card.ayah, auto: true });
        }
        correct = false;
      } else {
        let sessionCorrect = true;
        for (const i of card.blanks) {
          const typed = currentAnswersMap[i] ?? "";
          const target = card.expect[i] ?? "";
          if (!eq(typed, target)) {
            recordWrong({ key: `${card.key}:${i}`, scope: "token", typed, target, surah: card.surah, ayah: card.ayah });
            sessionCorrect = false;
          }
        }
        if(sessionCorrect) recordCorrect({ key: card.key, scope: "cloze", surah: card.surah, ayah: card.ayah });
      }
    }

    if (correct || settings.trainAdvanceOnWrong) {
        afterSubmitMove(correct);
    }
  };

  const handleAllChange = (v, method = 'keyboard') => {
    if (!card) return;
    clearTimeout(advanceTimeoutRef.current);
    if (method === 'keyboard') setUsedAutoFill(false);

    const targetText = joinTokens(card.expect);
    let newAnswer = v;

    // Auto-spacing feature
    if (method === 'keyboard') {
      const wordsTyped = newAnswer.split(' ');
      const wordsTarget = targetText.split(' ');
      if (wordsTyped.length < wordsTarget.length) {
        const lastTypedWord = wordsTyped[wordsTyped.length - 1];
        const correspondingTargetWord = wordsTarget[wordsTyped.length - 1];
        if (eq(lastTypedWord, correspondingTargetWord) && !newAnswer.endsWith(' ')) {
          newAnswer += ' ';
        }
      }
    }

    // Auto-fill feature for manual typing
    if (settings.enableAutoFill && method === 'keyboard' && !usedAutoFill && newAnswer.length > 0) {
        const correctGraphemes = segGraphemes(newAnswer).filter((g, i) => i < segGraphemes(targetText).length && eq(g, segGraphemes(targetText)[i])).length;
        const percentage = (correctGraphemes / segGraphemes(targetText).length) * 100;

        if (percentage >= settings.autoFillPercentage) {
            setAnswer(targetText);
            setUsedAutoFill(true);
            advanceTimeoutRef.current = setTimeout(submitCurrent, 250);
            return;
        }
    }

    // Check for completion to auto-advance
    let isSufficientlyCorrect = false;
    if (method === 'voice') {
        const similarity = getSimilarity(newAnswer, targetText);
        isSufficientlyCorrect = similarity >= settings.recognitionSensitivity;
    } else { // method === 'keyboard'
        isSufficientlyCorrect = eq(newAnswer, targetText);
    }

    if (autoAdvance && isSufficientlyCorrect) {
      // For voice input, normalize to the exact target text before submitting
      setAnswer(targetText);
      const delay = method === 'voice' ? settings.voiceAutoAdvanceDelay : 250;
      advanceTimeoutRef.current = setTimeout(submitCurrent, delay);
    } else {
      setAnswer(newAnswer);
    }
  };
  useLayoutEffect(() => { handleAllChangeRef.current = handleAllChange; });

  function handleBlankChange(i, v, method = 'keyboard'){
    if (!card) return;
    clearTimeout(advanceTimeoutRef.current);
    if (method === 'keyboard') setUsedAutoFill(false);
    const merged = {...answersMap,[i]:v};
    setAnswersMap(merged);

    const targetToken = card.expect[i];
    const isCorrect = eq(v, targetToken);

    if (autoAdvance) {
        const allOK = card.blanks.every(j => eq((merged[j]||""), card.expect[j]||""));
        if (allOK) {
          const finalAnswers = {...merged};
          let changed = false;
          card.blanks.forEach(j => {
            const currentVal = merged[j] || "";
            const targetVal = card.expect[j] || "";
            if (eq(currentVal, targetVal) && currentVal !== targetVal) { finalAnswers[j] = targetVal; changed = true; }
          });
          if (changed) setAnswersMap(finalAnswers);
          advanceTimeoutRef.current = setTimeout(submitCurrent, 250);
          return;
        }
    }

    if (method === 'keyboard') {
      if (isCorrect || settings.trainAdvanceOnWrong) {
        const currentBlankIdx = sortedBlanks.indexOf(i);
        if (currentBlankIdx > -1 && currentBlankIdx < sortedBlanks.length - 1) {
          const nextBlankIdx = sortedBlanks[currentBlankIdx + 1];
          blankRefs.current[nextBlankIdx]?.focus();
        }
      }
    }
  }

  function goPrev(){ stopAudio(); if(pos>0){ setPos(pos-1); if(examType !== 'mcq_train') { setAnswer(""); setAnswersMap({}); setUsedAutoFill(false); } } }
  function goNext(){
    stopAudio();
    if (examType === 'mcq_train' || practiceWrongMode) {
        if (pos < deck.length - 1) {
            setPos(p => p + 1);
        } else {
            finishSessionIfAny(true);
        }
    } else {
        if(pos < deck.length-1){
            recordSkipForCurrent();
            setPos(pos+1);
            setAnswer("");
            setAnswersMap({});
            setUsedAutoFill(false);
        } else if(repeatQueue.length){
            setDeck(d=>[...d, ...repeatQueue]);
            setRepeatQueue([]);
            setPos(pos+1);
            setAnswer("");
            setAnswersMap({});
            setUsedAutoFill(false);
        } else {
            finishSessionIfAny(true);
        }
    }
  }

  const toggleRecording = () => {
    setRecognitionError("");
    if (isRecording) {
        recognitionRef.current?.stop();
    } else {
        recognitionRef.current?.start();
    }
  };

  const giveHint = () => {
    if (!card) return;

    if (clozePattern === 'all') {
        const currentVal = latestAnswer.current || "";
        const targetVal = joinTokens(card.expect);
        const currentSeg = segGraphemes(currentVal);
        const targetSeg = segGraphemes(targetVal);
        let k = 0;
        while (k < currentSeg.length && k < targetSeg.length && eq(currentSeg[k], targetSeg[k])) {
            k++;
        }
        if (k < targetSeg.length) {
            const nextVal = targetSeg.slice(0, k + 1).join("");
            setAnswer(nextVal);
            allAyahRef.current?.focus();
        }
    } else {
        hintRef.current?.();
    }
  };

  const handleDeleteSession = (sessionId) => {
    setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionId));
  };

  const clearAllHistory = () => {
    setSessions([]);
    alert("تمام سوابق تمرین و اشتباهات پاک شد.");
  };

  const toggleFlagAyah = (s, a) => {
    const key = `${s}:${a}`;
    setFlaggedAyahs(prev => {
      const newFlags = {...prev};
      if (newFlags[key]) {
        delete newFlags[key];
      } else {
        newFlags[key] = true;
      }
      return newFlags;
    });
  };

  /* ====================== Exam utilities ====================== */

  const displayMistakes = useMemo(() => {
      let filtered = [...detailedMistakes];
      if (mistakeSurahFilter) {
          filtered = filtered.filter(item => item.s === Number(mistakeSurahFilter));
      }
      switch (mistakeSort) {
          case 'count_asc': filtered.sort((a, b) => a.count - b.count); break;
          case 'date_asc': filtered.sort((a, b) => a.latestTimestamp - b.latestTimestamp); break;
          case 'date_desc': filtered.sort((a, b) => b.latestTimestamp - a.latestTimestamp); break;
          case 'count_desc': default: filtered.sort((a, b) => b.count - a.count); break;
      }
      return filtered;
  }, [detailedMistakes, mistakeSort, mistakeSurahFilter]);

  const correctionsByAyah = useMemo(()=>{
    const map = new Map();
    for(const s of sessions){
      if(s.mode?.includes('exam') || s.mode?.includes('practice') || s.mode?.includes('mcq') || s.mode?.startsWith('hifz')){
        for(const c of (s.correctItems||[])){
          const key = `${c.surah}:${c.ayah}`;
          map.set(key, (map.get(key)||0) + 1);
        }
      }
    }
    return map;
  },[sessions]);

  function startExamFromMistakes(items) {
    const keys = items.map(e => e.key);
    if (!keys.length) { alert("هنوز خطایی برای آزمون موجود نیست."); return; }
    const subset = dataset.filter(a => keys.includes(`${a.surah_number}:${a.ayah_number}`));
    const type = mistakeExamType;

    if (type === 'typing') {
        const cards = subset.map(a => {
            const D = a.tokens_with_diacritics || [], P = a.tokens_plain || [];
            const display = practiceMode === "with" ? P : D;
            const expect = practiceMode === "with" ? D : P;
            return { key: `${a.surah_number}:${a.ayah_number}`, surah: a.surah_number, name: a.surah_name, ayah: a.ayah_number, display, expect, blanks: [...expect.keys()] };
        });
        setDeck(cards);
        setExamType('typing');
        sessionRef.current = { id: Date.now(), start: Date.now(), end: null, mode: "exam", cloze: "all", order: "priority", size: cards.length, keys: cards.map(c => c.key), wrongItems: [], correctItems: [] };
    } else { // mcq
        const cards = generateMcqDeckForTraining(subset, 'random_word', dataset, surahMap);
        if(!cards.length){ alert("آیات کافی برای ساخت آزمون تستی از اشتباهات یافت نشد."); return; }
        setDeck(cards);
        setExamType('mcq_train');
        sessionRef.current = { id: Date.now(), start: Date.now(), end: null, mode: "mcq_exam", size: cards.length, keys: cards.map(c => c.key), wrongItems: [], correctItems: [], userAnswers: {} };
    }

    setRepeatQueue([]); setPos(0); setShowRef(false); setExamMode(true); setPracticeWrongMode(false);
    setTab("train");
  }


  function handleMcqTrainAnswer(selectedOptionIndex) {
    if (mcqFeedback) return;

    const isCorrect = selectedOptionIndex === card.correctIndex;
    setMcqFeedback({ index: selectedOptionIndex, correct: isCorrect });

    if (isCorrect) {
        recordCorrect({ key: card.key, surah: card.surah, ayah: card.ayah, type: mcqQuestionType });
    } else {
        recordWrong({ key: card.key, surah: card.surah, ayah: card.ayah, type: mcqQuestionType, userAnswer: card.options[selectedOptionIndex], correctAnswer: card.options[card.correctIndex] });
    }

    setTimeout(() => {
        setMcqFeedback(null);
        goNext();
    }, mcqDelay);
  }

  /* ====================== UI ====================== */
  const totalMistakesPages = Math.ceil(displayMistakes.length / 10);

  const navTabs = [
      {id:"datacenter",t:"مرکز داده"},
      {id:"search",t:"جستجو"},
      ...(settings.showHifzTab ? [{id:"hifz",t:"حفظ"}] : []),
      {id:"train",t:"تمرین"},
      {id:"exam",t:"آزمون"},
      {id:"report",t:"گزارش"},
      {id:"settings",t:"تنظیمات"},
  ];

  const startExamFromMistakesUI = () => {
    const n = +document.getElementById("exam-n").value || 20;
    const itemsToTest = displayMistakes.slice(0, n);
    startExamFromMistakes(itemsToTest);
  }

  const startTestFromReport = (items) => {
    const keys = new Set(items.map(it => it.key.split(":").slice(0, 2).join(":")));
    const subset = dataset.filter(a => keys.has(`${a.surah_number}:${a.ayah_number}`));
    const cards = subset.map(a => {
        const D = a.tokens_with_diacritics || [], P = a.tokens_plain || [];
        const display = D, expect = P;
        return { key: `${a.surah_number}:${a.ayah_number}`, surah: a.surah_number, name: a.surah_name, ayah: a.ayah_number, display, expect, blanks: [...expect.keys()] };
    });
    setDeck(cards);
    setRepeatQueue([]);
    setPos(0);
    setTab("train");
    setPracticeWrongMode(true);
    setExamMode(false);
    setExamType('typing');
    setClozePattern('all');
    sessionRef.current = { id: Date.now(), start: Date.now(), end: null, mode: "practiceWrong", size: cards.length, keys: cards.map(c => c.key), wrongItems: [], correctItems: [] };
    setDetailedReport({ visible: false, items: [] }); // Close modal
  };

  return (
    <div className={`app-container ${settings.rtlUI?"rtl":""} ${settings.darkMode?"dark":""}`} style={{ "--ayah-font-scale": (settings.fontScale || 100) / 100 }}>
      <div className="main-content">
        <header className="app-header">
          <div className="title-container">
            <div className="title-icon-wrapper">
              <svg className="title-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path><path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 1 4 14.5v-10A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </div>
            <h1 className="app-title">مرکز حفظ قرآن</h1>
          </div>
          <div className="user-profile">
            {user && (
              (driveStatus==="error" || driveStatus==="reconnect") ? (
                // Drive connects automatically at login; this button only appears if that failed.
                <button className="drive-connect-btn" onClick={authorizeDrive} title={driveMsg || "اتصال مجدد به گوگل‌درایو"}>
                  ⚠ تلاش مجدد برای اتصال درایو
                </button>
              ) : (
                <span className={`drive-chip drive-${driveStatus}`} title={driveMsg || ""}>
                  {driveStatus==="loading" && "⏳ بارگذاری از درایو…"}
                  {driveStatus==="saving"  && "⏳ ذخیره در درایو…"}
                  {driveStatus==="synced"  && "✓ همگام با گوگل‌درایو"}
                  {driveStatus==="off"     && "⏳ در حال اتصال به درایو…"}
                </span>
              )
            )}
            {user ? (
              <div className="user-info">
                <img src={user.photoURL} alt={user.displayName} className="user-avatar" referrerPolicy="no-referrer" />
                <span className="user-name">{user.displayName}</span>
                <button onClick={()=>signOut(auth)} className="logout-button">خروج</button>
              </div>
            ) : (
              <button onClick={handleLogin} disabled={authBusy} className="login-button">
                {authBusy ? "در حال ورود…" : "ورود با گوگل"}
              </button>
            )}
          </div>
        </header>

        {authError && (
          <div className="auth-error" role="alert">
            <span>{authError}</span>
            <button className="auth-error-close" onClick={()=>setAuthError("")} aria-label="بستن">×</button>
          </div>
        )}

        {driveMsg && driveStatus==="error" && (
          <div className="auth-error" role="alert">
            <span><LinkifiedText text={driveMsg} /></span>
            <button className="auth-error-close" onClick={()=>setDriveMsg("")} aria-label="بستن">×</button>
          </div>
        )}

        <div className="nav-container">
            <nav className="nav-tabs">
              {navTabs.map(x=>(
                <button key={x.id} onClick={()=>setTab(x.id)}
                  className={`nav-tab ${tab===x.id?"active":""}`}>
                  {x.t}
                </button>
              ))}
            </nav>
        </div>

        {detailedReport.visible && <DetailedReportModal report={detailedReport} onClose={() => setDetailedReport({ visible: false, items: [], title: "" })} onStartTest={startTestFromReport} surahMap={surahMap} />}


        {tab === "hifz" && settings.showHifzTab && (
            <PracticePageTab
                pages={hifzPages}
                surahMap={surahMap}
                hifzPage={hifzPage}
                setHifzPage={setHifzPage}
                isDatasetLoaded={dataset && dataset.length > 0}
                theme={settings.hifzTheme}
                flaggedAyahs={flaggedAyahs}
                toggleFlagAyah={toggleFlagAyah}
                playAyah={playAyah}
                stopAudio={stopAudio}
                playingKey={playingKey}
                sessions={sessions}
                setSessions={setSessions}
                speechApiSupported={speechApiSupported}
                isRecording={isRecording}
                toggleRecording={toggleRecording}
                handleAllChangeRef={handleAllChangeRef}
                recognitionError={recognitionError}
                settings={settings}
                allPagesAnswers={allPagesAnswers}
                setAllPagesAnswers={setAllPagesAnswers}
            />
        )}

        {tab==="datacenter" && (
          <section className="page-section">
            <div className="card">
              <h2 className="card-title">ورود منابع داده</h2>
              {driveLocked && (
                <div className="drive-lock-note" role="note">
                  شما وارد شده‌اید و داده‌ها به‌صورت خودکار از <b>Google Drive</b> بارگذاری و سینک می‌شوند. تا زمانی که وارد هستید، بارگذاری دستی غیرفعال است تا روی نسخهٔ درایو اثر نگذارد. برای بارگذاری فایل از حافظهٔ محلی، ابتدا دکمهٔ «خروج» را بزنید.
                </div>
              )}
              <div className="grid-2-cols">
                <label className={`file-dropzone ${driveLocked?"is-disabled":""}`}><span className="file-dropzone-text">اکسل قرآن با اعراب</span><input ref={refs.xlsWith} type="file" accept=".xls,.xlsx" className="file-input" disabled={driveLocked} /></label>
                <label className={`file-dropzone ${driveLocked?"is-disabled":""}`}><span className="file-dropzone-text">اکسل قرآن بدون اعراب</span><input ref={refs.xlsWithout} type="file" accept=".xls,.xlsx" className="file-input" disabled={driveLocked} /></label>
                <label className={`file-dropzone ${driveLocked?"is-disabled":""}`}><span className="file-dropzone-text">اکسل لیست سوره‌ها</span><input ref={refs.xlsList} type="file" accept=".xls,.xlsx" className="file-input" disabled={driveLocked} /></label>
                <label className={`file-dropzone ${driveLocked?"is-disabled":""}`}><span className="file-dropzone-text">JSON پشتیبان کامل</span><input ref={refs.jsonData} type="file" accept=".json" className="file-input" disabled={driveLocked} onChange={e=>{ if(driveLocked) return; const f=e.target.files?.[0]; if(f) loadConsolidatedJSON(f); }}/></label>
                <label className={`file-dropzone ${driveLocked?"is-disabled":""}`}><span className="file-dropzone-text">JSON ساختار صفحات (اختیاری)</span><input ref={refs.pageStructure} type="file" accept=".json" className="file-input" disabled={driveLocked} onChange={e=>{ if(driveLocked) return; const f=e.target.files?.[0]; if(f) handlePageStructureUpload(f); }}/></label>
              </div>
              <div className="card-actions">
                <button onClick={runMerge} className="btn-primary" disabled={driveLocked}>ادغام و ساخت دیتاست</button>
                <button onClick={exportDataset} className="btn-secondary">خروجی JSON کامل</button>
              </div>
            </div>
          </section>
        )}

        {tab==="search" && (
          <section className="page-section">
            <div className="search-controls">
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجو در کلمات..." className="form-input arabic" dir="rtl" lang="ar" />
              <select value={surahFilter} onChange={e=>setSurahFilter(e.target.value)} className="form-select">
                <option value="">همه سوره‌ها</option>
                {surahOptions.map(([num,name])=> (<option key={num} value={num}>{toAr(num)} — {name}</option>))}
              </select>
              <div className="info-box">
                <div className="info-item">نتایج: <b className="tabular-nums">{toAr(filteredAyat.length)}</b></div>
                <div className="info-item">صفحه: <b className="tabular-nums">{toAr(searchPage)} / {toAr(totalPages)}</b></div>
              </div>
            </div>
            <div className="results-list">
              {pagedAyat.map(a=>{
                const key = slugAyah(a);
                const isFlagged = !!flaggedAyahs[key];
                const isThisPlaying = playingKey === key;
                return (
                <article key={key} className="result-item">
                  <div className="result-item-meta-container">
                    <div className="result-item-meta">{a.surah_name||`سوره ${a.surah_number}`} — آیه {toAr(a.ayah_number)}</div>
                    <div className="result-item-actions">
                        <button onClick={()=>{ userRequestedAudioRef.current = true; isThisPlaying ? stopAudio() : playAyah(a.surah_number, a.ayah_number) }} className={`btn-icon-small ${isThisPlaying ? "playing" : ""}`} title={isThisPlaying ? "توقف" : "پخش"}>
                            {isThisPlaying ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>}
                        </button>
                        <button onClick={() => toggleFlagAyah(a.surah_number, a.ayah_number)} className={`btn-icon-small ${isFlagged ? 'flagged' : ''}`} title={isFlagged ? "حذف نشانه" : "نشانه‌گذاری"}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        </button>
                    </div>
                  </div>
                  <div className="result-item-text arabic" dir="rtl" lang="ar">{joinTokens(a.tokens_with_diacritics?.length ? a.tokens_with_diacritics : a.tokens_plain)}</div>
                </article>
                )})}
            </div>
            <div className="pagination-controls">
              <button disabled={searchPage<=1} onClick={()=>setSearchPage(p=>Math.max(1,p-1))} className="btn-secondary">قبلی</button>
              <button disabled={searchPage>=totalPages} onClick={()=>setSearchPage(p=>Math.min(totalPages,p+1))} className="btn-secondary">بعدی</button>
            </div>
          </section>
        )}

        {tab==="train" && (
          <section className="page-section">
            {deck.length === 0 && (<>
              <div className="card">
                <h2 className="card-title">تنظیمات تمرین با دسته</h2>
                <div className="grid-3-cols">
                    <div className="form-group"><label>متنی که تایپ می‌کنید</label><select value={practiceMode} onChange={e=>setPracticeMode(e.target.value)} className="form-select"><option value="without">بدون اعراب</option><option value="with">با اعراب</option></select></div>
                    <div className="form-group"><label>الگوی جای‌خالی</label><select value={clozePattern} onChange={e=>setClozePattern(e.target.value)} className="form-select"><option value="all">کل آیه</option><option value="first">خالی: اول</option><option value="last">خالی: آخر</option><option value="random">خالی: رَندم</option><option value="mcq">تستی (چند گزینه‌ای)</option></select></div>
                    {clozePattern==="random" && (<div className="form-group"><label>تعداد خالی رندم</label><input type="number" min={1} max={6} value={randomCount} onChange={e=>setRandomCount(Math.max(1, Math.min(6, +e.target.value||2)))} className="form-input" /></div>)}
                    {clozePattern === "mcq" && (<div className="form-group"><label>نوع سوال تستی</label><select value={mcqQuestionType} onChange={e => setMcqQuestionType(e.target.value)} className="form-select"><option value="surah_name">تشخیص نام سوره</option><option value="first_word">تشخیص کلمه اول</option><option value="last_word">تشخیص کلمه آخر</option><option value="random_word">تشخیص کلمه رندم</option></select></div>)}
                    <div className="form-group"><label>اندازه دسته</label><input type="number" min={10} max={1000} value={deckSize} onChange={e=>{ const v=+e.target.value||40; setDeckSize(v); setSettings(s=>({...s, deckSize:v})); }} className="form-input" /></div>
                    <div className="form-group" title={clozePattern === 'mcq' && mcqQuestionType === 'surah_name' ? 'در حالت آزمون نام سوره، ترتیب همیشه تصادفی است' : ''}><label>ترتیب ارائه</label><select value={practiceOrder} onChange={e=>setPracticeOrder(e.target.value)} className="form-select" disabled={clozePattern === 'mcq' && mcqQuestionType === 'surah_name'}><option value="sequential">ترتیبی</option><option value="random">تصادفی</option></select></div>
                    <div className="form-group"><label>قاری</label><select value={reciter} onChange={e=>setReciter(e.target.value)} className="form-select">{RECITERS.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                </div>
                <div className="card-separator">
                    <h3 className="separator-title">محدوده تمرین</h3>
                     <div className="filter-group" style={{ marginBottom: '1rem' }}>
                         <label><input type="radio" value="surah" checked={practiceRangeType === 'surah'} onChange={e => setPracticeRangeType(e.target.value)} /> سوره</label>
                         <label><input type="radio" value="page" checked={practiceRangeType === 'page'} onChange={e => setPracticeRangeType(e.target.value)} /> صفحه</label>
                         <label><input type="radio" value="flagged" checked={practiceRangeType === 'flagged'} onChange={e => setPracticeRangeType(e.target.value)} /> آیات نشان شده</label>
                    </div>
                    {practiceRangeType === 'surah' && (<div className="grid-4-cols">
                        <div className="form-group"><label>از سوره</label><select value={pStartS} onChange={e=>setPStartS(e.target.value)} className="form-select"><option value="">— از ابتدا —</option>{surahOptions.map(([num,name])=> (<option key={num} value={num}>{toAr(num)} — {name}</option>))}</select></div>
                        <div className="form-group"><label>از آیه</label><input type="number" min={1} list={`dl-start-${pStartS||"x"}`} value={pStartA} onChange={e=>setPStartA(e.target.value)} className="form-input" /><datalist id={`dl-start-${pStartS||"x"}`}>{(ayahListBySurah.get(Number(pStartS))||[]).map(n=> <option key={n} value={n} />)}</datalist></div>
                        <div className="form-group"><label>تا سوره</label><select value={pEndS} onChange={e=>setPEndS(e.target.value)} className="form-select"><option value="">— تا انتها —</option>{surahOptions.map(([num,name])=> (<option key={num} value={num}>{toAr(num)} — {name}</option>))}</select></div>
                        <div className="form-group"><label>تا آیه</label><input type="number" min={1} list={`dl-end-${pEndS||"x"}`} value={pEndA} onChange={e=>setPEndA(e.target.value)} className="form-input" /><datalist id={`dl-end-${pEndS||"x"}`}>{(ayahListBySurah.get(Number(pEndS))||[]).map(n=> <option key={n} value={n} />)}</datalist></div>
                    </div>)}
                     {practiceRangeType === 'page' && (<div className="grid-2-cols">
                         <div className="form-group"><label>از صفحه</label><input type="number" min="1" max="604" value={pPageStart} onChange={e => setPPageStart(e.target.value)} className="form-input" /></div>
                         <div className="form-group"><label>تا صفحه</label><input type="number" min="1" max="604" value={pPageEnd} onChange={e => setPPageEnd(e.target.value)} className="form-input" /></div>
                    </div>)}
                    {practiceRangeType === 'flagged' && (<div className="grid-3-cols">
                        <div className="form-group"><label>مرتب‌سازی</label><select value={flaggedSortOrder} onChange={e => setFlaggedSortOrder(e.target.value)} className="form-select"><option value="surah">ترتیب مصحف</option><option value="random">تصادفی</option></select></div>
                        <div className="form-group"><label>فیلتر سوره</label><select value={flaggedSurahFilter} onChange={e => setFlaggedSurahFilter(e.target.value)} className="form-select"><option value="">همه سوره‌ها</option>{surahOptions.map(([num, name]) => (<option key={num} value={num}>{name}</option>))}</select></div>
                        <div className="form-group"><label>وضعیت تمرین</label><select value={flaggedCorrectnessFilter} onChange={e => setFlaggedCorrectnessFilter(e.target.value)} className="form-select"><option value="all">همه</option><option value="only_mistakes">فقط دارای اشتباه</option><option value="no_mistakes">بدون اشتباه</option></select></div>
                    </div>)}
                </div>
                 <div className="card-actions">
                    <button onClick={buildDeckFromRange} className="btn-primary">ساخت دستهٔ تمرین</button>
                    <button onClick={()=>{ setPStartS(""); setPStartA(""); setPEndS(""); setPEndA(""); setPPageStart("1"); setPPageEnd("1"); }} className="btn-secondary">بازنشانی محدوده</button>
                </div>
              </div>
            </>)}
            <div className="info-bar tabular-nums">دستهٔ پیشنهادی این بازه: <b>{toAr(proposalDeck.length)}</b> — دستهٔ فعلی: <b>{toAr(deck.length)}</b> — موقعیت: <b>{deck.length? toAr(pos+1):'۰'} / {toAr(deck.length||0)}</b></div>
            {deck.length>0 && card ? (
              examType === 'mcq_train' ? (
                <div className="card">
                  <div className="progress-bar-container"><div className="progress-bar" style={{width: `${((pos + 1) / deck.length) * 100}%`}}></div></div>
                  <div className="mcq-question-area">
                      <p className="mcq-question-text">{card.questionText}</p>
                      {showMcqRef && card.questionType !== 'surah_name' && <p className="mcq-question-ref">{card.name || `سوره ${card.surah}`} — آیه {toAr(card.ayah)}</p>}
                      <div dir="rtl" className="mcq-question-display arabic" lang="ar">{card.questionDisplay}</div>
                  </div>
                  <div className="grid-2-cols">
                      {card.options.map((opt, index) => {
                          let feedbackClass = "";
                          if (mcqFeedback) {
                              const isCorrect = index === card.correctIndex;
                              const isClicked = index === mcqFeedback.index;
                              if (isCorrect) feedbackClass = "feedback-correct";
                              else if (isClicked) feedbackClass = "feedback-wrong";
                          }
                          return (<button key={index} onClick={() => handleMcqTrainAnswer(index)} disabled={!!mcqFeedback} className={`mcq-option ${feedbackClass}`}><span className="mcq-option-text arabic">{opt}</span><span className={`light ${mcqFeedback && (index === card.correctIndex ? 'light-green' : (index === mcqFeedback.index ? 'light-red' : ''))}`}></span></button>);
                      })}
                  </div>
                  <div className="card-separator"><button onClick={() => finishSessionIfAny(false)} className="btn-secondary-full">پایان تمرین</button></div>
                </div>
              ) : (
                <div className="card">
                  <div className="progress-bar-container"><div className="progress-bar" style={{width: `${((pos + 1) / deck.length) * 100}%`}}></div></div>
                  <div className="practice-header">
                    {showRef && <div className="practice-ref">{card.name || `سوره ${card.surah}`} — آیه {toAr(card.ayah)}</div>}
                    <div className="practice-controls">
                      <button onClick={giveHint} className="btn-icon" title="راهنما"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></button>
                      <button onClick={()=>setShowRef(v=>!v)} className="btn-icon" title={showRef?"پنهان کردن مرجع":"نمایش مرجع"}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button>
                      <button onClick={()=>{ userRequestedAudioRef.current = true; isPlaying ? stopAudio() : playAyah(card.surah, card.ayah) }} className={`btn-icon ${isPlaying?"playing":""}`} title={isPlaying?"توقف پخش":"پخش صوت"}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
                      {speechApiSupported && (<button onClick={toggleRecording} className={`btn-icon ${isRecording ? "recording" : ""}`} title={isRecording ? "توقف ضبط" : "شروع ضبط"}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg></button>)}
                    </div>
                  </div>
                  {recognitionError && <div className="error-text">{recognitionError}</div>}
                  {showRef && (<div dir="rtl" className="reference-text arabic" lang="ar">{joinTokens(card.display)}</div>)}
                  {showRef && (
                    <div className="ai-row" dir="rtl">
                      <AIAssistButton label="✨ معنی/تفسیر" title="توضیح این آیه با هوش مصنوعی" getConfig={getAiConfig} buildPrompt={()=>tafsirPrompt({ surahName: card.name, ayahNumber: card.ayah, ayahText: joinTokens(card.display) })} />
                      <AIAssistButton label="🧠 کمک حفظ" title="نکات حفظ این آیه" getConfig={getAiConfig} buildPrompt={()=>hifzPrompt({ surahName: card.name, ayahNumber: card.ayah, ayahText: joinTokens(card.display) })} />
                    </div>
                  )}
                  {clozePattern==="all" ? (<CharColorTextarea value={answer} onChange={(v) => handleAllChange(v, 'keyboard')} target={joinTokens(card.expect)} placeholder={practiceMode==="with"? "کل آیه را با اعراب تایپ کن…" : "کل آیه را بدون اعراب تایپ کن…"} rows={4} enabled={colorInside} textareaRef={allAyahRef} onFocus={() => setActiveBlank(null)} />) : (<ClozeInline tokensRef={card.display} tokensTarget={card.expect} blanks={card.blanks} values={answersMap} onChangeBlank={(i,nv)=>{ setUsedAutoFill(false); handleBlankChange(i,nv, 'keyboard');} } colorInside={colorInside} inputRefs={blankRefs} onSetActive={setActiveBlank} onRegisterHint={(fn)=>{ hintRef.current = fn; }} />)}
                  <div className="card-actions-split">
                    <div className="action-group">
                      <button onClick={submitCurrent} className="btn-primary">ثبت پاسخ</button>
                      <button onClick={()=>{ if(clozePattern==="all"){ setAnswer(joinTokens(card.expect)); } else { const m={}; for(const i of card.blanks) m[i]=card.expect[i]; setAnswersMap(m); } setUsedAutoFill(true); }} className="btn-secondary">خودکار پر کن</button>
                      <button onClick={()=>{ recordSkipForCurrent(); afterSubmitMove(false); }} className="btn-secondary-warn">رد کردن</button>
                    </div>
                    <div className="action-group">
                      <button onClick={goPrev} className="btn-icon" title="آیهٔ قبلی"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                      <button onClick={goNext} className="btn-icon" title="آیهٔ بعدی"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                    </div>
                  </div>
                  <div className="card-separator"><button onClick={() => finishSessionIfAny(false)} className="btn-secondary-full">پایان تمرین</button></div>
                </div>
              )
            ) : (<div className="placeholder-card"><p>برای شروع تمرین، بازه را مشخص کرده و دکمه «ساخت دستهٔ تمرین» را بزنید.</p></div>)}
          </section>
        )}

        {tab==="exam" && (
          <section className="page-section">
            <div className="stat-grid">
              <StatCard icon="📝" accent="teal" value={toAr(examStats.count)} label="کل آزمون‌ها" />
              <StatCard icon="🎯" accent="green" value={`${toAr(examStats.avg)}%`} label="میانگین دقت" />
              <StatCard icon="🏆" accent="amber" value={`${toAr(examStats.best)}%`} label="بهترین نمره" />
              <StatCard icon="✅" accent="red" value={`${toAr(examStats.passed)}/${toAr(examStats.graded)}`} label={`قبولی (≥${toAr(settings.examPassPct||80)}%)`} />
            </div>

            <div className="card">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap:'wrap', gap:'.5rem'}}><h2 className="card-title" style={{margin:0}}>🧪 آزمون از اشتباهات</h2>{detailedMistakes.length > 0 && (<button onClick={clearAllHistory} className="btn-secondary-warn">پاک کردن کل سوابق</button>)}</div>
              {detailedMistakes.length===0 ? (<div className="placeholder-text">هنوز داده‌ای از اشتباهات ثبت نشده است. در تب «تمرین» یا با آزمون، اشتباه‌ها جمع می‌شوند و اینجا قابل آزمون‌اند.</div>) : (<>
                  <div className="filter-bar">
                    <div className="filter-group"><label>مرتب‌سازی:</label><select value={mistakeSort} onChange={e => setMistakeSort(e.target.value)} className="form-select-small"><option value="count_desc">بیشترین اشتباه</option><option value="count_asc">کمترین اشتباه</option><option value="date_desc">جدیدترین</option><option value="date_asc">قدیمی‌ترین</option></select></div>
                    <div className="filter-group"><label>فیلتر سوره:</label><select value={mistakeSurahFilter} onChange={e => setMistakeSurahFilter(e.target.value)} className="form-select-small"><option value="">همه سوره‌ها</option>{surahOptions.map(([num, name]) => (<option key={num} value={num}>{name}</option>))}</select></div>
                  </div>
                  <ul className="mistakes-list">
                    {displayMistakes.slice((mistakesPage - 1) * 10, mistakesPage * 10).map((item) => {
                      const { key, s, a, count } = item;
                      const name = surahMap.get(s) || `سوره ${s}`;
                      const corrections = correctionsByAyah.get(key) || 0;
                      return <li key={key} className="mistake-item"><span>{name}، آیه {toAr(a)}</span><span className="mistake-tags"><span className="tag-error">{toAr(count)} اشتباه</span>{corrections > 0 && <span className="tag-success">{toAr(corrections)} تصحیح</span>}</span></li>;
                    })}
                  </ul>
                  <div className="pagination-centered">
                    <button onClick={()=>setMistakesPage(p => Math.max(1, p-1))} disabled={mistakesPage===1} className="btn-secondary">قبلی</button>
                    <span className="tabular-nums">صفحه {toAr(mistakesPage)} از {toAr(totalMistakesPages)}</span>
                    <button onClick={()=>setMistakesPage(p => Math.min(totalMistakesPages, p+1))} disabled={mistakesPage >= totalMistakesPages} className="btn-secondary">بعدی</button>
                  </div>
                  <div className="exam-start-controls">
                    <div className="form-group-inline"><label>تعداد سوالات:</label><input id="exam-n" type="number" min={5} max={100} defaultValue={20} className="form-input-small" /></div>
                    <div className="form-group-inline"><label>نوع آزمون:</label><select value={mistakeExamType} onChange={e => setMistakeExamType(e.target.value)} className="form-select"><option value="typing">تایپی</option><option value="mcq">تستی (کلمه)</option></select></div>
                    <button onClick={startExamFromMistakesUI} className="btn-primary">شروع آزمون</button>
                  </div>
                </>)}
            </div>

            <div className="card">
              <h2 className="card-title">🎛 آزمون از یک بازه</h2>
              <p className="help-text">برای آزمون از یک سوره/جزء/صفحهٔ دلخواه (تایپی یا تستی)، به تب «تمرین» بروید، بازه و نوع را انتخاب کنید و «شروع» را بزنید. نتیجهٔ هر آزمون در همین‌جا و در گزارش‌ها ثبت می‌شود.</p>
              <button className="btn-secondary" onClick={()=>setTab('train')}>رفتن به تب تمرین ←</button>
            </div>

            <AIExamGenerator getConfig={getAiConfig} dataset={dataset} surahOptions={surahOptions} />

            {examSessions.length > 0 && (
              <div className="card">
                <h2 className="card-title">🗂 تاریخچهٔ آزمون‌ها</h2>
                <table className="data-table">
                  <thead><tr><th>تاریخ</th><th>نوع</th><th>سوالات</th><th>نمره</th><th>نتیجه</th></tr></thead>
                  <tbody>
                    {examSessions.slice(0,15).map(s=>{
                      const c=sessionCorrect(s), w=sessionWrong(s), g=c+w;
                      const pct=g?Math.round(c/g*100):0;
                      const pass=pct>=(settings.examPassPct||80);
                      const col=pass?'var(--success-color)':'var(--error-color)';
                      return (<tr key={s.id}>
                        <td style={{fontSize:'.8rem'}}>{new Date(sessionTime(s)).toLocaleDateString('fa-IR')}</td>
                        <td>{s.mode && s.mode.includes('mcq') ? 'تستی' : 'تایپی'}</td>
                        <td>{toAr(s.size ?? g)}</td>
                        <td><span className="badge-pill" style={{background:col+'22', color:col}}>{toAr(pct)}%</span></td>
                        <td style={{color:col, fontWeight:700}}>{pass?'قبول ✅':'مردود'}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab==="report" && (<ReportTab sessions={sessions} surahOptions={surahOptions} onPracticeWrong={startTestFromReport} onDeleteSession={handleDeleteSession} onShowDetails={(items, title) => setDetailedReport({ visible: true, items, title })} />)}

        {tab==="settings" && (
          <section className="page-section">
            <div className="card" style={{display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'center', justifyContent:'space-between'}}>
              <label className="setting-item" style={{margin:0, border:'none', flex:'1 1 12rem'}}>
                <span>🌙 حالت تاریک</span>
                <input type="checkbox" checked={!!settings.darkMode} onChange={e=>setSettings(s=>({...s, darkMode:e.target.checked}))} className="toggle" />
              </label>
              <div className="form-group" style={{margin:0, flex:'2 1 16rem'}}>
                <label>🔤 اندازهٔ فونت آیات: {toAr(settings.fontScale||100)}%</label>
                <input type="range" min="80" max="160" step="5" value={settings.fontScale||100} onChange={e=>setSettings(s=>({...s, fontScale:parseInt(e.target.value,10)}))} />
                <p className="arabic" style={{marginTop:'.4rem'}}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
              </div>
            </div>

            <Accordion title="اعلان‌ها و تعامل تلگرام" icon="🤖" defaultOpen={false}>
              {user ? (
                <TelegramSettings config={telegramConfig} setConfig={setTelegramConfig}
                  loaded={telegramLoaded} loadError={telegramError} saving={telegramSaving} user={user}
                  sessions={sessions} dataset={dataset} pageStructure={pageStructure} />
              ) : (
                <p className="help-text">برای دسترسی به تنظیمات تلگرام ابتدا با گوگل وارد شوید. این تنظیمات برای هر حساب جداگانه روی سرور (Firestore) ذخیره می‌شود و چیزی در مرورگر نگه‌داری نمی‌شود.</p>
              )}
            </Accordion>

            <Accordion title="هوش مصنوعی (کلیدها و مدل‌ها)" icon="🧠" defaultOpen={false}>
              <AISettings config={aiConfig} setConfig={setAiConfig} user={user} persisted={!!user} />
            </Accordion>

            <Accordion title="پرسش‌وپاسخ قرآنی (هوش مصنوعی)" icon="💬" defaultOpen={false}>
              <AIChat getConfig={getAiConfig} buildPrompt={qaPrompt} />
            </Accordion>

            <Accordion title="هدف و انگیزه" icon="🎯" defaultOpen={true}>
              <div className="goal-wrap">
                <ProgressRing value={goalToday} max={Math.max(1, settings.dailyGoal||20)} label={`${toAr(goalToday)}/${toAr(settings.dailyGoal||20)}`} color={goalToday>=(settings.dailyGoal||20)?'var(--success-color)':'var(--primary-color)'} />
                <div style={{flex:1}}>
                  <div className="form-group" style={{margin:0}}>
                    <label>هدف روزانه (تعداد آیه/سوال): {toAr(settings.dailyGoal||20)}</label>
                    <input type="range" min="5" max="200" step="5" value={settings.dailyGoal||20} onChange={e=>setSettings(s=>({...s, dailyGoal:parseInt(e.target.value,10)}))} />
                  </div>
                  <p className="help-text">{goalToday>=(settings.dailyGoal||20) ? '✅ هدف امروز محقق شد — آفرین!' : `امروز ${toAr(Math.max(0,(settings.dailyGoal||20)-goalToday))} مورد تا رسیدن به هدف باقی مانده.`}</p>
                  <p className="help-text">🔥 روزهای متوالی: <b>{toAr(streakInfo.current)}</b> (بهترین: {toAr(streakInfo.best)})</p>
                </div>
              </div>
            </Accordion>

            <Accordion title="تنظیمات عمومی" icon="⚙️" defaultOpen={false}>
                    <label className="setting-item"><span>نمایش تب حفظ</span><input type="checkbox" checked={settings.showHifzTab} onChange={e=>setSettings(s=>({...s, showHifzTab:e.target.checked}))} className="toggle" /></label>
                    <label className="setting-item"><span>رابط راست‌به‌چپ</span><input type="checkbox" checked={settings.rtlUI} onChange={e=>setSettings(s=>({...s, rtlUI:e.target.checked}))} className="toggle" /></label>
                    <label className="setting-item"><span>پیشروی خودکار (بدون Enter)</span><input type="checkbox" checked={autoAdvance} onChange={e=>{ const v=e.target.checked; saveLS(LS.AUTO_ADV,v); setAutoAdvance(v); }} className="toggle" /></label>
                    <label className="setting-item"><span>نمایش ارجاع آیه (تمرین و آزمون)</span><input type="checkbox" checked={showMcqRef} onChange={e=>{ const v=e.target.checked; saveLS(LS.SHOW_MCQ_REF,v); setShowMcqRef(v); }} className="toggle" /></label>
                    <label className="setting-item"><span>تصحیح زنده (داخل باکس)</span><input type="checkbox" checked={colorInside} onChange={e=>setColorInside(e.target.checked)} className="toggle" /></label>
                    <div className="setting-item"><span>تاخیر تست بعدی (میلی‌ثانیه)</span><input type="number" min={100} max={5000} step={100} value={mcqDelay} onChange={e=>setMcqDelay(Math.max(100, +e.target.value || 300))} className="form-input-small" /></div>
                    <div className="setting-item"><span>تاخیر انتقال در صفحه حفظ (میلی‌ثانیه)</span><input type="number" min={10} max={5000} step={10} value={settings.hifzAdvanceDelay} onChange={e => setSettings(s => ({...s, hifzAdvanceDelay: parseInt(e.target.value, 10) || 10}))} className="form-input-small" /></div>
            </Accordion>

            <Accordion title="تنظیمات آزمون" icon="📝" defaultOpen={false}>
                    <div className="setting-item"><span>نمرهٔ قبولی آزمون (٪)</span><input type="number" min={0} max={100} step={5} value={settings.examPassPct} onChange={e=>setSettings(s=>({...s, examPassPct: Math.max(0, Math.min(100, +e.target.value||0))}))} className="form-input-small" /></div>
                    <div className="setting-item"><span>محدودیت زمان پیش‌فرض آزمون (دقیقه، ۰=نامحدود)</span><input type="number" min={0} max={180} step={1} value={settings.examTimeLimit} onChange={e=>setSettings(s=>({...s, examTimeLimit: Math.max(0, +e.target.value||0)}))} className="form-input-small" /></div>
            </Accordion>

            <Accordion title="صوت و تشخیص صدا" icon="🎙️" defaultOpen={false}>
                    <div className="form-group"><label>قاری پیش‌فرض</label><select value={reciter} onChange={e=>setReciter(e.target.value)} className="form-select">{RECITERS.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                     <div className="form-group"><label>حساسیت تشخیص صدا: {toAr(Math.round(settings.recognitionSensitivity * 100))}%</label><input type="range" min="0.2" max="1.0" step="0.05" value={settings.recognitionSensitivity} onChange={e => setSettings(s => ({...s, recognitionSensitivity: parseFloat(e.target.value)}))}/><p className="help-text">مقدار کمتر، خطای بیشتری را مجاز می‌داند.</p></div>
                    <div className="form-group"><label>تاخیر پیشروی با صدا (میلی‌ثانیه)</label><input type="number" min="10" max="5000" step="10" value={settings.voiceAutoAdvanceDelay} onChange={e => setSettings(s => ({...s, voiceAutoAdvanceDelay: parseInt(e.target.value, 10) || 10}))} className="form-input-small"/></div>
            </Accordion>

            <Accordion title="پیشروی خودکار" icon="⏩" defaultOpen={false}>
                    <label className="setting-item"><span>در صفحه تمرین، بعد از پاسخ غلط به بعدی برو</span><input type="checkbox" checked={settings.trainAdvanceOnWrong} onChange={e=>setSettings(s=>({...s, trainAdvanceOnWrong:e.target.checked}))} className="toggle" /></label>
                    <label className="setting-item"><span>در صفحه حفظ، بعد از پاسخ غلط به بعدی برو</span><input type="checkbox" checked={settings.hifzAdvanceOnWrong} onChange={e=>setSettings(s=>({...s, hifzAdvanceOnWrong:e.target.checked}))} className="toggle" /></label>
                    <label className="setting-item"><span>فعال‌سازی تکمیل خودکار آیه (حالت تایپ کل آیه)</span><input type="checkbox" checked={settings.enableAutoFill} onChange={e=>setSettings(s=>({...s, enableAutoFill:e.target.checked}))} className="toggle" /></label>
                    <div className="form-group"><label>درصد تایپ صحیح برای تکمیل: {toAr(settings.autoFillPercentage)}%</label><input type="range" min="10" max="100" step="5" value={settings.autoFillPercentage} disabled={!settings.enableAutoFill} onChange={e => setSettings(s => ({...s, autoFillPercentage: parseInt(e.target.value, 10)}))} /></div>
            </Accordion>

            <Accordion title="شخصی‌سازی صفحه حفظ" icon="🎨" defaultOpen={false}>
                     <div className="grid-3-cols">
                         <div className="form-group"><label>رنگ پس‌زمینه</label><input type="color" value={settings.hifzTheme.bg} onChange={e => setSettings(s => ({...s, hifzTheme: {...s.hifzTheme, bg: e.target.value}}))} /></div>
                         <div className="form-group"><label>رنگ حاشیه</label><input type="color" value={settings.hifzTheme.border} onChange={e => setSettings(s => ({...s, hifzTheme: {...s.hifzTheme, border: e.target.value}}))} /></div>
                         <div className="form-group"><label>رنگ فونت</label><input type="color" value={settings.hifzTheme.font} onChange={e => setSettings(s => ({...s, hifzTheme: {...s.hifzTheme, font: e.target.value}}))} /></div>
                         <div className="form-group"><label>رنگ شماره آیه</label><input type="color" value={settings.hifzTheme.ayahMarker} onChange={e => setSettings(s => ({...s, hifzTheme: {...s.hifzTheme, ayahMarker: e.target.value}}))} /></div>
                          <div className="form-group"><label>پس‌زمینه شماره آیه</label><input type="color" value={settings.hifzTheme.ayahMarkerBg} onChange={e => setSettings(s => ({...s, hifzTheme: {...s.hifzTheme, ayahMarkerBg: e.target.value}}))} /></div>
                         <div className="form-group"><label>رنگ هایلایت پخش</label><input type="color" value={settings.hifzHighlight.color} onChange={e => setSettings(s => ({...s, hifzHighlight: {...s.hifzHighlight, color: e.target.value}}))} /></div>
                         <div className="form-group"><label>انیمیشن هایلایت</label><select value={settings.hifzHighlight.animation} onChange={e => setSettings(s => ({...s, hifzHighlight: {...s.hifzHighlight, animation: e.target.value}}))} className="form-select"><option value="none">بدون انیمیشن</option><option value="fade-in">Fade In</option><option value="pulse">Pulse</option></select></div>
                    </div>
            </Accordion>

            <Accordion title="مدیریت داده" icon="💾" defaultOpen={false}>
                    <p className="help-text">دیتاست: {toAr(dataset.length)} آیه • صفحات: {toAr(pageStructure.length)} • جلسات: {toAr(sessions.length)}</p>
                    <div className="tg-actions" style={{marginTop:'.5rem'}}>
                      <button onClick={exportDataset} className="btn-secondary">⬇ خروجی پشتیبان JSON</button>
                      <label className="btn-secondary" style={{cursor:'pointer'}}>⬆ بازیابی از JSON
                        <input type="file" accept=".json" style={{display:'none'}} onChange={e=>{ const f=e.target.files?.[0]; if(f) loadConsolidatedJSON(f); e.target.value=''; }} />
                      </label>
                      <button onClick={()=>{ if(confirm('همهٔ سوابق جلسات/گزارش‌ها پاک شود؟ (دیتاست و صفحات حفظ می‌مانند)')){ setSessions([]); } }} className="btn-secondary-warn">🗑 پاک‌کردن سوابق جلسات</button>
                    </div>
                    <p className="help-text" style={{marginTop:'.5rem'}}>وقتی وارد شده‌اید، داده‌ها با گوگل‌درایو همگام می‌شوند؛ این خروجی برای پشتیبان دستی است.</p>
            </Accordion>
          </section>
        )}

        <footer className="app-footer"><p>تمام داده‌ها در مرورگر شما ذخیره می‌شود. برای پشتیبان‌گیری، خروجی JSON بگیرید.</p></footer>
      </div>

      <style>{`
:root { --primary-color: #0d9488; --primary-color-light: #ccfbf1; --background: #f8fafc; --text-main: #334155; --text-heading: #0f172a; --text-muted: #64748b; --success-color: #10b981; --error-color: #ef4444; --warn-color: #f59e0b; --border-color: #e2e8f0; --card-bg: #ffffff; --chip-bg: #f1f5f9; --card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); --card-shadow-hover: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
/* Dark theme: override the design tokens; the whole app reads these vars. */
.app-container.dark { --primary-color: #2dd4bf; --primary-color-light: #134e4a; --background: #0b1220; --text-main: #cbd5e1; --text-heading: #f1f5f9; --text-muted: #94a3b8; --border-color: #1e293b; --card-bg: #111a2e; --chip-bg: #1e293b; --card-shadow: 0 4px 10px -2px rgb(0 0 0 / 0.5); --card-shadow-hover: 0 12px 20px -6px rgb(0 0 0 / 0.6); }
.app-container.dark { background-color: var(--background); }
.app-container.dark .info-box, .app-container.dark .form-select, .app-container.dark .form-input-small, .app-container.dark .form-select-small, .app-container.dark input[type=text], .app-container.dark input[type=number], .app-container.dark input[type=password], .app-container.dark input[type=time], .app-container.dark select, .app-container.dark textarea { background-color: var(--card-bg); color: var(--text-main); border-color: var(--border-color); }
.app-container.dark .nav-tabs { background: var(--card-bg); }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; background-color: var(--background); color: var(--text-main); transition: background-color .2s ease; }
.rtl{direction:rtl}
.arabic{direction:rtl; unicode-bidi:plaintext; font-family:"Scheherazade New","Amiri","Noto Naskh Arabic","Vazirmatn",system-ui,sans-serif; letter-spacing:0; font-size: calc(1em * var(--ayah-font-scale, 1));}

/* ===== Upgraded Reports / Exam / Settings UI ===== */
.stat-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:.75rem; margin-bottom:1.25rem; }
@media (min-width:720px){ .stat-grid{ grid-template-columns:repeat(4,1fr); } }
.stat-card{ background:var(--card-bg); border:1px solid var(--border-color); border-radius:14px; padding:.9rem 1rem; box-shadow:var(--card-shadow); position:relative; overflow:hidden; }
.stat-card .stat-ico{ font-size:1.2rem; }
.stat-card .stat-val{ font-size:1.6rem; font-weight:800; color:var(--text-heading); line-height:1.1; margin-top:.2rem; font-variant-numeric:tabular-nums; }
.stat-card .stat-lbl{ font-size:.82rem; color:var(--text-muted); margin-top:.15rem; }
.stat-card.accent-green{ border-top:3px solid var(--success-color); }
.stat-card.accent-red{ border-top:3px solid var(--error-color); }
.stat-card.accent-teal{ border-top:3px solid var(--primary-color); }
.stat-card.accent-amber{ border-top:3px solid var(--warn-color); }
.trend-wrap{ width:100%; overflow-x:auto; }
.heatmap{ display:flex; gap:3px; direction:ltr; padding:.25rem 0; }
.heatmap-col{ display:flex; flex-direction:column; gap:3px; }
.heatmap-cell{ width:13px; height:13px; border-radius:3px; background:var(--chip-bg); }
.heatmap-cell.l1{ background:#99f6e4; } .heatmap-cell.l2{ background:#5eead4; } .heatmap-cell.l3{ background:#14b8a6; } .heatmap-cell.l4{ background:#0f766e; }
.seg{ display:inline-flex; background:var(--chip-bg); border-radius:10px; padding:3px; gap:3px; flex-wrap:wrap; }
.seg button{ border:none; background:transparent; padding:.4rem .8rem; border-radius:8px; cursor:pointer; color:var(--text-muted); font-weight:600; font-size:.85rem; }
.seg button.active{ background:var(--card-bg); color:var(--primary-color); box-shadow:var(--card-shadow); }
.acc-section{ border:1px solid var(--border-color); border-radius:14px; margin-bottom:.75rem; overflow:hidden; background:var(--card-bg); box-shadow:var(--card-shadow); }
.acc-head{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.9rem 1.1rem; background:transparent; border:none; cursor:pointer; font-weight:700; color:var(--text-heading); font-size:1rem; }
.acc-head:hover{ background:rgba(13,148,136,.06); }
.acc-head .acc-ico{ transition:transform .2s ease; color:var(--text-muted); }
.acc-section.open .acc-head .acc-ico{ transform:rotate(180deg); }
.acc-body{ padding:0 1.1rem 1.1rem; }
.bars{ display:flex; flex-direction:column; gap:.5rem; }
.bar-row{ display:grid; grid-template-columns:8rem 1fr auto; align-items:center; gap:.6rem; }
.bar-track{ background:var(--chip-bg); border-radius:999px; height:12px; overflow:hidden; }
.bar-fill{ height:100%; border-radius:999px; }
.data-table{ width:100%; border-collapse:collapse; font-size:.9rem; }
.data-table th,.data-table td{ padding:.45rem .6rem; border-bottom:1px solid var(--border-color); text-align:center; }
.data-table th{ color:var(--text-muted); font-weight:600; cursor:pointer; user-select:none; }
.data-table th:first-child,.data-table td:first-child{ text-align:right; }
.badge-pill{ display:inline-block; padding:.15rem .55rem; border-radius:999px; font-size:.78rem; font-weight:700; }
.karnameh{ text-align:center; padding:1.25rem; border-radius:16px; background:var(--card-bg); border:1px solid var(--border-color); box-shadow:var(--card-shadow); }
.karnameh .score{ font-size:3rem; font-weight:900; line-height:1; }
.goal-wrap{ display:flex; align-items:center; gap:1rem; }
.goal-ring{ flex-shrink:0; }
.diff-err{ color: var(--error-color); text-decoration: underline; text-decoration-style: wavy; }
.diff-ok { color: var(--success-color); }
.tabular-nums{ font-variant-numeric: tabular-nums; }
.app-container { min-height: 100vh; padding: 1rem; }
.main-content { max-width: 1280px; margin: 0 auto; }
.app-header { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
.title-container { display: flex; align-items: center; gap: 1rem; }
.title-icon-wrapper { width: 3rem; height: 3rem; background-color: var(--primary-color-light); color: var(--primary-color); border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; }
.title-icon { width: 1.75rem; height: 1.75rem; }
.app-title { font-size: 1.875rem; font-weight: 700; color: var(--text-heading); }
.user-profile { display: flex; align-items: center; gap: 1rem; }
.user-info { display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; background-color: white; padding: 0.375rem; border-radius: 9999px; box-shadow: var(--card-shadow); border: 1px solid var(--border-color); }
.user-avatar { width: 2.25rem; height: 2.25rem; border-radius: 9999px; }
.user-name { font-weight: 600; padding: 0 0.5rem; display: none; }
.logout-button { padding: 0.375rem 0.75rem; border-radius: 9999px; background-color: #f1f5f9; color: #475569; font-weight: 600; border: none; cursor: pointer; transition: background-color 0.2s; }
.logout-button:hover { background-color: #e2e8f0; }
.login-button { padding: 0.5rem 1rem; border-radius: 0.5rem; background-color: white; border: 1px solid #cbd5e1; font-weight: 600; font-size: 0.875rem; box-shadow: var(--card-shadow); transition: background-color 0.2s; cursor: pointer; }
.login-button:hover { background-color: #f8fafc; }
.login-button:disabled { opacity: 0.6; cursor: default; }
.auth-error { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin: 0 0 1.5rem; padding: 0.625rem 1rem; background-color: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 0.5rem; font-size: 0.875rem; line-height: 1.6; }
.auth-error-close { background: transparent; border: 0; color: inherit; font-size: 1.1rem; line-height: 1; cursor: pointer; padding: 0 0.25rem; flex-shrink: 0; }
.drive-chip { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; font-weight: 600; padding: 0.35rem 0.7rem; border-radius: 9999px; border: 1px solid var(--border-color); background: #fff; white-space: nowrap; }
.drive-chip.drive-off { display: none; }
.drive-chip.drive-loading, .drive-chip.drive-saving { color: #b45309; border-color: #fde68a; background: #fffbeb; }
.drive-chip.drive-synced { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
.drive-chip.drive-error { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
.drive-connect-btn { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; font-weight: 600; padding: 0.35rem 0.7rem; border-radius: 9999px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af; cursor: pointer; white-space: nowrap; }
.drive-connect-btn:hover { background: #dbeafe; }
.drive-lock-note { padding: 0.75rem 1rem; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 0.5rem; font-size: 0.85rem; line-height: 1.8; }
.file-dropzone.is-disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
.nav-container { background-color: white; border-radius: 1rem; box-shadow: var(--card-shadow); padding: 0.5rem; margin-bottom: 2rem; }
.nav-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.nav-tab { flex: 1; padding: 0.625rem 1rem; font-size: 0.875rem; font-weight: 700; border-radius: 0.75rem; transition: all 0.3s; border: none; background-color: transparent; cursor: pointer; color: #64748b; }
.nav-tab:hover { background-color: var(--primary-color-light); color: var(--primary-color); }
.nav-tab.active { background-color: var(--primary-color); color: white; box-shadow: var(--card-shadow); }
.page-section { display: flex; flex-direction: column; gap: 1.5rem; }
.card { background-color: var(--card-bg); border-radius: 1rem; box-shadow: var(--card-shadow); padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.card-title { font-size: 1.25rem; font-weight: 700; color: var(--text-heading); margin-bottom: 0.5rem; }
.card-separator { border-top: 1px solid var(--border-color); padding-top: 1.25rem; margin-top: 1.25rem; }
.separator-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--text-main); }
.card-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }
.card-actions-split { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
.action-group { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.grid-2-cols { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1rem; }
.grid-3-cols { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1rem; }
.grid-4-cols { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1rem; }
.form-input, .form-select { width: 100%; padding: 0.625rem 1rem; border-radius: 0.75rem; border: 1px solid var(--border-color); background-color: white; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transition: all 0.2s; outline: none; }
.form-input:focus, .form-select:focus { border-color: var(--primary-color); box-shadow: 0 0 0 2px var(--primary-color-light); }
.form-group { display: flex; flex-direction: column; gap: 0.375rem; }
.form-group > label { font-size: 0.875rem; font-weight: 500; color: #475569; padding: 0 0.25rem; }
.file-dropzone { padding: 1rem; border-radius: 0.75rem; border: 2px dashed var(--border-color); background-color: #f8fafc; transition: border-color 0.2s; cursor: pointer; }
.file-dropzone:hover { border-color: var(--primary-color); }
.file-dropzone-text { font-weight: 600; color: #334155; }
.file-input { display: block; margin-top: 0.5rem; font-size: 0.875rem; color: #64748b; }
.file-input::file-selector-button { margin-right: 1rem; padding: 0.5rem 1rem; border-radius: 9999px; border: none; font-size: 0.875rem; font-weight: 600; background-color: var(--primary-color-light); color: var(--primary-color); cursor: pointer; transition: background-color 0.2s; }
.file-input::file-selector-button:hover { background-color: #99f6e4; }
.btn-primary { padding: 0.75rem 1.5rem; border-radius: 0.75rem; background-color: var(--primary-color); color: white; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; box-shadow: var(--card-shadow); transform: translateY(0); }
.btn-primary:hover { opacity: 0.9; box-shadow: var(--card-shadow-hover); transform: translateY(-2px); }
.btn-secondary { padding: 0.625rem 1rem; border-radius: 0.5rem; background-color: #f1f5f9; color: #334155; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; transition: background-color 0.2s; }
.btn-secondary:hover { background-color: #e2e8f0; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary-warn { padding: 0.625rem 1rem; border-radius: 0.5rem; background-color: #fef3c7; color: #92400e; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; transition: background-color 0.2s; }
.btn-secondary-warn:hover { background-color: #fde68a; }
.btn-secondary-full { width: 100%; padding: 0.625rem 1rem; border-radius: 0.5rem; background-color: #f1f5f9; color: #334155; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; transition: background-color 0.2s; }
.btn-secondary-full:hover { background-color: #e2e8f0; }
.btn-icon { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 9999px; background-color: #f1f5f9; color: #475569; border: none; cursor: pointer; transition: all 0.2s; }
.btn-icon:hover { background-color: #e2e8f0; color: #1e293b; }
.btn-icon.playing { color: var(--error-color); background-color: #fee2e2; }
.btn-icon.recording { color: var(--error-color); background-color: #fee2e2; animation: pulse 1.5s infinite; }
.btn-icon-small { padding: 0.25rem; border-radius: 9999px; background-color: #f1f5f9; color: #475569; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
.btn-icon-small.playing { color: var(--error-color); background-color: #fee2e2; }
.btn-icon-small.flagged { color: var(--warn-color); }
.search-controls { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1rem; }
.info-box { padding: 0.5rem 1rem; border-radius: 0.75rem; background-color: white; border: 1px solid var(--border-color); font-size: 0.875rem; display: flex; align-items: center; justify-content: space-between; box-shadow: var(--card-shadow); }
.info-item { color: #475569; }
.info-item b { color: var(--text-heading); }
.results-list { display: grid; gap: 1rem; }
.result-item { padding: 1rem; border-radius: 0.75rem; background-color: white; border: 1px solid #f1f5f9; box-shadow: var(--card-shadow); transition: all 0.2s; }
.result-item:hover { box-shadow: var(--card-shadow-hover); border-color: #e2e8f0; }
.result-item-meta-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.result-item-meta { font-size: 0.875rem; color: #64748b; }
.result-item-actions { display: flex; gap: 0.5rem; }
.result-item-text { font-size: 1.5rem; color: var(--text-heading); }
.pagination-controls { display: flex; align-items: center; gap: 0.75rem; }
.info-bar { padding: 0.5rem 1rem; border-radius: 0.75rem; background-color: white; border: 1px solid var(--border-color); font-size: 0.875rem; color: #475569; box-shadow: var(--card-shadow); }
.info-bar b { color: var(--text-heading); }
.placeholder-card { padding: 1.5rem; border-radius: 1rem; background-color: white; border: 2px dashed var(--border-color); text-align: center; color: #64748b; }
.progress-bar-container { position: relative; height: 0.625rem; background-color: #e2e8f0; border-radius: 9999px; overflow: hidden; }
.progress-bar { position: absolute; top: 0; right: 0; height: 100%; background-color: var(--primary-color); transition: width 0.5s; border-radius: 9999px; }
.practice-header { display: flex; justify-content: space-between; align-items: center; }
.practice-ref { font-size: 1rem; font-weight: 600; color: #334155; }
.practice-controls { display: flex; align-items: center; gap: 0.5rem; }
.error-text { font-size: 0.875rem; color: var(--error-color); }
.reference-text { font-size: 1.875rem; padding: 1rem; border-radius: 0.75rem; background-color: var(--primary-color-light); border: 1px solid #99f6e4; }
.mcq-question-area { text-align: center; }
.mcq-question-text { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-heading); }
.mcq-question-ref { font-size: 0.875rem; color: #64748b; margin-bottom: 1rem; }
.mcq-question-display { font-size: 1.875rem; padding: 1rem; border-radius: 0.75rem; background-color: #f0fdfa; border: 1px solid #ccfbf1; }
.mcq-option { padding: 1rem; border-radius: 0.75rem; border: 2px solid var(--border-color); text-align: right; background-color: white; transition: all 0.2s; width: 100%; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
.mcq-option:hover { border-color: var(--primary-color); }
.mcq-option:focus { border-color: var(--primary-color); box-shadow: 0 0 0 2px var(--primary-color-light); }
.mcq-option:disabled { background-color: #f8fafc; border-color: var(--border-color); }
.mcq-option.feedback-correct { border-color: var(--success-color); background-color: #ecfdf5; color: #065f46; font-weight: 700; }
.mcq-option.feedback-wrong { border-color: var(--error-color); background-color: #fef2f2; color: #991b1b; }
.mcq-option-text { font-size: 1.125rem; }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color); background-color: #f8fafc; border-top-left-radius: 0.75rem; border-top-right-radius: 0.75rem; }
.filter-group { display: flex; align-items: center; gap: 0.5rem; }
.filter-group label { font-size: 0.875rem; font-weight: 500; }
.form-select-small { padding: 0.375rem 0.75rem; font-size: 0.875rem; border-radius: 0.5rem; }
.mistakes-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.mistake-item { font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-radius: 0.5rem; }
.mistake-item:hover { background-color: #f8fafc; }
.mistake-tags { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; }
.tag-error { display: inline-block; background-color: #fee2e2; color: #b91c1c; padding: 0.25rem 0.5rem; border-radius: 9999px; font-weight: 600; }
.tag-success { display: inline-block; background-color: #dcfce7; color: #166534; padding: 0.25rem 0.5rem; border-radius: 9999px; font-weight: 600; }
.pagination-centered { display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.875rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
.exam-start-controls { display: flex; align-items: center; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
.form-group-inline { display: flex; align-items: center; gap: 0.5rem; }
.form-group-inline label { font-size: 0.875rem; }
.form-input-small { width: 6rem; padding: 0.5rem; }
.setting-item { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 0.5rem 0; }
.help-text { font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; }
.diff-box { margin-top: 0.25rem; padding: 0.25rem 0.5rem; border-radius: 0.5rem; background-color: white; border: 1px solid var(--border-color); }
.cloze-container { padding: 1rem; border-radius: 1rem; background-color: #f0fdfa; border: 1px solid #ccfbf1; font-size: 1.875rem; line-height: 3.5rem; }
.cloze-blank-wrapper { display: inline-flex; align-items: baseline; }
.cloze-blank { display: inline-flex; align-items: stretch; background-color: white; border: 1px solid rgba(100, 116, 139, 0.4); border-radius: 0.75rem; box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05); }
.cloze-text { color: var(--text-main); }
.toggle { appearance: none; width: 3rem; height: 1.5rem; background-color: #e2e8f0; border-radius: 9999px; cursor: pointer; position: relative; transition: background-color 0.3s ease-in-out; }
.toggle:checked { background-color: var(--primary-color); }
.toggle::after { content: ''; position: absolute; top: 0.25rem; left: 0.25rem; width: 1rem; height: 1rem; background-color: white; border-radius: 9999px; transition: transform 0.3s ease-in-out; }
.toggle:checked::after { transform: translateX(1.5rem); }
.hl-wrap{ position:relative; width:100%; height:100%; overflow:hidden; border-radius:.75rem; background:transparent; }
.hl-overlay{ position:absolute; inset:0; pointer-events:none; padding-inline:10px; padding-block:8px; font-size:1.5rem; background:transparent; z-index:1; line-height: 2.2rem; color: var(--text-heading); text-align: right; }
.hl-input{ position:relative; z-index:0; width:100%; height:100%; background:transparent; border:none; outline:none; padding-inline:10px; padding-block:8px; font-size:1.5rem; text-align: right; }
.hl-textarea{ position:relative; z-index:0; width:100%; background: #f8fafc; border:2px solid #e2e8f0; border-radius:.75rem; outline:none; padding:12px 16px; font-size:1.5rem; resize:vertical; min-height:8rem; line-height: 2.2rem; transition: border-color 0.2s, box-shadow 0.2s; }
.hl-textarea:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px var(--primary-color-light); }
.hl-in-ok{ background: rgba(16,185,129,.25); border-radius:.25rem; }
.hl-in-err{ background: rgba(239,68,68,.28); border-radius:.25rem; }
.light { width: 12px; height: 12px; border-radius: 50%; transition: background-color 0.3s; background-color: transparent; }
.light-green { background-color: var(--success-color); }
.light-red { background-color: var(--error-color); }
.hifz-page-container { border-radius: 0.5rem; box-shadow: var(--card-shadow); padding: 0.5rem; }
.hifz-page-inner { border: 2px solid #dcd0b9; padding: 1rem; border-radius: 0.25rem; }
.hifz-page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-heading); font-family: sans-serif; }
.hifz-page-content { direction: rtl; line-height: 2.9; font-size: 1.75rem; text-align: right; font-family: 'Scheherazade New', serif; word-wrap: break-word; white-space: normal; overflow-wrap: break-word; }
.hifz-ayah-chunk { display: inline; cursor: pointer; }
.playing-highlight { background-color: var(--hifz-highlight-color, #fff2b2); border-radius: 0.5rem; animation: var(--hifz-highlight-animation, fade-in) 0.5s ease; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.practice-ayah-container { position: relative; display: block; vertical-align: baseline; margin-bottom: 1.5rem; }
.ayah-marker-container { display: inline-flex; align-items: center; gap: 0.5rem; margin: 0 0.2em; position: relative;}
.ayah-marker { display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; border-radius: 9999px; width: 2.25rem; height: 2.25rem; font-family: sans-serif; font-weight: bold; cursor: pointer; }
.flag-icon { cursor: pointer; color: #cbd5e1; transition: color 0.2s; }
.flag-icon.flagged { color: var(--warn-color); }
.hifz-page-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; margin-top: 1rem; border-top: 1px solid var(--border-color); }
.hifz-page-nav { display: flex; align-items: center; gap: 0.75rem; }
.hifz-page-input { width: 5rem; text-align: center; }
.surah-header { width: 100%; text-align: center; font-size: 1.5rem; font-weight: bold; padding: 1rem; margin: 1rem 0; border: 2px solid var(--primary-color); border-radius: 0.5rem; background-color: var(--primary-color-light); color: var(--primary-color); }
.basmalah { width: 100%; text-align: center; font-size: 1.5rem; margin: 1rem 0; }
.floating-controls { position: absolute; left: 100%; top: 50%; transform: translateY(-50%); display: flex; gap: 4px; background-color: white; padding: 4px; border-radius: 99px; box-shadow: var(--card-shadow); border: 1px solid var(--border-color); z-index: 10; margin-left: 8px; }
.hifz-sticky-footer { position: sticky; bottom: 1rem; left: 0; right: 0; margin: 1.5rem auto 0; max-width: 600px; z-index: 20; background-color: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color); border-radius: 1rem; padding: 1rem; display: flex; justify-content: center; align-items: center; gap: 1rem; box-shadow: 0 -4px 10px rgba(0,0,0,0.05); }
.hifz-blank-input { background: transparent; border: none; border-bottom: 2px solid var(--text-main); text-align: center; font-family: inherit; font-size: inherit; padding: 0 4px; line-height: 1.5; height: auto; box-shadow: none; border-radius: 0; width: 100%; box-sizing: border-box; }
.hifz-blank-input:focus { outline: none; border-bottom-color: var(--primary-color); }
.hl-wrap-underline { position: relative; display: inline-block; vertical-align: baseline; line-height: 1.5; }
.hl-overlay-underline { position: absolute; inset: 0; pointer-events: none; padding: 0 4px; line-height: 1.5; font-family: inherit; font-size: inherit; text-align: center; box-sizing: border-box; z-index: 1; }
.modal-backdrop { position: fixed; inset: 0; background-color: rgba(0,0,0,0.5); z-index: 40; display: flex; align-items: center; justify-content: center; }
.modal-content { background-color: white; border-radius: 1rem; padding: 1.5rem; width: 90%; max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.modal-body { overflow-y: auto; flex-grow: 1; }
@keyframes pulse { 50% { opacity: 0.5; } }
@media (min-width: 640px) { .app-container { padding: 1.5rem; } .app-header { flex-direction: row; align-items: center; } .user-name { display: inline; } }
@media (min-width: 768px) { .grid-2-cols { grid-template-columns: repeat(2, 1fr); } .grid-3-cols { grid-template-columns: repeat(3, 1fr); } .grid-4-cols { grid-template-columns: repeat(2, 1fr); } .search-controls { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .app-container { padding: 2rem; } .grid-4-cols { grid-template-columns: repeat(4, 1fr); } }
/* ===== Visual polish ===== */
.card { transition: box-shadow .25s ease, transform .25s ease; }
.card:hover { box-shadow: var(--card-shadow-hover); }
.page-section > .card, .page-section > .tg-card, .stat-card, .acc-section { animation: fadeUp .35s ease both; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.btn-primary, .btn-secondary, .nav-tab, .ai-btn, .seg button { transition: all .2s ease; }
.btn-primary:hover { filter: brightness(1.06); transform: translateY(-1px); }
.btn-secondary:hover { background-color: var(--primary-color-light); color: var(--primary-color); }
.btn-primary:active, .btn-secondary:active { transform: translateY(0) scale(.98); }
.stat-card { transition: transform .2s ease, box-shadow .2s ease; }
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--card-shadow-hover); }
@media (min-width: 640px) {
  .nav-container { position: sticky; top: .5rem; z-index: 20; }
  .nav-tabs { background: var(--card-bg); padding: .4rem; border-radius: 1rem; border: 1px solid var(--border-color); box-shadow: var(--card-shadow); }
}
* { scrollbar-width: thin; scrollbar-color: var(--border-color) transparent; }
*::-webkit-scrollbar { width: 9px; height: 9px; }
*::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 999px; }
*::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
input:focus-visible, select:focus-visible, textarea:focus-visible { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 3px var(--primary-color-light); }
.app-title { background: linear-gradient(90deg, var(--text-heading), var(--primary-color)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.app-container.dark .card, .app-container.dark .tg-card { border: 1px solid var(--border-color); }
      `}</style>
    </div>
  );
}

// This is the new, enhanced Practice/Hifz tab component
function PracticePageTab({ pages, hifzPage, setHifzPage, isDatasetLoaded, theme, flaggedAyahs, toggleFlagAyah, playAyah, stopAudio, playingKey, sessions, setSessions, speechApiSupported, isRecording, toggleRecording, handleAllChangeRef, recognitionError, settings, allPagesAnswers, setAllPagesAnswers }) {
  const [practiceMode, setPracticeMode] = useState('read'); // 'read', 'cloze_all', 'cloze_random', 'cloze_first', 'cloze_last'
  const [activeAyahKey, setActiveAyahKey] = useState(null);
  const [focusRequest, setFocusRequest] = useState(null);
  const [showPageRef, setShowPageRef] = useState(false);
  const [isContinuousPlaying, setIsContinuousPlaying] = useState(false);
  const continuousPlayIndexRef = useRef(0);
  const hintHandlersRef = useRef({});
  const pageContainerRef = useRef(null);
  const pageData = pages.get(hifzPage) || [];
  const pageSurahs = [...new Set(pageData.map(a => a.surah_name || `سوره ${a.surah_number}`))].join(' - ');
  const practiceSessionRef = useRef(null);

  const pageAnswers = allPagesAnswers[hifzPage] || {};
  const setPageAnswers = (newAnswers) => {
    setAllPagesAnswers(prev => ({...prev, [hifzPage]: newAnswers}));
  };

  const recordWrong = (e) => { const s = practiceSessionRef.current; if (!s) return; if (!s.wrongItems) s.wrongItems = []; s.wrongItems.push({ ...e, when: Date.now() }); };
  const recordCorrect = (e) => { const s = practiceSessionRef.current; if (!s) return; if (!s.correctItems) s.correctItems = []; s.correctItems.push({ ...e, when: Date.now() }); };

  const endSession = () => {
      if (practiceSessionRef.current) {
          const session = practiceSessionRef.current;
          session.end = Date.now();

          let attemptedAyahs = 0;
          Object.values(allPagesAnswers).forEach(pageAns => {
              Object.keys(pageAns).forEach(ayahKey => {
                  const ayahData = pageAns[ayahKey];
                  if (ayahData.answer !== undefined || (ayahData.answersMap && Object.keys(ayahData.answersMap).length > 0)) {
                      attemptedAyahs++;
                  }
              });
          });

          if ((session.wrongItems && session.wrongItems.length > 0) || (session.correctItems && session.correctItems.length > 0) || attemptedAyahs > 0) {
              setSessions(s => [...s, session]);
          }
          practiceSessionRef.current = null;
      }
      setAllPagesAnswers({});
  };

  useEffect(() => {
    if (practiceMode !== 'read') {
        practiceSessionRef.current = {
            id: Date.now(), start: Date.now(), end: null,
            mode: `hifz_${practiceMode}`,
            page: hifzPage,
            keys: pageData.map(a => slugAyah(a)),
            wrongItems: [],
            correctItems: []
        };
    } else {
        if (practiceSessionRef.current) endSession();
    }
  }, [practiceMode]);

  useEffect(() => {
    return () => {
        if (practiceSessionRef.current) endSession();
    };
  }, []);

  const stopContinuousPlay = () => {
    setIsContinuousPlaying(false);
    continuousPlayIndexRef.current = 0;
    stopAudio(true);
  };

  const playNextInQueue = () => {
    if (!isContinuousPlaying) return;

    const currentPageData = pages.get(hifzPage) || [];
    if (continuousPlayIndexRef.current >= currentPageData.length) {
        if (hifzPage < 604) {
            setHifzPage(p => p + 1);
        } else {
            stopContinuousPlay();
        }
        return;
    }
    const ayahToPlay = currentPageData[continuousPlayIndexRef.current];
    if (!ayahToPlay) {
        stopContinuousPlay();
        return;
    }
    const ayahElement = document.getElementById(`ayah-${slugAyah(ayahToPlay)}`);
    ayahElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    playAyah(ayahToPlay.surah_number, ayahToPlay.ayah_number, () => {
        continuousPlayIndexRef.current++;
        setTimeout(playNextInQueue, settings.hifzAdvanceDelay > 50 ? settings.hifzAdvanceDelay : 500);
    });
  };

  const startContinuousPlay = (startIndex = 0) => {
      stopAudio(true);
      continuousPlayIndexRef.current = startIndex;
      setIsContinuousPlaying(true);
  };

  useEffect(() => {
    stopAudio(true);
    continuousPlayIndexRef.current = 0;
    if (isContinuousPlaying) {
        setTimeout(() => playNextInQueue(), 100);
    }
  }, [hifzPage]);

  useEffect(() => {
    if (isContinuousPlaying) {
        continuousPlayIndexRef.current = 0;
        playNextInQueue();
    } else {
        stopAudio(true);
    }
    return () => stopAudio(true);
  }, [isContinuousPlaying]);


  const handlePageChange = (e) => { const val = parseInt(e.target.value, 10); if (val >= 1 && val <= 604) setHifzPage(val); else if (e.target.value === "") setHifzPage(""); };
  const handlePageBlur = (e) => { if (e.target.value === "" || parseInt(e.target.value, 10) < 1) setHifzPage(1); }

  useEffect(() => {
    pageContainerRef.current?.scrollTo(0, 0);
    if (practiceMode !== 'read') {
      const firstAyah = pageData[0];
      if (firstAyah) {
        const firstAyahKey = slugAyah(firstAyah);
        setActiveAyahKey(firstAyahKey);
        setFocusRequest(firstAyahKey);
      }
    }
  }, [hifzPage, practiceMode]);

  const onAyahComplete = (completedAyahKey, isCorrect) => {
      const advance = () => {
        const currentIndex = pageData.findIndex(a => slugAyah(a) === completedAyahKey);
        const isLastAyahOnPage = currentIndex === pageData.length - 1;

        if (isLastAyahOnPage) {
            if (hifzPage < 604) {
                setTimeout(() => setHifzPage(p => p + 1), settings.hifzAdvanceDelay);
            } else {
                if (isRecording) toggleRecording();
            }
            return;
        }

        if (currentIndex > -1 && currentIndex < pageData.length - 1) {
            const nextAyah = pageData[currentIndex + 1];
            const nextAyahKey = slugAyah(nextAyah);
            setTimeout(() => {
                setActiveAyahKey(nextAyahKey);
                setFocusRequest(nextAyahKey);
                const nextAyahEl = document.getElementById(`ayah-${nextAyahKey}`);
                nextAyahEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, settings.hifzAdvanceDelay);
        } else {
            if (isRecording) toggleRecording();
        }
      };

      if (isCorrect || settings.hifzAdvanceOnWrong) {
          advance();
      }
  };

  const getBlanksForMode = (mode, expect) => {
    let blanks = [];
    switch (mode) {
        case 'cloze_all': blanks = [...expect.keys()]; break;
        case 'cloze_random': const idx = [...expect.keys()]; blanks = shuffle(idx).slice(0, Math.max(1, Math.floor(idx.length / 3))); break;
        case 'cloze_first': blanks = expect.length > 1 ? [...expect.keys()].slice(1) : []; break;
        case 'cloze_last': blanks = expect.length > 1 ? [...expect.keys()].slice(0, -1) : []; break;
        default: break;
    }
    return { blanks };
  }

  useEffect(() => {
    if (activeAyahKey && practiceMode !== 'read') {
      handleAllChangeRef.current = (transcript, method) => {
        if (method !== 'voice') return;

        const ayah = pageData.find(a => slugAyah(a) === activeAyahKey);
        if (!ayah) return;

        const currentAnswers = allPagesAnswers[hifzPage] || {};
        const currentAyahAnswers = currentAnswers[activeAyahKey] || {};

        if (practiceMode === 'cloze_all') {
            const targetText = joinTokens(ayah.tokens_plain || []);
            const similarity = getSimilarity(transcript, targetText);
            const isSimilarEnough = similarity >= settings.recognitionSensitivity;

            const newAnswers = {...currentAnswers, [activeAyahKey]: { ...currentAyahAnswers, answer: transcript } };
            setPageAnswers(newAnswers);

            if (isSimilarEnough) {
                recordCorrect({ key: activeAyahKey, scope: "ayah", typed: transcript, target: joinTokens(ayah.tokens_with_diacritics), surah: ayah.surah_number, ayah: ayah.ayah_number });
                onAyahComplete(activeAyahKey, true);
            } else {
                 recordWrong({ key: activeAyahKey, scope: "ayah", typed: transcript, target: joinTokens(ayah.tokens_with_diacritics), surah: ayah.surah_number, ayah: ayah.ayah_number });
                 onAyahComplete(activeAyahKey, false);
            }
        } else { // Handle other cloze modes
            const { blanks } = getBlanksForMode(practiceMode, ayah.tokens_plain || []);
            const currentAnswersMap = currentAyahAnswers.answersMap || {};
            const firstUnfilledBlank = blanks.find(i => !eq(currentAnswersMap[i] || "", ayah.tokens_plain[i] || ""));

            if (firstUnfilledBlank !== undefined) {
                const newAnswersMap = { ...currentAnswersMap, [firstUnfilledBlank]: transcript };
                const newAnswers = {...currentAnswers, [activeAyahKey]: { ...currentAyahAnswers, answersMap: newAnswersMap } };
                setPageAnswers(newAnswers);

                // Auto-check and advance if correct
                const targetWord = ayah.tokens_plain[firstUnfilledBlank];
                if (eq(transcript, targetWord)) {
                    const allBlanksCorrect = blanks.every(i => eq(newAnswersMap[i] || "", ayah.tokens_plain[i] || ""));
                    if(allBlanksCorrect) {
                        onAyahComplete(activeAyahKey, true);
                    }
                }
            }
        }
      };
    } else {
      handleAllChangeRef.current = null;
    }
  }, [practiceMode, activeAyahKey, pageData, allPagesAnswers, settings.recognitionSensitivity]);

  const givePageHint = () => {
      if(activeAyahKey && hintHandlersRef.current[activeAyahKey]) {
          hintHandlersRef.current[activeAyahKey]();
      }
  };

  const handleToggleRecording = () => {
    if (!isRecording) {
        const firstEmptyAyah = pageData.find(ayah => {
            const key = slugAyah(ayah);
            const answer = pageAnswers[key]?.answer || "";
            const target = joinTokens(ayah.tokens_plain || []);
            return !eq(answer, target);
        });

        if (firstEmptyAyah) {
            const key = slugAyah(firstEmptyAyah);
            setActiveAyahKey(key);
            setFocusRequest(key);
        } else if (pageData.length > 0) {
            const key = slugAyah(pageData[0]);
            setActiveAyahKey(key);
            setFocusRequest(key);
        }
    }
    toggleRecording();
  };


  if (!isDatasetLoaded && pageData.every(a => (a.tokens_with_diacritics || []).length === 0)) {
    return (<section className="page-section"><div className="placeholder-card"><p>برای نمایش متن آیات، لطفاً ابتدا از تب «مرکز داده» فایل دیتاست قرآن را بارگذاری کنید.</p></div></section>);
  }

  const animationName = settings.hifzHighlight?.animation === 'pulse' ? 'pulse-bg 1.5s infinite' : 'fade-in 0.5s';

  const isPracticeActive = practiceMode !== 'read';

  return (
    <section className="page-section">
      <style>{`
        :root {
            --hifz-highlight-color: ${settings.hifzHighlight?.color || '#fff2b2'};
            --hifz-highlight-animation: ${animationName};
        }
        @keyframes pulse-bg { 50% { background-color: ${theme.bg}; } }
      `}</style>
      <div className="card">
        <h2 className="card-title">تنظیمات تمرین صفحه</h2>
        <div className="grid-3-cols">
            <div className="form-group"><label>حالت تمرین</label><select value={practiceMode} onChange={e => { setPracticeMode(e.target.value); stopContinuousPlay(); }} className="form-select"><option value="read">فقط خواندن</option><option value="cloze_all">پر کردن کل آیه</option><option value="cloze_random">کلمات تصادفی</option><option value="cloze_first">نمایش کلمه اول</option><option value="cloze_last">نمایش کلمه آخر</option></select></div>
        </div>
      </div>

      <div ref={pageContainerRef} className="hifz-page-container" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
        <div className="hifz-page-inner">
            <div className="hifz-page-header"><span>{pageSurahs}</span><span>صفحه {toAr(hifzPage)}</span></div>
            <div className="hifz-page-content arabic" style={{ color: theme.font }}>
              {pageData.map((ayah, index) => {
                  const key = slugAyah(ayah);
                  const prevAyah = index > 0 ? pageData[index - 1] : null;
                  const isNewSurah = !prevAyah || prevAyah.surah_number !== ayah.surah_number;
                  const isPlayingThis = playingKey === key;
                  return (
                      <React.Fragment key={key}>
                          {isNewSurah && ayah.surah_number !== 1 && (<><div className="surah-header">{ayah.surah_name}</div>{ayah.ayah_number === 1 && ayah.surah_number !== 9 && <div className="basmalah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}</>)}
                          <PracticeAyah ayah={ayah} mode={practiceMode} answerData={pageAnswers[key] || {}} setAnswerData={(data) => setPageAnswers({...pageAnswers, [key]: data})} onFocus={() => setActiveAyahKey(key)} recordCorrect={recordCorrect} recordWrong={recordWrong} showRef={showPageRef} setShowRef={setShowPageRef} settings={settings} onRegisterHint={(fn) => { hintHandlersRef.current[key] = fn; }} onAyahComplete={onAyahComplete} focusRequested={focusRequest === key} onFocusHandled={() => setFocusRequest(null)} isActive={activeAyahKey === key} isPlaying={isPlayingThis} playAyah={playAyah} toggleFlagAyah={toggleFlagAyah} flagged={!!flaggedAyahs[key]} theme={theme} giveHint={givePageHint} startContinuousPlay={() => startContinuousPlay(index)}/>
                      </React.Fragment>
                  );
              })}
            </div>
            <div className="hifz-page-footer">
              <button onClick={() => { setHifzPage(p => Math.max(1, p - 1)); stopContinuousPlay(); }} disabled={hifzPage <= 1} className="btn-secondary">صفحه قبلی</button>
              <div className="hifz-page-nav"><input type="number" value={hifzPage} onChange={handlePageChange} onBlur={handlePageBlur} className="form-input hifz-page-input" min="1" max="604"/><span> / {toAr(604)}</span></div>
              <button onClick={() => { setHifzPage(p => Math.min(604, p + 1)); stopContinuousPlay(); }} disabled={hifzPage >= 604} className="btn-secondary">صفحه بعدی</button>
            </div>
        </div>
      </div>

      {(isPracticeActive || practiceMode === 'read') && (
        <div className="hifz-sticky-footer">
            {practiceMode === 'read' && (
                <button onClick={isContinuousPlaying ? stopContinuousPlay : () => startContinuousPlay(0)} className="btn-secondary">
                    {isContinuousPlaying ? 'توقف پخش ممتد' : 'شروع پخش ممتد'}
                </button>
            )}
            {isPracticeActive && (
                <button onClick={() => { endSession(); setPracticeMode('read'); }} className="btn-secondary-warn">پایان و ذخیره تمرین</button>
            )}
            {isPracticeActive && speechApiSupported && (
                <div className="form-group">
                    <button onClick={handleToggleRecording} className={`btn-secondary ${isRecording ? "recording" : ""}`}>{isRecording ? "توقف ضبط" : "شروع ضبط با صدا"}</button>
                    {recognitionError && <p className="help-text error-text">{recognitionError}</p>}
                </div>
            )}
        </div>
      )}
    </section>
  );
}

function PracticeAyah({ ayah, mode, answerData, setAnswerData, onFocus, recordCorrect, recordWrong, showRef, setShowRef, settings, onRegisterHint, onAyahComplete, focusRequested, onFocusHandled, isActive, isPlaying, playAyah, toggleFlagAyah, flagged, theme, giveHint, startContinuousPlay }) {
    const { answer = "", answersMap = {} } = answerData;
    const expect = ayah.tokens_with_diacritics || [];
    const expectPlain = ayah.tokens_plain || [];
    const blankRefs = useRef({});
    const allAyahRef = useRef(null);
    const measureRefs = useRef({});
    const [widths, setWidths] = useState({});
    const MIN_W = 64;

    const { display, blanks } = useMemo(() => {
        let display = [...expect];
        let blanks = [];
        switch (mode) {
            case 'cloze_all': blanks = [...expect.keys()]; display = Array(expect.length).fill(" "); break;
            case 'cloze_random': const idx = [...expect.keys()]; blanks = shuffle(idx).slice(0, Math.max(1, Math.floor(idx.length / 3))); break;
            case 'cloze_first': blanks = expect.length > 1 ? [...expect.keys()].slice(1) : []; break;
            case 'cloze_last': blanks = expect.length > 1 ? [...expect.keys()].slice(0, -1) : []; break;
            default: break;
        }
        return { display, blanks };
    }, [mode, expect]);

    useLayoutEffect(() => { const w = {}; blanks.forEach(i => { const el = measureRefs.current[i]; if (el) w[i] = Math.ceil(el.offsetWidth) + 24; }); setWidths(w); }, [blanks, expect]);
    const sortedBlanks = useMemo(() => [...blanks].sort((a,b) => a-b), [blanks]);

    useEffect(() => {
        if (focusRequested) {
            if (mode === 'cloze_all') {
                allAyahRef.current?.focus();
            } else if (sortedBlanks.length > 0) {
                const firstBlank = sortedBlanks.find(i => !eq(answersMap[i] || "", expectPlain[i] || "")) ?? sortedBlanks[0];
                blankRefs.current[firstBlank]?.focus();
            }
            onFocusHandled();
        }
    }, [focusRequested, mode, sortedBlanks, answersMap, expectPlain]);

    const checkCompletion = (currentAnswers) => {
        if (blanks.length > 0 && blanks.every(i => eq(currentAnswers[i] || "", expectPlain[i] || ""))) {
            onAyahComplete(slugAyah(ayah), true);
        }
    };

    const handleAllChange = (v) => {
        const targetText = joinTokens(expectPlain);
        let newAnswer = v;

        // Auto-spacing feature
        const wordsTyped = newAnswer.split(' ');
        const wordsTarget = targetText.split(' ');
        if (wordsTyped.length < wordsTarget.length) {
            const lastTypedWord = wordsTyped[wordsTyped.length - 1];
            const correspondingTargetWord = wordsTarget[wordsTyped.length - 1];
            if (eq(lastTypedWord, correspondingTargetWord) && !newAnswer.endsWith(' ')) {
                newAnswer += ' ';
            }
        }

        // Auto-fill feature
        if (settings.enableAutoFill && newAnswer.length > 0) {
            const correctGraphemes = segGraphemes(newAnswer).filter((g, i) => i < segGraphemes(targetText).length && eq(g, segGraphemes(targetText)[i])).length;
            const percentage = (correctGraphemes / segGraphemes(targetText).length) * 100;
            if (percentage >= settings.autoFillPercentage) {
                newAnswer = targetText;
            }
        }

        const isCorrect = eq(newAnswer, targetText);
        setAnswerData({ ...answerData, answer: newAnswer });

        if (isCorrect) {
            recordCorrect({ key: slugAyah(ayah), scope: "ayah", typed: newAnswer, target: joinTokens(expect), surah: ayah.surah_number, ayah: ayah.ayah_number });
            onAyahComplete(slugAyah(ayah), true);
        } else if (newAnswer.length >= targetText.length) {
            recordWrong({ key: slugAyah(ayah), scope: "ayah", typed: newAnswer, target: joinTokens(expect), surah: ayah.surah_number, ayah: ayah.ayah_number });
            onAyahComplete(slugAyah(ayah), false);
        }
    };

    const handleBlankChange = (i, v) => {
        const newAnswersMap = { ...answersMap, [i]: v };
        setAnswerData({ ...answerData, answersMap: newAnswersMap });

        const targetToken = expectPlain[i];
        const isCorrect = eq(v, targetToken);

        if (isCorrect) {
            recordCorrect({ key: `${slugAyah(ayah)}:${i}`, scope: "token", typed: v, target: expect[i], surah: ayah.surah_number, ayah: ayah.ayah_number });
            const currentBlankIdx = sortedBlanks.indexOf(i);
            if (currentBlankIdx > -1 && currentBlankIdx < sortedBlanks.length - 1) {
                const nextBlankIdx = sortedBlanks[currentBlankIdx + 1];
                blankRefs.current[nextBlankIdx]?.focus();
            } else {
                checkCompletion(newAnswersMap);
            }
        } else if (v.length >= targetToken.length) {
            recordWrong({ key: `${slugAyah(ayah)}:${i}`, scope: "token", typed: v, target: expect[i], surah: ayah.surah_number, ayah: ayah.ayah_number });
            if (settings.hifzAdvanceOnWrong) {
                const currentBlankIdx = sortedBlanks.indexOf(i);
                if (currentBlankIdx > -1 && currentBlankIdx < sortedBlanks.length - 1) {
                    const nextBlankIdx = sortedBlanks[currentBlankIdx + 1];
                    blankRefs.current[nextBlankIdx]?.focus();
                } else {
                    onAyahComplete(slugAyah(ayah), false);
                }
            }
        }
    };

    const hintClozeAll = () => {
        const currentVal = answer || "";
        const targetVal = joinTokens(expectPlain);
        const currentSeg = segGraphemes(currentVal);
        const targetSeg = segGraphemes(targetVal);
        let k = 0;
        while (k < currentSeg.length && k < targetSeg.length && eq(currentSeg[k], targetSeg[k])) {
            k++;
        }
        if (k < targetSeg.length) {
            const nextVal = targetSeg.slice(0, k + 1).join("");
            setAnswerData({ ...answerData, answer: nextVal });
            allAyahRef.current?.focus();
        }
    };

    const hintGlobal = () => {
        const activeEl = document.activeElement;
        let activeBlankIndex = -1;
        if (activeEl) {
             const activeKey = Object.keys(blankRefs.current).find(key => blankRefs.current[key] === activeEl);
             if(activeKey) activeBlankIndex = Number(activeKey);
        }
        const hintTarget = (activeBlankIndex !== -1 && blanks.includes(activeBlankIndex)) ? activeBlankIndex : blanks.find(i => !eq(answersMap[i] || "", expectPlain[i] || "")) ?? blanks[0];
        if (hintTarget != null) {
            const target = expectPlain[hintTarget] || "";
            const current = answersMap[hintTarget] || "";
            if (current.length < target.length) {
                const nextVal = target.substring(0, current.length + 1);
                handleBlankChange(hintTarget, nextVal);
                setTimeout(() => blankRefs.current[hintTarget]?.focus(), 0);
            }
        }
    };
    useEffect(() => {
        if (mode === 'cloze_all') {
            onRegisterHint(hintClozeAll);
        } else {
            onRegisterHint(hintGlobal);
        }
    }, [answer, answersMap, mode, expectPlain, blanks]);

    return (
        <span id={`ayah-${slugAyah(ayah)}`} className={`practice-ayah-container ${isPlaying ? 'playing-highlight' : ''}`} onFocus={onFocus} dir="rtl">
            {mode === 'read' ? (<span className="hifz-ayah-chunk" onClick={startContinuousPlay}>{(expect || []).join(' ')} </span>) :
            mode === 'cloze_all' ? (
                <span style={{display: 'inline-block', width: '100%', marginBottom: '1rem'}}>
                    {showRef && <div className="reference-text arabic">{joinTokens(expect)}</div>}
                    <CharColorTextarea value={answer} onChange={handleAllChange} target={joinTokens(expectPlain)} placeholder="کل آیه را تایپ کنید..." rows={2} enabled={true} textareaRef={allAyahRef}/>
                </span>
            ) : (
                <span className="cloze-container" style={{fontSize: '1.5rem', lineHeight: '3rem', display: 'block', direction: 'rtl', padding: '0', border: 'none', background: 'transparent'}}>
                    <div style={{position:"absolute", opacity:0, visibility:"hidden", pointerEvents:"none", height:0, overflow:"hidden"}}>{blanks.map(i=>(<span key={`m-${i}`} ref={el=>{ if(el) measureRefs.current[i]=el; }}>{expect[i]||""}</span>))}</div>
                    {showRef && <div className="reference-text arabic" style={{marginBottom: '1rem'}}>{joinTokens(expect)}</div>}
                    {display.map((tok, idx) => {
                        const isBlank = blanks.includes(idx);
                        return (
                            <React.Fragment key={idx}>
                                {idx > 0 ? " " : null}
                                {isBlank ? (
                                    <span className="cloze-blank-wrapper" style={{ verticalAlign: "baseline" }}>
                                        <UnderlinedCharColorInput
                                            value={answersMap[idx] || ""}
                                            target={expectPlain[idx] || ""}
                                            onChange={nv => handleBlankChange(idx, nv)}
                                            enabled={true}
                                            inputRef={el => { if (el) blankRefs.current[idx] = el; }}
                                            onFocus={onFocus}
                                            style={{ minWidth: MIN_W, width: widths[idx] || MIN_W }}
                                        />
                                    </span>
                                ) : (<span className="cloze-text" onClick={startContinuousPlay}>{tok}</span>)}
                            </React.Fragment>
                        );
                    })}
                </span>
            )}
            <span className="ayah-marker-container">
                <span onClick={() => playAyah(ayah.surah_number, ayah.ayah_number)} className="ayah-marker" style={{ color: theme.ayahMarker, backgroundColor: theme.ayahMarkerBg }}>{toAr(ayah.ayah_number)}</span>
                <span onClick={() => toggleFlagAyah(ayah.surah_number, ayah.ayah_number)} className={`flag-icon ${flagged ? 'flagged' : ''}`} title="نشانه‌گذاری برای تمرین"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>
            </span>
             {isActive && mode !== 'read' && (
                <div className="floating-controls">
                    <button onClick={giveHint} className="btn-icon-small" title="راهنما"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></button>
                    <button onClick={()=>setShowRef(v=>!v)} className="btn-icon-small" title={showRef?"پنهان کردن مرجع":"نمایش مرجع"}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></button>
                </div>
            )}
        </span>
    );
}

function generateMcqDeckForTraining(ayat, type, dataset, surahMap) {
    if (!ayat || !ayat.length) return [];
    const questions = [];
    for (const ayah of ayat) {
        if (!ayah) continue;
        let question = {};
        const ayahData = dataset.find(a => a.surah_number === ayah.surah_number && a.ayah_number === ayah.ayah_number);
        if (!ayahData) continue;
        if (type === 'surah_name') {
            const correctSurahNum = ayahData.surah_number;
            const allSurahNums = Array.from(surahMap.keys());
            const distractors = shuffle(allSurahNums.filter(n => n !== correctSurahNum)).slice(0, 3);
            const options = shuffle([correctSurahNum, ...distractors]);
            const correctIndex = options.findIndex(opt => opt === correctSurahNum);
            question = { key: `${ayahData.surah_number}:${ayahData.ayah_number}`, questionText: `آیه زیر مربوط به کدام سوره است؟`, questionDisplay: joinTokens(ayahData.tokens_with_diacritics), options: options.map(num => surahMap.get(num) || `سوره ${num}`), correctIndex: correctIndex, surah: ayahData.surah_number, name: ayahData.surah_name, ayah: ayahData.ayah_number, questionType: type };
        } else if (type === 'first_word' || type === 'last_word' || type === 'random_word') {
            const tokens = ayahData.tokens_with_diacritics;
            if (!tokens || tokens.length < 3) continue;
            let correctTokenIndex;
            if (type === 'first_word') correctTokenIndex = 0;
            else if (type === 'last_word') correctTokenIndex = tokens.length - 1;
            else correctTokenIndex = 1 + Math.floor(Math.random() * (tokens.length - 2));
            const correctToken = tokens[correctTokenIndex];
            const questionTokens = [...tokens];
            questionTokens[correctTokenIndex] = "[...]";
            const allWords = dataset.flatMap(a => a.tokens_with_diacritics || []);
            const uniqueWords = [...new Set(allWords)];
            const distractors = shuffle(uniqueWords.filter(w => w !== correctToken)).slice(0, 3);
            if (distractors.length < 3) continue;
            const options = shuffle([correctToken, ...distractors]);
            const correctIndex = options.findIndex(opt => opt === correctToken);
            question = { key: `${ayahData.surah_number}:${ayahData.ayah_number}`, questionText: `کلمه صحیح برای جای خالی کدام است؟`, questionDisplay: joinTokens(questionTokens), options: options, correctIndex: correctIndex, surah: ayahData.surah_number, name: ayahData.surah_name, ayah: ayahData.ayah_number, questionType: type };
        }
        if (question.key) questions.push(question);
    }
    return questions;
}

/* ===== Report Tab + Charts ===== */

const modeTranslations = {
    'with': 'با اعراب',
    'without': 'بدون اعراب',
    'typing': 'تایپی',
    'exam': 'آزمون تایپی',
    'mcq_train': 'آزمون تستی',
    'mcq_exam': 'آزمون تستی از اشتباهات',
    'practiceWrong': 'مرور اشتباهات',
    'hifz_cloze_all': 'حفظ (کل آیه)',
    'hifz_cloze_random': 'حفظ (کلمات تصادفی)',
    'hifz_cloze_first': 'حفظ (نمایش کلمه اول)',
    'hifz_cloze_last': 'حفظ (نمایش کلمه آخر)',
};

const clozeTranslations = {
    'all': 'کل آیه',
    'first': 'خالی: اول',
    'last': 'خالی: آخر',
    'random': 'خالی: رندم',
    'mcq': 'تستی'
};

function getSessionTitle(session, surahMap) {
    const date = new Date(session.start).toLocaleString('fa-IR');
    const mode = session.mode || '';

    if (mode.startsWith('hifz')) {
        return `${date} - تمرین حفظ صفحه ${toAr(session.page)}`;
    }
    if (mode.includes('mcq')) {
        return `${date} - آزمون تستی (${toAr(session.size)} سوال)`;
    }
    if (mode === 'exam' || mode === 'practiceWrong') {
        const title = mode === 'exam' ? 'آزمون از اشتباهات' : 'مرور اشتباهات';
        return `${date} - ${title} (${toAr(session.size)} آیه)`;
    }
    // Default practice
    const range = session.range;
    let rangeText = 'کل قرآن';
    if (range && range.pStartS) {
        const startSurah = surahMap.get(Number(range.pStartS)) || `سوره ${range.pStartS}`;
        const endSurah = surahMap.get(Number(range.pEndS)) || `سوره ${range.pEndS}`;
        if (startSurah === endSurah) {
            rangeText = startSurah;
        } else {
            rangeText = `از ${startSurah} تا ${endSurah}`;
        }
    }
    return `${date} - تمرین (${toAr(session.size)} کارت، ${rangeText})`;
}

function OverallReport({ sessions, surahMap, onShowDetails }) {
    const [range, setRange] = useState('all'); // 7 | 30 | all
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const filtered = useMemo(() => {
        if (range === 'all') return sessions;
        const days = range === '7' ? 7 : 30;
        const from = now - days * DAY;
        return sessions.filter(s => sessionTime(s) >= from);
    }, [sessions, range, now]);

    const stats = useMemo(() => computeOverallStats(filtered), [filtered]);
    const streak = useMemo(() => computeStreak(sessions, now), [sessions, now]);
    const series = useMemo(() => dailySeries(filtered, range === '7' ? 7 : range === '30' ? 30 : 21, now), [filtered, range, now]);
    const heat = useMemo(() => activityHeatmap(sessions, 13, now), [sessions, now]);
    const surahRows = useMemo(() => statsBySurah(filtered).slice(0, 6), [filtered]);
    const allWrongItems = useMemo(() => filtered.flatMap(s => s.wrongItems || []), [filtered]);

    const exportCSV = () => {
        const rows = [['date', 'mode', 'size', 'correct', 'wrong', 'accuracyPct', 'durationSec']];
        for (const s of filtered) {
            const c = sessionCorrect(s), w = sessionWrong(s), g = c + w;
            rows.push([
                new Date(sessionTime(s)).toISOString(),
                s.mode || '', s.size ?? (s.keys ? s.keys.length : 0), c, w,
                g ? Math.round((c / g) * 100) : 0, Math.round(sessionDurationMs(s) / 1000),
            ]);
        }
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `quran-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem', marginBottom: '1rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>📊 عملکرد کلی</h2>
                <Segmented value={range} onChange={setRange} options={[{ value: '7', label: '۷ روز' }, { value: '30', label: '۳۰ روز' }, { value: 'all', label: 'همه' }]} />
            </div>

            <div className="stat-grid">
                <StatCard icon="🎯" accent="teal" value={`${toAr(stats.accuracyPct)}%`} label="دقت کلی" sub={`${toAr(stats.totalCorrect)} درست / ${toAr(stats.totalWrong)} غلط`} />
                <StatCard icon="🔥" accent="amber" value={toAr(streak.current)} label="روزهای متوالی" sub={`بهترین: ${toAr(streak.best)}`} />
                <StatCard icon="📚" accent="green" value={toAr(stats.totalPracticed)} label="آیات تمرین‌شده" sub={`${toAr(stats.totalSessions)} جلسه`} />
                <StatCard icon="⏱" accent="red" value={formatDuration(stats.totalMs)} label="زمان کل تمرین" sub={`${toAr(stats.exams)} آزمون`} />
            </div>

            <h3 className="separator-title">روند دقت (٪)</h3>
            <TrendChart series={series} />

            <h3 className="separator-title" style={{ marginTop: '1rem' }}>فعالیت روزانه (۱۳ هفتهٔ اخیر)</h3>
            <Heatmap heatmap={heat} />

            {surahRows.length > 0 && (
                <>
                    <h3 className="separator-title" style={{ marginTop: '1rem' }}>سوره‌های پرخطا</h3>
                    <HBars rows={surahRows.map(r => ({ label: surahMap.get(r.surah) || `سوره ${r.surah}`, value: r.wrong, color: 'var(--error-color)' }))} />
                </>
            )}

            <div className="card-actions" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button onClick={() => onShowDetails(allWrongItems, 'لیست همه اشتباهات')} className="btn-secondary" disabled={allWrongItems.length === 0}>
                    مشاهده همه اشتباهات ({toAr(allWrongItems.length)})
                </button>
                <button onClick={exportCSV} className="btn-secondary" disabled={filtered.length === 0}>⬇ خروجی CSV</button>
            </div>
        </div>
    );
}

function ReportTab({ sessions, surahOptions, onPracticeWrong, onDeleteSession, onShowDetails }) {
  const [sel, setSel] = useState(sessions.length ? sessions[sessions.length - 1].id : null);
  const [view, setView] = useState('overview'); // overview | sessions | analysis

  useEffect(() => {
    if (sel && !sessions.find(s => s.id === sel)) {
      setSel(sessions.length ? sessions[sessions.length - 1].id : null);
    }
  }, [sessions, sel]);

  const cur = sessions.find(s => s.id === sel);
  const surahMap = useMemo(() => new Map(surahOptions), [surahOptions]);
  const surahAnalysis = useMemo(() => statsBySurah(sessions), [sessions]);

  if (sessions.length === 0) {
    return (<section className="page-section"><div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>هنوز گزارشی ثبت نشده است. یک تمرین یا آزمون را کامل کنید تا اینجا آمار ببینید.</div></section>);
  }

  const wrong = cur?.wrongItems?.length || 0;
  const ok = cur?.correctItems?.length || 0;

  const practicedCount = cur?.completedCount ?? cur?.keys?.length ?? 0;
  const practicedKeys = (cur?.keys || []).slice(0, practicedCount);
  const practicedBySurah = new Map();
  practicedKeys.forEach(key => {
    const [surahNumStr] = key.split(':');
    const surahNum = Number(surahNumStr);
    practicedBySurah.set(surahNum, (practicedBySurah.get(surahNum) || 0) + 1);
  });
  const summaryItems = [];
  practicedBySurah.forEach((count, surahNum) => {
    const surahName = surahMap.get(surahNum) || `سوره ${surahNum}`;
    summaryItems.push(`${toAr(count)} آیه از ${surahName}`);
  });
  const summaryText = summaryItems.length > 0 ? `تمرین شده: ${summaryItems.join('، ')}` : '';

  return (
    <section className="page-section">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <Segmented value={view} onChange={setView} options={[{ value: 'overview', label: '📊 نمای کلی' }, { value: 'sessions', label: '🗂 جلسات' }, { value: 'analysis', label: '🔍 تحلیل ضعف‌ها' }]} />
      </div>

      {view === 'overview' && (
        <OverallReport sessions={sessions} surahMap={surahMap} onShowDetails={onShowDetails} />
      )}

      {view === 'analysis' && (
        <div className="card">
          <h2 className="card-title">🔍 تحلیل ضعف‌ها (به تفکیک سوره)</h2>
          {surahAnalysis.length === 0 ? <p className="placeholder-text">داده‌ای نیست.</p> : (
            <table className="data-table">
              <thead><tr><th>سوره</th><th>غلط</th><th>درست</th><th>دقت</th></tr></thead>
              <tbody>
                {surahAnalysis.slice(0, 20).map(r => {
                  const acc = r.accuracyPct;
                  const col = acc >= 80 ? 'var(--success-color)' : acc >= 50 ? 'var(--warn-color)' : 'var(--error-color)';
                  return (
                    <tr key={r.surah}>
                      <td>{surahMap.get(r.surah) || `سوره ${r.surah}`}</td>
                      <td style={{ color: 'var(--error-color)', fontWeight: 700 }}>{toAr(r.wrong)}</td>
                      <td style={{ color: 'var(--success-color)' }}>{toAr(r.correct)}</td>
                      <td><span className="badge-pill" style={{ background: col + '22', color: col }}>{toAr(acc)}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === 'sessions' && (<>
      <div className="filter-group">
        <span style={{ fontWeight: 500 }}>انتخاب بسته گزارش:</span>
        <select value={sel ?? ""} onChange={e => setSel(Number(e.target.value) || null)} className="form-select" style={{ width: 'auto', flexGrow: 1 }}>
          {[...sessions].reverse().map(s => (
            <option key={s.id} value={s.id}>{getSessionTitle(s, surahMap)}</option>
          ))}
        </select>
        {sel && (<button onClick={() => onDeleteSession(sel)} className="btn-icon" title="حذف این گزارش" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>)}
      </div>

      {cur && (cur.mode?.includes('mcq')) ? (
        <div className="card">
          <div className="grid-2-cols">
            <div><h2 className="card-title">گزارش آزمون تستی</h2><p className="text-sm text-slate-500">شروع: {new Date(cur.start).toLocaleString('fa-IR')} | پایان: {cur.end ? new Date(cur.end).toLocaleString('fa-IR') : "—"}</p><p className="text-sm text-slate-500 mt-1">تعداد سوالات: {toAr(cur.size)}</p></div>
            <div className="flex items-center justify-center"><Pie ok={ok} wrong={wrong} /></div>
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-200"><h3 className="text-lg font-semibold">پاسخ‌های اشتباه ({toAr(wrong)})</h3>{(cur.wrongItems || []).map((item, i) => (<div key={i} className="p-3 rounded-xl border bg-red-50 text-sm"><p className="text-xs text-slate-500 mb-2">سوال: {surahMap.get(item.surah)}، آیه {toAr(item.ayah)}</p><p><b>پاسخ صحیح: </b><span className="arabic" dir="rtl">{item.correctAnswer}</span></p><p><b>پاسخ شما: </b><span className="arabic" dir="rtl">{item.userAnswer === 'none' ? 'پاسخ داده نشده' : item.userAnswer}</span></p></div>))}</div>
        </div>
      ) : cur && (
        <div className="card">
          <div className="grid-2-cols">
            <div>
              <h2 className="card-title">گزارش تمرین</h2>
              <div className="text-sm text-slate-500 space-y-1 mt-2">
                <p>شروع: {new Date(cur.start).toLocaleString('fa-IR')} | پایان: {cur.end ? new Date(cur.end).toLocaleString('fa-IR') : "—"}</p>
                <p>مدت: {cur.end ? formatDuration(cur.end - cur.start) : '۰ ثانیه'}</p>
                <p>حالت: {modeTranslations[cur.mode] || cur.mode} {cur.cloze ? `| الگو: ${clozeTranslations[cur.cloze] || cur.cloze}` : ''}</p>
              </div>
              {summaryText && <p className="text-sm text-slate-800 font-bold mt-3">{summaryText}</p>}
            </div>
            <div className="flex flex-wrap gap-8 items-center"><Pie ok={ok} wrong={wrong} /></div>
          </div>
          <div className="card-separator">
            <h3 className="text-lg font-semibold">اشتباه‌ها ({toAr(wrong)})</h3>
            <div className="space-y-3 mt-3">{(cur.wrongItems || []).map((w, i) => (
              <div key={i} className="p-3 rounded-xl border bg-red-50 border-red-200">
                <p className="text-xs text-slate-500 mb-1">
                  {surahMap.get(w.surah) || `سوره ${w.surah}`} — آیه {toAr(w.ayah)} • {w.scope === "ayah" ? "کل آیه" : "واژه"}
                  {w.auto ? " • خودکار" : ""}
                  {w.skip ? " • رد شده" : ""}
                </p>
                <p className="mb-1"><span className="text-slate-500">درست: </span><span className="arabic" dir="rtl">{w.target}</span></p>
                <div>
                  <span className="text-slate-500">شما: </span>
                  {(w.typed || "").trim() ? <Diff typed={w.typed} target={w.target} rtl /> : <span className="font-bold text-red-700">[خالی گذاشته شد]</span>}
                </div>
              </div>
            ))}</div>
          </div>
          {wrong > 0 && (<div className="card-separator"><button onClick={() => onPracticeWrong(cur.wrongItems)} className="btn-primary">تمرین مجدد اشتباه‌ها</button></div>)}
        </div>
      )}
      </>)}
    </section>
  );
}

function DetailedReportModal({ report, onClose, onStartTest, surahMap }) {
    const [filterSurah, setFilterSurah] = useState("");
    const [sortOrder, setSortOrder] = useState("date_desc"); // date_desc, date_asc

    const surahOptions = useMemo(() => {
        const surahs = new Set(report.items.map(i => i.surah));
        return Array.from(surahs).map(sNum => [sNum, surahMap.get(sNum) || `سوره ${sNum}`]).sort((a,b) => a[0] - b[0]);
    }, [report.items, surahMap]);

    const filteredItems = useMemo(() => {
        let items = [...report.items];
        if (filterSurah) {
            items = items.filter(item => item.surah === Number(filterSurah));
        }
        items.sort((a, b) => sortOrder === 'date_desc' ? b.when - a.when : a.when - b.when);
        return items;
    }, [filterSurah, sortOrder, report.items]);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="card-title">{report.title} ({toAr(filteredItems.length)})</h2>
                    <button onClick={onClose} className="btn-icon">&times;</button>
                </div>
                <div className="filter-bar">
                    <div className="filter-group">
                        <label>فیلتر سوره:</label>
                        <select value={filterSurah} onChange={e => setFilterSurah(e.target.value)} className="form-select-small">
                            <option value="">همه</option>
                            {surahOptions.map(([num, name]) => <option key={num} value={num}>{name}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>مرتب‌سازی:</label>
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="form-select-small">
                            <option value="date_desc">جدیدترین</option>
                            <option value="date_asc">قدیمی‌ترین</option>
                        </select>
                    </div>
                </div>
                <div className="modal-body">
                    <div className="space-y-3 mt-3">
                        {filteredItems.map((w, i) => (
                            <div key={i} className="p-3 rounded-xl border bg-red-50 border-red-200">
                                <p className="text-xs text-slate-500 mb-1">
                                    {new Date(w.when).toLocaleString('fa-IR')} • {surahMap.get(w.surah) || `سوره ${w.surah}`} — آیه {toAr(w.ayah)}
                                </p>
                                <p className="mb-1"><span className="text-slate-500">درست: </span><span className="arabic" dir="rtl">{w.target}</span></p>
                                <div>
                                    <span className="text-slate-500">شما: </span>
                                    {(w.typed || "").trim() ? <Diff typed={w.typed} target={w.target} rtl /> : <span className="font-bold text-red-700">[خالی گذاشته شد]</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="card-actions">
                    <button onClick={() => onStartTest(filteredItems)} className="btn-primary" disabled={filteredItems.length === 0}>آزمون مجدد از این موارد</button>
                    <button onClick={onClose} className="btn-secondary">بستن</button>
                </div>
            </div>
        </div>
    );
}


function Pie({ok,wrong}){ const total=Math.max(1, ok+wrong); const okPct=ok/total; const r=40, c=2*Math.PI*r; const okLen=okPct*c, wrongLen=c-okLen;
  return (<svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} stroke="#e2e8f0" strokeWidth="16" fill="none" /><circle cx="60" cy="60" r={r} stroke="var(--success-color)" strokeWidth="16" fill="none" strokeDasharray={`${okLen} ${c}`} transform="rotate(-90 60 60)" /><circle cx="60" cy="60" r={r} stroke="var(--error-color)" strokeWidth="16" fill="none" strokeDasharray={`${wrongLen} ${c}`} strokeDashoffset={-okLen} transform="rotate(-90 60 60)" /><text x="60" y="65" textAnchor="middle" fontSize="14" fill="#1e293b" className="font-bold tabular-nums">{toAr(Math.round(okPct*100))}%</text></svg>);
}
function Bar({data}){ const max=Math.max(1,...data.map(d=>d[1])); const w=320,h=140, pad=24, barW=(w-2*pad)/Math.max(1,data.length);
  return (<svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width={w} height={h} fill="#ffffff"/>{data.map(([s,c],i)=>{ const bh = (c/max)*(h-2*pad); const x=pad+i*barW, y=h-pad-bh; return (<g key={s}><rect x={x+6} y={y} width={barW-12} height={bh} fill="var(--primary-color)" opacity="0.6" rx="4"/><text x={x+barW/2} y={h-6} textAnchor="middle" fontSize="10" fill="#475569">{s}</text><text x={x+barW/2} y={y-4} textAnchor="middle" fontSize="10" fill="#475569">{toAr(c)}</text></g>);})}</svg>);
}

/* ====================== Named exports for unit testing ======================
 * These module-scoped helpers are pure (or fetch-based) and are exported so they
 * can be unit-tested in isolation (see src/App.test.jsx) WITHOUT rendering <App/>.
 * Exporting them is additive and does not change the runtime behaviour of the
 * default-exported App component. */
