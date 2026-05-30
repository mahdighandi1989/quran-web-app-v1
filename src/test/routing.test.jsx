// Routing tests (task ae5a1a65): the initial URL selects the matching tab, proving the
// route<->tab wiring works (URL drives the view; the browser Back button changes the URL,
// which this same mechanism turns into a tab change). Firebase is mocked so App mounts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'mock' })) }));
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

import App from '../App.jsx';

beforeEach(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});

function renderAt(path) {
  return render(React.createElement(App), {
    wrapper: ({ children }) =>
      React.createElement(MemoryRouter, { initialEntries: [path] }, children),
  });
}

function activeTabLabel(container) {
  const el = container.querySelector('.nav-tab.active');
  return el ? el.textContent.trim() : null;
}

describe('URL routing maps to the active tab', () => {
  it('/ activates the home (datacenter) tab', () => {
    const { container } = renderAt('/');
    expect(activeTabLabel(container)).toBe('مرکز داده');
  });

  it('/settings activates the settings tab', () => {
    const { container } = renderAt('/settings');
    expect(activeTabLabel(container)).toBe('تنظیمات');
  });

  it('/hifz activates the hifz tab', () => {
    const { container } = renderAt('/hifz');
    expect(activeTabLabel(container)).toBe('حفظ');
  });

  it('/practice activates the training (practice) tab', () => {
    const { container } = renderAt('/practice');
    expect(activeTabLabel(container)).toBe('تمرین');
  });
});
