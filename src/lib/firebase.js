// Firebase app init, Google auth providers, and auth-error messages.
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "firebase/auth";

// Firebase config is read from build-time environment variables (Vite inlines
// VITE_* at build). Copy `.env.example` to `.env` and fill in your project's
// values (or set them in your deploy platform). Never commit `.env`.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
const fbApp = initializeApp(firebaseConfig);
try { getAnalytics(fbApp); } catch {} // analytics may require secure origin
const auth = getAuth(fbApp);
const googleProvider = new GoogleAuthProvider();
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

export {
  auth, googleProvider, driveProvider, describeAuthError,
  signInWithPopup, signOut, onAuthStateChanged,
};
