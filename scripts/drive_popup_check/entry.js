import { singlePopup, drivePopupOutcome, PICK_MSG } from '../../src/lib/driveAuth.js';
const out = document.getElementById('out');
// like Firebase's signInWithPopup: opens the auth window, polls window.closed, rejects popup-closed-by-user
function fakeFirebasePopup() {
  return new Promise((_, rej) => {
    const w = window.open('about:blank', 'auth', 'width=500,height=600');
    const t = setInterval(() => { if (w.closed) { clearInterval(t); rej(Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' })); } }, 200);
  });
}
window.connect = async (timeoutMs) => {
  out.textContent = '👆 ' + PICK_MSG; out.dataset.state = 'picking';
  try { await singlePopup(fakeFirebasePopup, { timeoutMs }); }
  catch (e) { const o = drivePopupOutcome(e); out.textContent = o.msg; out.dataset.state = o.status; }
};
