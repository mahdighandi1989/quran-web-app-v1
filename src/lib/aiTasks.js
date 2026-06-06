// Ready-made prompts for the app's AI features. Pure (build a {system, user} pair) so they're
// testable and consistent. The model is the user's configured one (see aiClient).
const SYSTEM_FA = 'تو یک دستیار متخصص قرآن کریم هستی. پاسخ‌ها کوتاه، دقیق، محترمانه و به زبان فارسیِ روان باشند. از ذکر منابع جعلی پرهیز کن و اگر چیزی را با قطعیت نمی‌دانی صادقانه بگو.';

// 1) Tafsir / meaning of a single ayah.
export function tafsirPrompt({ surahName, ayahNumber, ayahText }) {
  return {
    system: SYSTEM_FA,
    user:
      `این آیه را به‌طور خلاصه توضیح بده:\n` +
      `سوره: ${surahName || '-'} | آیه: ${ayahNumber || '-'}\n` +
      (ayahText ? `متن آیه: «${ayahText}»\n` : '') +
      `\nلطفاً در حداکثر ۴ بخش کوتاه بده:\n` +
      `۱) ترجمهٔ روان فارسی\n۲) معنی و پیام اصلی در دو-سه جمله\n۳) نکتهٔ کلیدی برای تدبر\n۴) (اختیاری) یک واژهٔ مهم و معنایش.`,
    maxTokens: 700,
  };
}

// 2) Memorization helper for an ayah (or page context).
export function hifzPrompt({ surahName, ayahNumber, ayahText, pageInfo }) {
  return {
    system: SYSTEM_FA,
    user:
      `برای حفظِ بهترِ این آیه کمک بده:\n` +
      `سوره: ${surahName || '-'} | آیه: ${ayahNumber || '-'}` + (pageInfo ? ` | ${pageInfo}` : '') + `\n` +
      (ayahText ? `متن: «${ayahText}»\n` : '') +
      `\nخروجی شامل:\n` +
      `• تقطیع معناییِ آیه به بخش‌های کوچک برای حفظ\n` +
      `• تداعی/نکتهٔ کمک‌حافظه (مثلاً ارتباط واژه‌ها یا تصویرسازی)\n` +
      `• آیهٔ قبل/بعد را اگر می‌دانی به‌اختصار اشاره کن تا پیوستگی حفظ شود\n` +
      `کوتاه و کاربردی بنویس.`,
    maxTokens: 700,
  };
}

// 3) Free-form Q&A about the Quran.
export function qaPrompt({ question }) {
  return {
    system: SYSTEM_FA + ' اگر سوال خارج از حوزهٔ قرآن و علوم مرتبط بود، مودبانه همان را یادآوری کن.',
    user: String(question || ''),
    maxTokens: 900,
  };
}

// 4) Generate exam questions from a set of ayahs. Returns a prompt that asks for STRICT JSON.
export function examGenPrompt({ ayahs = [], count = 5, type = 'mcq' }) {
  const list = ayahs.slice(0, 40).map((a) => `- ${a.surahName || a.surah}:${a.ayah} «${a.text || ''}»`).join('\n');
  const shape = type === 'mcq'
    ? `[{"q":"صورت سوال","choices":["گزینه۱","گزینه۲","گزینه۳","گزینه۴"],"answer":0,"ref":"سوره:آیه"}]`
    : `[{"q":"جملهٔ آیه با یک ___ جای‌خالی","answer":"کلمهٔ صحیح","ref":"سوره:آیه"}]`;
  return {
    system: SYSTEM_FA + ' فقط و فقط یک آرایهٔ JSON معتبر برگردان؛ هیچ متن اضافه‌ای ننویس.',
    user:
      `از آیات زیر ${count} سوال «${type === 'mcq' ? 'چهارگزینه‌ای' : 'جای‌خالی'}» بساز.\n` +
      `قالب خروجی دقیقاً این باشد (آرایهٔ JSON):\n${shape}\n\n` +
      `برای هر سوال حتماً فیلد ref (سوره:آیه) را پر کن. سوال‌ها از خود متن آیات باشند.\n\n` +
      `آیات:\n${list}`,
    maxTokens: 1500,
    temperature: 0.5,
  };
}

// Validate AI-generated exam questions BEFORE they are rendered, so a malformed model reply
// surfaces a clear, user-facing error instead of crashing the quiz UI (e.g. `.map` over a
// missing `choices` array, or scoring against a non-numeric `answer`). Throws an Error with a
// specific message describing the first problem found; returns the (same) array on success.
//
// Contract:
//   - the input must be a non-empty array;
//   - every item must be an object with a non-empty string `q`;
//   - for type 'mcq': `choices` must be an array of ≥2 items and `answer` an integer index
//     into that array;
//   - for type 'fill': `answer` must be a non-empty string.
export function validateExamQuestions(questions, { type = 'mcq' } = {}) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('خروجی مدل قابل‌خواندن نبود یا هیچ سوالی نداشت. دوباره تلاش کنید یا مدل دیگری انتخاب کنید.');
  }
  questions.forEach((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== 'object' || Array.isArray(q)) {
      throw new Error(`سوال ${n} ساختار نامعتبری دارد.`);
    }
    if (typeof q.q !== 'string' || !q.q.trim()) {
      throw new Error(`سوال ${n} فاقد صورت سوال (q) است.`);
    }
    if (type === 'mcq') {
      if (!Array.isArray(q.choices) || q.choices.length < 2) {
        throw new Error(`سوال ${n} فاقد گزینه‌های معتبر (choices) است.`);
      }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) {
        throw new Error(`سوال ${n} پاسخ صحیح معتبری ندارد (answer).`);
      }
    } else if (typeof q.answer !== 'string' || !q.answer.trim()) {
      throw new Error(`سوال ${n} فاقد پاسخ (answer) است.`);
    }
  });
  return questions;
}

// Tolerant JSON extractor for the exam-gen reply (handles ```json fences / extra prose).
export function parseJsonArray(text) {
  if (!text) return [];
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('['); const end = s.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
