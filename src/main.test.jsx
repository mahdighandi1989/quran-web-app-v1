// Entry-point test (task a3e9a63e): src/main.jsx is the app's entry point and mounts
// <App /> into #root. A failure here takes down the whole app, so we verify App renders
// without crashing. Firebase is mocked so App's module-scope init is side-effect free.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'mock-app' })) }));
vi.mock('firebase/analytics', () => ({ getAnalytics: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})), doc: vi.fn(() => ({})),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  setDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(() => () => {}),
}));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    addScope() {}
    setCustomParameters() {}
    static credentialFromResult() { return null; }
  }
  return {
    getAuth: vi.fn(() => ({ currentUser: null })),
    GoogleAuthProvider,
    signInWithPopup: vi.fn(),
    signInWithRedirect: vi.fn(),
    getRedirectResult: vi.fn(() => Promise.resolve(null)),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
  };
});

import App from './App.jsx';

beforeEach(() => {
  // jsdom doesn't implement these; App may touch them in effects/handlers.
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
});

describe('application entry point', () => {
  it('renders <App /> without crashing', () => {
    expect(() => render(React.createElement(App), { wrapper: MemoryRouter })).not.toThrow();
  });

  it('mounts a non-empty DOM tree', () => {
    const { container } = render(React.createElement(App), { wrapper: MemoryRouter });
    expect(container.childElementCount).toBeGreaterThan(0);
  });

  it('executes the real entry module (src/main.jsx) into #root without throwing', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    let mod;
    // wrap in act() so App's mount effects flush inside the test (no act warning)
    await act(async () => { mod = await import('./main.jsx'); });
    expect(mod).toBeTruthy();
  });
});
