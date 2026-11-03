// «نظارت و سرکشی» frontend: geometry record + the floating layer + the board's role-gated buttons.
import { readFileSync } from 'node:fs';
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

// ── parity with Detective-1 (WORKLOG (۸)) ─────────────────────────────────────────────────────
import { RoundsBar, sheetHref, cadenceFa } from '../components/InspectionBoard.jsx';
import { rushMessage } from '../lib/inspectionApi.js';

describe('inspection parity: rounds, go-to, search, general request, read %, polling banner', () => {
  const soon = new Date(Date.now() + 19 * 60000).toISOString();
  it('rounds bar: next urgent round with countdown; stale warnings', () => {
    const { rerender } = render(<RoundsBar rounds={{ urgent: { at: soon, basis: 'observed', last_seen: '2026-11-03T09:23:00Z' }, full: { at: soon, basis: 'scheduled', last_seen: null } }} />);
    expect(screen.getByText(/دورِ بعدیِ ناظرِ فوری/)).toBeInTheDocument();
    expect(screen.getByText(/آخرین دورِ کامل: هنوز ثبت نشده/)).toBeInTheDocument();
    rerender(<RoundsBar rounds={{ urgent: { at: soon, basis: 'assumed', every_minutes: 180, last_seen: null }, full: { at: soon, basis: 'scheduled', last_seen: null } }} />);
    expect(screen.getByText(/دورِ بعدیِ ناظرِ فوری: .+ — تخمینی — هر ۳ ساعت/)).toBeInTheDocument();
    rerender(<RoundsBar rounds={{ urgent: { at: soon, basis: 'stale', last_seen: '2026-11-01T09:23:00Z' }, full: { at: soon, basis: 'stale' } }} />);
    expect(screen.getByText(/ناظرِ فوری مدتی است سر نزده/)).toBeInTheDocument();
    expect(screen.getByText(/دورِ کاملِ ناظر مدتی است نیامده/)).toBeInTheDocument();
  });
  it('cadence: the urgent queue is every 3 hours, not hourly', () => {
    expect(cadenceFa(180)).toBe(' — هر ۳ ساعت');
    expect(cadenceFa(90)).toBe(' — هر ۹۰ دقیقه');
    expect(cadenceFa(undefined)).toBe('');
  });
  it('the board tells the owner the urgent queue runs every 3 hours', () => {
    expect(readFileSync('src/components/InspectionBoard.jsx', 'utf8')).toMatch(/صفِ فوری هر ۳ ساعت/);
    expect(readFileSync('src/components/InspectionBoard.jsx', 'utf8')).not.toMatch(/صفِ فوری هر ساعت/);
  });
  it('rush message names the queue position and the expected arrival', () => {
    expect(rushMessage(2, { at: soon, basis: 'observed' })).toMatch(/نوبتِ ۲ در صفِ فوری — ناظر حدودِ ساعتِ .+ دقیقهٔ دیگر/);
    expect(rushMessage(1, { at: soon, basis: 'stale' })).toMatch(/سر نزده/);
  });
  it('go-to link carries the sheet number; general/unsafe paths have none', () => {
    expect(sheetHref({ number: 7, spot: { path: '/practice' } })).toBe('/practice?insp=7');
    expect(sheetHref({ number: 7, spot: { general: true, path: '' } })).toBeNull();
    expect(sheetHref({ number: 7, spot: { path: 'javascript:alert(1)' } })).toBeNull();
  });
  it('search filters by text in notes; general request posts a box-less sheet', async () => {
    apiMocks.getMe.mockResolvedValue({ isAdmin: true, adminConfigured: true });
    apiMocks.listSheets.mockResolvedValue({ reports: [sheet(), sheet({ number: 8, title: 'صوت قطع است', notes: [{ id: 'z', by: 'owner', text: 'قاری پخش نمی‌شود' }] })], counts: {}, me: { isAdmin: true, adminConfigured: true }, rounds: null });
    apiMocks.createSheet.mockResolvedValue({ report: { number: 9, title: 'کلی' } });
    apiMocks.getSheet.mockResolvedValue({ report: sheet({ number: 9, title: 'کلی', spot: { general: true, path: '' } }) });
    render(<InspectionBoard user={{ uid: 'u' }} />);
    await screen.findByText(/صوت قطع است/);
    fireEvent.change(screen.getByTestId('insp-search'), { target: { value: 'قاری' } });
    expect(screen.queryByText(/دکمه کج است/)).toBeNull();
    expect(screen.getByText(/صوت قطع است/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('＋ درخواستِ عمومی'));
    fireEvent.change(screen.getByPlaceholderText('چه می‌خواهید؟'), { target: { value: 'کلی' } });
    fireEvent.click(screen.getByText('ثبت'));
    await waitFor(() => expect(apiMocks.createSheet).toHaveBeenCalledWith({ text: 'کلی', spot: { general: true } }));
  });
  it('shows the supervisor\'s read percentage on attachments', async () => {
    apiMocks.getMe.mockResolvedValue({ isAdmin: true, adminConfigured: true });
    apiMocks.listSheets.mockResolvedValue({ reports: [sheet()], counts: {}, me: { isAdmin: true, adminConfigured: true } });
    apiMocks.getSheet.mockResolvedValue({ report: sheet({ files: [
      { id: 'file_a', filename: 'a.txt', byte_size: 10, extract_status: 'ok', read_percent: 40, fully_read: false },
      { id: 'file_b', filename: 'b.png', byte_size: 10, extract_status: 'image', viewed_at: '2026-11-03T00:00:00Z', fully_read: true },
    ] }) });
    render(<InspectionBoard user={{ uid: 'u' }} />);
    fireEvent.click(await screen.findByText(/دکمه کج است/));
    expect(await screen.findByText('ناظر ۴۰٪ خوانده')).toBeInTheDocument();
    expect(screen.getByText('✓ ناظر بازش کرد')).toBeInTheDocument();
  });
  it('polls while something is rushed and announces what the supervisor did', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const rushed = sheet({ status: 'open', glow: 'orange', urgent_at: '2026-11-03T09:00:00Z', urgent_done_at: null });
      const answered = { ...rushed, status: 'answered', urgent_done_at: '2026-11-03T09:30:00Z', notes: [...rushed.notes, { id: 'n3', by: 'reviewer', text: 'شد', outcome: 'fixed' }] };
      apiMocks.getMe.mockResolvedValue({ isAdmin: true, adminConfigured: true });
      apiMocks.listSheets.mockResolvedValueOnce({ reports: [rushed], counts: {}, me: { isAdmin: true, adminConfigured: true } })
        .mockResolvedValue({ reports: [answered], counts: {}, me: { isAdmin: true, adminConfigured: true } });
      render(<InspectionBoard user={{ uid: 'u' }} />);
      await screen.findByText(/دکمه کج است/);
      await vi.advanceTimersByTimeAsync(21000);
      expect(await screen.findByText(/ناظر روی موردهای فوری کار کرد/)).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});
