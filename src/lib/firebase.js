// Firebase app init, Google auth providers, and auth-error messages.
import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";
import { configureAnalytics } from "./analytics.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase config. Build-time env vars (VITE_*) take precedence so each environment can
// override it; if they're not set, we fall back to the project's PUBLIC web config below so
// the app still works out-of-the-box (e.g. a deploy without env vars). A Firebase *web* API
// key is not a secret — it identifies the project and ships in the client bundle regardless;
// real protection comes from API-key restrictions + Auth authorized domains + security rules.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBGVf6Ep5JIwg61pNvml8XqdzfDazZ2MT0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "quran-app-7566b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "quran-app-7566b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "quran-app-7566b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "31712827799",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:31712827799:web:812c08c865e3b05d9b4cd2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DT8VMMC126",
};
const fbApp = initializeApp(firebaseConfig);
// Initialise Firebase Analytics and wire it into the engagement instrumentation layer so
// every tracked interaction (see src/lib/analytics.js) is forwarded to GA4 as a custom event.
// This is what makes the "unique daily interactions" KPI observable in production — without
// it the app collected zero behavioural signal. Guarded because analytics needs a secure
// origin and the Measurement SDK is unavailable in non-browser / test environments.
try {
  const fbAnalytics = getAnalytics(fbApp);
  if (typeof logEvent === 'function') {
    configureAnalytics({ analytics: fbAnalytics, logEvent });
  }
} catch {} // analytics may require secure origin
const auth = getAuth(fbApp);
// Firestore is the per-user backend store (e.g. Telegram config) — keeps secrets/settings
// out of the browser's localStorage. Requires Firestore enabled in the Firebase project.
const db = getFirestore(fbApp);
const googleProvider = new GoogleAuthProvider();
// Request Drive access AT LOGIN so a single sign-in also connects Google Drive automatically
// (no separate "connect Drive" step). The login result's OAuth credential then carries the
// Drive access token. driveProvider below remains for on-demand re-authorization.
googleProvider.addScope("https://www.googleapis.com/auth/drive");
// Always show the account chooser; avoids being silently stuck on a previous account.
googleProvider.setCustomParameters({ prompt: "select_account" });

// Turn Firebase auth error codes into clear Persian messages so failures are never silent.
function describeAuthError(err){
  const code = err && err.code ? err.code : "";
  switch (code) {
    case "auth/unauthorized-domain":
      return "دامنهٔ این سایت در Firebase مجاز نیست. در کنسول Firebase → Authentication → Settings → Authorized domains دامنهٔ فعلی را اضافه کنید.";
    case "auth/operation-not-allowed":
      return "ورود با گوگل فعال نیست. در کنسول Firebase → Authentication → Sign-in method روش «Google» را فعال کنید.";
    case "auth/popup-blocked":
      return "مرورگر پنجرهٔ ورود را مسدود کرد؛ در حال انتقال به صفحهٔ ورود گوگل…";
    case "auth/popup-closed-by-user":
      return "پنجرهٔ ورود پیش از تکمیل بسته شد. دوباره تلاش کنید.";
    case "auth/network-request-failed":
      return "اتصال اینترنت برقرار نیست. اتصال خود را بررسی کرده و دوباره تلاش کنید.";
    case "auth/cancelled-popup-request":
      return ""; // benign: a second popup superseded the first
    default:
      return "ورود ناموفق بود" + (code ? ` (${code})` : "") + ".";
  }
}

/* ====================== Google Drive sync ====================== */
// IMPORTANT: the Drive scope is requested on a SEPARATE provider, not at login.
// Asking for Drive during sign-in makes the consent screen long enough that this host's
// cross-domain auth (app domain != authDomain) breaks the popup (COOP) and the redirect
// (third-party storage), so login wouldn't stick. Keeping login on basic scopes makes it
// reliable; Drive is then authorized on demand via the "connect Drive" button.
const driveProvider = new GoogleAuthProvider();
driveProvider.addScope("https://www.googleapis.com/auth/drive");
driveProvider.setCustomParameters({ prompt: "consent" });

// Used to silently refresh the short-lived Drive access token after a 401. No `prompt: consent`
// so Google can return a fresh token with minimal/no UI when the user already granted access.
const driveRefreshProvider = new GoogleAuthProvider();
driveRefreshProvider.addScope("https://www.googleapis.com/auth/drive");

export {
  auth, db, googleProvider, driveProvider, driveRefreshProvider, describeAuthError, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
};
