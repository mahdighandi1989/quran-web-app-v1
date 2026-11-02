// Login → role, end to end inside the app: the header shows the role the SERVER returns from /api/me
// (admin = verified email in ADMIN_EMAILS on Render). The UI never decides the role itself.
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
const me = vi.hoisted(() => ({ value: {} }));
vi.mock('../lib/inspectionApi.js', async (orig) => ({ ...(await orig()), getMe: vi.fn(() => Promise.resolve(me.value)), listSheets: vi.fn(() => Promise.resolve({ reports: [] })) }));

import App from '../App.jsx';
const renderApp = () => render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);

describe('admin role in the header', () => {
  it('shows 👑 مدیر when the server says isAdmin', async () => {
    me.value = { isAdmin: true, adminConfigured: true, email: 'owner@example.com' };
    renderApp();
    expect((await screen.findByTestId('role-chip')).textContent).toContain('مدیر');
    expect(screen.getByText('نظارت')).toBeInTheDocument(); // the board tab exists for signed-in users
  });
  it('shows a warning when ADMIN_EMAILS is not configured', async () => {
    me.value = { isAdmin: false, adminConfigured: false };
    renderApp();
    expect((await screen.findByTestId('role-chip')).textContent).toContain('مدیر تعریف نشده');
  });
  it('a normal user gets no chip', async () => {
    me.value = { isAdmin: false, adminConfigured: true };
    renderApp();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('role-chip')).toBeNull();
  });
});
