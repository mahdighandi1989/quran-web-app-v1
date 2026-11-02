// «نظارت و سرکشی» frontend: geometry record + the floating layer + the board's role-gated buttons.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/firebase.js', () => ({ auth: { currentUser: null } }));
const apiMocks = vi.hoisted(() => ({
  getMe: vi.fn(), listSheets: vi.fn(), getSheet: vi.fn(), addNote: vi.fn(), setStatus: vi.fn(),
  triage: vi.fn(), setUrgent: vi.fn(), uploadFile: vi.fn(), fetchBlobUrl: vi.fn(), createSheet: vi.fn(),
}));
vi.mock('../lib/inspectionApi.js', async (orig) => ({ ...(await orig()), ...apiMocks }));

import { cssPath, placeSpot, describeSpot } from '../lib/inspectionGeometry.js';
import InspectionLayer from '../components/InspectionLayer.jsx';
import InspectionBoard from '../components/InspectionBoard.jsx';

const sheet = (over = {}) => ({
  number: 7, title: 'دکمه کج است', status: 'answered', glow: 'green', created_by: 'a@b.c', created_at: '2026-11-02T10:00:00Z',
  notes: [{ id: 'n1', by: 'owner', at: '2026-11-02T10:00:00Z', text: 'دکمه کج است', author: 'a@b.c' },
    { id: 'n2', by: 'reviewer', at: '2026-11-02T11:00:00Z', text: 'درست شد', outcome: 'fixed', commits: ['abc1234'] }],
  files: [], deps: [], spot: { path: '/practice' }, ...over,
});

beforeEach(() => { Object.values(apiMocks).forEach((m) => m.mockReset()); });

describe('inspection geometry', () => {
  it('builds a selector that round-trips to the same element', () => {
    document.body.innerHTML = '<main><section><p>a</p><p><span>x</span></p></section><div id="uniq"><b>y</b></div></main>';
    const span = document.querySelector('span');
    const sel = cssPath(span);
    expect(document.querySelector(sel)).toBe(span);
    const b = document.querySelector('b');
    expect(document.querySelector(cssPath(b))).toBe(b);
    expect(cssPath(document.getElementById('uniq'))).toBe('#uniq');
  });
  it('places a highlight from the stored rectangle when the anchor is gone', () => {
    const p = placeSpot({ rect: { x: 100, y: 200, w: 30, h: 40 }, anchor: { selector: '#gone', fx: 0, fy: 0, fw: 1, fh: 1 } });
    expect(p).toMatchObject({ x: 100, y: 200, w: 30, h: 40, via: 'rect' });
  });
  it('records path, document rect, viewport and anchor', () => {
    document.body.innerHTML = '<div id="target">متنِ زیرِ کادر</div>';
    document.elementFromPoint = () => document.getElementById('target');
    const s = describeSpot({ x: 0, y: 0, w: 0, h: 0 });
    expect(s.path).toBe('/');
    expect(s.anchor.selector).toBe('#target');
    expect(s.anchor.verified).toBe(true);
    expect(s.covered_text).toContain('متنِ زیرِ کادر');
  });
});

describe('InspectionLayer', () => {
  it('is not rendered for guests', () => {
    const { container } = render(<InspectionLayer user={null} />);
    expect(container.innerHTML).toBe('');
  });
  it('a signed-in user can switch it on and sees the hint', async () => {
    apiMocks.listSheets.mockResolvedValue({ reports: [] });
    render(<InspectionLayer user={{ uid: 'u' }} pageLabel="تمرین" />);
    fireEvent.click(screen.getByTestId('inspection-toggle'));
    expect(screen.getByText(/کادر بکشید/)).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.listSheets).toHaveBeenCalledWith('path=%2F'));
  });
});

describe('InspectionBoard', () => {
  it('admin sees the tick (approve) button; the server call is made on click', async () => {
    apiMocks.getMe.mockResolvedValue({ isAdmin: true, adminConfigured: true });
    apiMocks.listSheets.mockResolvedValue({ reports: [sheet()], counts: { answered: 1 }, me: { isAdmin: true, adminConfigured: true } });
    apiMocks.getSheet.mockResolvedValue({ report: sheet() });
    apiMocks.setStatus.mockResolvedValue({ report: sheet({ status: 'approved', glow: 'blue' }) });
    render(<InspectionBoard user={{ uid: 'u' }} />);
    fireEvent.click(await screen.findByText(/دکمه کج است/));
    const tick = await screen.findByText('✓ تأییدِ مالک');
    fireEvent.click(tick);
    await waitFor(() => expect(apiMocks.setStatus).toHaveBeenCalledWith(7, 'approved'));
    expect(screen.queryByText(/حذف/)).toBeNull();
  });
  it('a non-admin never sees approve / triage / urgent', async () => {
    apiMocks.getMe.mockResolvedValue({ isAdmin: false, adminConfigured: true });
    apiMocks.listSheets.mockResolvedValue({ reports: [sheet({ status: 'pending', glow: 'orange' })], counts: {}, me: { isAdmin: false, adminConfigured: true } });
    apiMocks.getSheet.mockResolvedValue({ report: sheet({ status: 'pending', glow: 'orange' }) });
    render(<InspectionBoard user={{ uid: 'u' }} />);
    fireEvent.click(await screen.findByText(/دکمه کج است/));
    await screen.findByText(/برگهٔ 7/);
    expect(screen.queryByText('✓ تأییدِ مالک')).toBeNull();
    expect(screen.queryByText('پذیرش')).toBeNull();
    expect(screen.queryByText('⚡ فوری')).toBeNull();
  });
  it('says so when ADMIN_EMAILS is not configured on the server', async () => {
    apiMocks.getMe.mockResolvedValue({ isAdmin: false, adminConfigured: false });
    apiMocks.listSheets.mockResolvedValue({ reports: [], counts: {}, me: { isAdmin: false, adminConfigured: false } });
    render(<InspectionBoard user={{ uid: 'u' }} />);
    expect(await screen.findByText(/ADMIN_EMAILS/)).toBeInTheDocument();
  });
  it('asks guests to sign in', () => {
    render(<InspectionBoard user={null} />);
    expect(screen.getByText(/ابتدا با گوگل وارد شوید/)).toBeInTheDocument();
  });
});
