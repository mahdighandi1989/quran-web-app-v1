// Onboarding / engagement nudge — the user-facing half of the "Increase User Engagement and
// Adoption" effort. The analytics layer (src/lib/analytics.js) measures the outcome; this
// component actively drives it by giving low-activity users a clear, single call-to-action to
// start a practice session, which is the app's core value-delivering interaction.
//
// It also implements the lightweight A/B-test scaffolding the product-discovery step asks for:
// each user is deterministically assigned to variant "A" or "B" (different copy/CTA framing),
// the assignment is persisted, and impressions/clicks/dismissals are all tracked so the more
// effective onboarding flow can be identified from the analytics, not guessed.
import React, { useEffect, useMemo, useState } from 'react';
import { trackInteraction, INTERACTION } from '../lib/analytics.js';

const VARIANT_KEY = 'quran.engagement.onboardingVariant.v1';
const DISMISS_KEY = 'quran.engagement.onboardingDismissed.v1';

// Stable per-browser variant assignment. We hash an existing stable id (or mint+persist one)
// so a given user always sees the same variant across reloads — a requirement for a valid A/B
// test. No Math.random at module scope (kept deterministic + storage-backed).
function assignVariant() {
  let raw = null;
  try {
    raw = window.localStorage?.getItem(VARIANT_KEY);
  } catch {
    /* storage disabled */
  }
  if (raw === 'A' || raw === 'B') return raw;
  // Mint a stable seed and bucket on its parity. Uses a time+counter seed; persisted so it is
  // assigned exactly once per browser.
  let seed = 0;
  try {
    const existing = window.localStorage?.getItem('quran.engagement.uid.v1');
    const uid = existing || `${Date.now()}-${(window.performance && window.performance.now ? Math.floor(window.performance.now()) : 0)}`;
    if (!existing) window.localStorage?.setItem('quran.engagement.uid.v1', uid);
    for (let i = 0; i < uid.length; i++) seed = (seed * 31 + uid.charCodeAt(i)) >>> 0;
  } catch {
    seed = 0;
  }
  const variant = seed % 2 === 0 ? 'A' : 'B';
  try {
    window.localStorage?.setItem(VARIANT_KEY, variant);
  } catch {
    /* ignore */
  }
  return variant;
}

const COPY = {
  A: {
    title: 'یک قدم تا حفظ بهتر 🌟',
    body: 'با یک تمرین کوتاه شروع کن — همین حالا چند آیه را مرور کن و پیشرفتت را ببین.',
    cta: 'شروع تمرین',
  },
  B: {
    title: 'امروز تمرین کرده‌ای؟ 📖',
    body: 'تمرین روزانه، حفظ را ماندگار می‌کند. اولین جلسهٔ امروزت را همین الان بساز.',
    cta: 'تمرین امروز را بساز',
  },
};

/**
 * @param {object}   props
 * @param {number}   props.activityCount  How many practice sessions the user already has. The
 *                   nudge only targets low-activity users (the adoption gap), so it hides once
 *                   the user is clearly engaged.
 * @param {function} props.onStart  Called when the user accepts the CTA (host app routes them
 *                   into the practice flow).
 * @param {number}   [props.threshold=3]  Below this session count the nudge is shown.
 */
export default function EngagementNudge({ activityCount = 0, onStart, threshold = 3 }) {
  const variant = useMemo(() => assignVariant(), []);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage?.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const visible = !dismissed && activityCount < threshold;

  // Fire an impression exactly once per mount when actually shown — this is the denominator of
  // the A/B test's conversion rate.
  useEffect(() => {
    if (visible) {
      trackInteraction(INTERACTION.ONBOARDING_SHOWN, { variant }, undefined, undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const copy = COPY[variant] || COPY.A;

  const handleStart = () => {
    trackInteraction(INTERACTION.ONBOARDING_CTA, { variant });
    if (typeof onStart === 'function') onStart(variant);
  };

  const handleDismiss = () => {
    trackInteraction(INTERACTION.ONBOARDING_DISMISS, { variant });
    try {
      window.localStorage?.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="engagement-nudge" role="region" aria-label="پیشنهاد شروع تمرین" data-variant={variant}>
      <button
        type="button"
        className="engagement-nudge__close"
        aria-label="بستن"
        onClick={handleDismiss}
      >
        ✕
      </button>
      <div className="engagement-nudge__title">{copy.title}</div>
      <div className="engagement-nudge__body">{copy.body}</div>
      <button type="button" className="engagement-nudge__cta" onClick={handleStart}>
        {copy.cta}
      </button>
    </div>
  );
}
