// React hook: re-render when the server-default-AI status or the signed-in state changes (aiClient.js).
import { useSyncExternalStore } from 'react';
import { subscribeServerDefaultAI, getServerDefaultAI, isSignedInForAI } from './aiClient.js';

let snap = null;
function snapshot() {
  const d = getServerDefaultAI();
  const s = isSignedInForAI();
  if (!snap || snap.d !== d || snap.s !== s) snap = { d, s };
  return snap;
}
export function useServerDefaultAI() {
  const v = useSyncExternalStore(subscribeServerDefaultAI, snapshot, snapshot);
  return { ...v.d, signedIn: v.s };
}
