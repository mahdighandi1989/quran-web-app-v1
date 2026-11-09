import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'mock' })) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})), doc: vi.fn(() => ({})),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  setDoc: vi.fn(() => Promise.resolve()), onSnapshot: vi.fn(() => () => {}),
}));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider { addScope() {} setCustomParameters() {} static credentialFromResult() { return null; } }
  const user = { uid: 'u1', displayName: 'Owner', email: 'owner@example.com', photoURL: '' };
  return {
    getAuth: vi.fn(() => ({ currentUser: user })), GoogleAuthProvider,
    signInWithPopup: vi.fn(() => Promise.reject(Object.assign(new Error('x'), { code: 'auth/popup-blocked' }))),
    signInWithRedirect: vi.fn(), getRedirectResult: vi.fn(() => Promise.resolve(null)), signOut: vi.fn(),
    onAuthStateChanged: vi.fn((auth, cb) => { cb(user); return () => {}; }),
  };
});
const me = vi.hoisted(() => ({ value: { isAdmin: false, adminConfigured: true } }));
vi.mock('../lib/inspectionApi.js', async (orig) => ({ ...(await orig()), getMe: vi.fn(() => Promise.resolve(me.value)), listSheets: vi.fn(() => Promise.resolve({ reports: [] })) }));

window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
import App from '../App.jsx';
import { fireEvent, waitFor } from '@testing-library/react';

// Sheet 26, retest 2026-11-09 08:55: «آزمون › تایپی › شروع آزمون (از اشتباهات)», «الفاتحة — آیه ٤», typed «مالك يوم الدين»
// (U+0643, U+064A) ⇒ «✗ غلط بود — درست: مالک · یوم · الدین». The owner's «الگوی جای‌خالی» was not «کل آیه», so the
// whole-ayah exam showed one box per word. This drives the REAL page along the same path.
const seed = (plain, cloze) => {
  localStorage.clear();
  localStorage.setItem('quran.datacenter.dataset.v1', JSON.stringify([
    { surah_number: 1, ayah_number: 4, surah_name: 'الفاتحة', page: 1, juz: 1, tokens_plain: plain, tokens_with_diacritics: ['مَٰلِكِ', 'يَوۡمِ', 'ٱلدِّينِ'] },
  ]));
  localStorage.setItem('quran.sessions.v1', JSON.stringify([
    { id: 1, start: 1, end: 2, mode: 'exam', wrongItems: [{ key: '1:4:ayah', surah: 1, ayah: 4, when: 2, typed: 'x', target: 'y' }], correctItems: [] },
  ]));
  localStorage.setItem('quran.practice.cloze', JSON.stringify(cloze));
};

async function typeInMistakeExam(text) {
  render(<MemoryRouter initialEntries={['/exam']}><App /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'شروع آزمون' }));
  const box = await screen.findByPlaceholderText(/کل آیه را/);
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'ثبت پاسخ' }));
}

describe('sheet 26: typing exam from mistakes, whole ayah, Arabic ك/ي', () => {
  for (const cloze of ['random', 'first', 'all']) {
    for (const plain of [['مالک', 'یوم', 'الدین'], ['ملك', 'يوم', 'الدين'], ['مالك', 'يوم', 'الدين']]) {
      it(`«مالك يوم الدين» is correct — practice cloze=${cloze}, plain column ${plain.join(' ')}`, async () => {
        seed(plain, cloze);
        await typeInMistakeExam('مالك يوم الدين');
        await waitFor(() => expect(screen.queryByTestId('typed-wrong-panel')).toBeNull());
        expect(screen.queryByText('✗ غلط بود')).toBeNull();
      });
    }
  }
  it('a really wrong ayah is still graded wrong, with the target as one line', async () => {
    seed(['مالک', 'یوم', 'الدین'], 'random');
    await typeInMistakeExam('مالك يوم القيامة');
    const panel = await screen.findByTestId('typed-wrong-panel');
    expect(panel.textContent).toContain('درست: مالک یوم الدین');
  });
});
